-- Phase 7: style variants.
-- A variant is a block "variant.<id>" on the page 'variants'; its content is the variant as JSON. So variants share
-- the append-only revisions, the history and restore_to with everything else: nothing is lost, everything is
-- revertible. Variant comments are ordinary comments on page 'variants'. Votes have their own table (a vote can be
-- taken back, so it is the one thing here that is really removed).

-- Admins: only they create, edit, delete or publish variants
create table if not exists public.admins (
    email text primary key
);
insert into public.admins (email) values ('chris.scarlat@certil.com') on conflict (email) do nothing;
alter table public.admins enable row level security; -- no policies: read through is_admin() only

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.is_admin_email(email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admins a where lower(a.email) = lower($1))
$$;
revoke execute on function public.is_admin_email(text) from public, anon, authenticated;
grant execute on function public.is_admin_email(text) to service_role;

-- Editors write content as before; variant blocks and revisions only admins
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated
    with check (public.auth_role() = 'editor' and (page <> 'variants' or public.is_admin()));
drop policy if exists revisions_insert on public.revisions;
create policy revisions_insert on public.revisions for insert to authenticated
    with check (public.auth_role() = 'editor' and author_id = auth.uid() and (page <> 'variants' or public.is_admin()));

-- One vote per person per variant (editors: auth id, guests: guest id)
create table if not exists public.variant_votes (
    variant_key text not null references public.blocks (key),
    voter_id text not null,
    created_at timestamptz not null default now(),
    primary key (variant_key, voter_id)
);
alter table public.variant_votes enable row level security;
create policy variant_votes_select on public.variant_votes for select to authenticated
    using (public.auth_role() in ('editor', 'guest'));
-- writes only through /api/variants (guests have no account)

-- Variant A: today's look, the default. Fields left empty fall back to the built-in site.
insert into public.blocks (key, page, type) values ('variant.a', 'variants', 'text') on conflict (key) do nothing;
insert into public.revisions (block_key, page, lang, content, batch_id, batch_scope, batch_label)
select 'variant.a', 'variants', null,
       '{"letter":"A","name":"Kalq","status":"published","is_default":true,"sort":1,"logo_svg":"",'
       '"colors":{"bg":"#ffffff","text":"#101010","accent":"#3b82f6","light":"#ffffff","dark":"#101010"},'
       '"fonts":{"heading":{"source":"default","family":""},"body":{"source":"default","family":""}},'
       '"hero_video":"","images":{}}',
       gen_random_uuid(), 'block', 'Created variant A'
where not exists (select 1 from public.revisions where block_key = 'variant.a');

-- Storage: variant files (logos are inline, but fonts, images, hero videos) live under variants/ and only admins
-- upload there; editors keep uploading page media everywhere else
drop policy if exists site_media_upload on storage.objects;
create policy site_media_upload on storage.objects for insert to authenticated
    with check (
        bucket_id = 'site-media'
        and public.auth_role() = 'editor'
        and (name not like 'variants/%' or public.is_admin())
    );

-- Content history and "restore whole site" stay about content: style variants have their own versions in the
-- Styles panel (a block restore with page 'variants'), so they are left out here.
create or replace function public.history_batches(page text default null, max_rows integer default 150)
returns table (
    batch_id uuid, created_at timestamptz, author_id uuid, batch_scope text, batch_label text,
    restored_from_batch uuid, pages text[], block_keys text[], row_count integer
)
language sql
stable
as $$
    select r.batch_id,
           max(r.created_at),
           (array_agg(r.author_id order by r.created_at desc))[1],
           min(r.batch_scope),
           min(r.batch_label),
           (array_agg(r.restored_from_batch order by r.created_at desc))[1],
           array_agg(distinct r.page),
           array_agg(distinct r.block_key),
           count(*)::integer
    from public.revisions r
    where r.page <> 'variants' and ($1 is null or r.page = $1 or r.page = 'site')
    group by r.batch_id
    order by max(r.seq) desc
    limit greatest(1, least($2, 500))
$$;

create or replace function public.restore_to(
    from_batch uuid,
    scope text,
    page text default null,
    block text default null,
    author uuid default null,
    label text default null
)
returns table (new_batch_id uuid, added_rows integer) -- not batch_id/row_count: those names would clash inside plpgsql
language plpgsql
security definer
set search_path = public
as $$
declare
    new_batch uuid := gen_random_uuid();
    upto bigint := public.batch_seq(from_batch);
    added integer;
begin
    if upto is null then raise exception 'unknown batch %', from_batch; end if;
    if scope not in ('block', 'page', 'site') then raise exception 'unknown scope %', scope; end if;
    if scope = 'page' and page is null then raise exception 'page restore needs a page'; end if;
    if scope = 'block' and block is null then raise exception 'block restore needs a block'; end if;

    insert into public.revisions (block_key, page, lang, content, author_id, batch_id, batch_scope, batch_label, restored_from_batch)
    select old.block_key, old.page, old.lang, old.content, author, new_batch, scope, label, from_batch
    from (
        select distinct on (r.block_key, r.lang) r.block_key, r.page, r.lang, r.content
        from public.revisions r
        where r.seq <= upto
          and ((scope = 'site' and r.page <> 'variants') -- styles have their own versions (Styles panel)
               or (scope = 'page' and r.page = restore_to.page)
               or (scope = 'block' and r.block_key = restore_to.block))
        order by r.block_key, r.lang, r.seq desc
    ) old
    where old.content is distinct from (
        select now_r.content from public.revisions now_r
        where now_r.block_key = old.block_key and now_r.lang is not distinct from old.lang
        order by now_r.seq desc
        limit 1
    );
    get diagnostics added = row_count;
    return query select new_batch, added;
end
$$;

-- Fonts can be uploaded as woff2
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'font/woff2']
where id = 'site-media';
