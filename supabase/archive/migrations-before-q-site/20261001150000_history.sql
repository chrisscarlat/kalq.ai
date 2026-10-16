-- Phase 6: version history, preview, restore. Nothing is ever updated or deleted: a restore adds revisions
-- that copy older content, in one new batch that points back at the previewed batch.
-- Called from /api/history with the service role (guests have no Supabase account).

-- "Newest" by insert order, never by clock: two revisions with equal or out-of-order timestamps
-- (clock differences, a save during a restore) must not let an older text win.
alter table public.revisions add column if not exists seq bigint generated always as identity;
create index if not exists revisions_seq on public.revisions (block_key, lang, seq desc);

create or replace function public.latest_content(page text)
returns table (block_key text, lang text, content text, type text, author_id uuid, created_at timestamptz)
language sql
stable
as $$
    select distinct on (r.block_key, r.lang)
        r.block_key, r.lang, r.content, b.type, r.author_id, r.created_at
    from public.revisions r
    join public.blocks b on b.key = r.block_key
    where r.page = $1 or r.page = 'site'
    order by r.block_key, r.lang, r.seq desc
$$;

-- The position of a batch in history: its last revision
create or replace function public.batch_seq(batch uuid)
returns bigint
language sql
stable
as $$
    select max(seq) from public.revisions where batch_id = $1
$$;

-- Batches newest first. With a page: batches that touched that page or the shared site blocks.
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
    where $1 is null or r.page = $1 or r.page = 'site'
    group by r.batch_id
    order by max(r.seq) desc
    limit greatest(1, least($2, 500))
$$;

-- How a page looked right after a batch: newest revision per block and language up to it, plus the site blocks
create or replace function public.content_at(page text, batch uuid)
returns table (block_key text, lang text, content text, type text)
language sql
stable
as $$
    select distinct on (r.block_key, r.lang) r.block_key, r.lang, r.content, b.type
    from public.revisions r
    join public.blocks b on b.key = r.block_key
    where (r.page = $1 or r.page = 'site') and r.seq <= public.batch_seq($2)
    order by r.block_key, r.lang, r.seq desc
$$;

-- Restore to the state right after a batch, atomically (one INSERT ... SELECT).
--   scope 'block': one block (both languages), 'page': that page's own blocks, 'site': every block.
-- Only blocks whose current content differs are copied. Returns the new batch id and how many rows it added.
-- Parameters are referenced as restore_to.<name> where a column has the same name.
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
          and (scope = 'site'
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

revoke execute on function public.history_batches(text, integer) from public, anon, authenticated;
revoke execute on function public.content_at(text, uuid) from public, anon, authenticated;
revoke execute on function public.batch_seq(uuid) from public, anon, authenticated;
revoke execute on function public.restore_to(uuid, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.history_batches(text, integer) to service_role;
grant execute on function public.content_at(text, uuid) to service_role;
grant execute on function public.batch_seq(uuid) to service_role;
grant execute on function public.restore_to(uuid, text, text, text, uuid, text) to service_role;
