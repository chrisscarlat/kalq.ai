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

-- Fonts can be uploaded as woff2
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'font/woff2']
where id = 'site-media';
