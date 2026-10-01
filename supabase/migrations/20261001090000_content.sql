-- Phase 2: editable content, append-only revision history, comments, media storage.
-- Guests have no Supabase account (they enter with the code), so their ids are text ("guest-<hash>") and
-- everything they read or write goes through the /api functions with the service role.

-- People shown in presence, comments and history. Editors: auth user id. Guests: "guest-<hash>".
create table if not exists public.profiles (
    id text primary key,
    kind text not null check (kind in ('editor', 'guest')),
    display_name text,
    avatar_url text,
    color text,
    updated_at timestamptz not null default now()
);

-- One row per editable element (data-kalq-key in the HTML). Keys never change once shipped.
create table if not exists public.blocks (
    key text primary key,
    page text not null,
    type text not null default 'text' check (type in ('text', 'image', 'video')),
    created_at timestamptz not null default now()
);

-- Append only. Every edit and every restore adds rows, nothing is updated or deleted.
-- lang is 'de' or 'en' for text, null for media (one file for both languages).
create table if not exists public.revisions (
    id uuid primary key default gen_random_uuid(),
    block_key text not null references public.blocks (key),
    page text not null,
    lang text check (lang in ('de', 'en')),
    content text not null,
    author_id uuid references auth.users (id),
    batch_id uuid not null,
    batch_scope text not null check (batch_scope in ('block', 'page', 'site')),
    batch_label text,
    restored_from_batch uuid,
    created_at timestamptz not null default now()
);
create index if not exists revisions_latest on public.revisions (block_key, lang, created_at desc);
create index if not exists revisions_page on public.revisions (page, created_at desc);
create index if not exists revisions_batch on public.revisions (batch_id);

create or replace function public.reject_change()
returns trigger
language plpgsql
as $$
begin
    raise exception '% is append-only: % is not allowed', tg_table_name, tg_op;
end
$$;

drop trigger if exists revisions_append_only on public.revisions;
create trigger revisions_append_only
    before update or delete on public.revisions
    for each row execute function public.reject_change();
drop trigger if exists revisions_no_truncate on public.revisions;
create trigger revisions_no_truncate
    before truncate on public.revisions
    for each statement execute function public.reject_change();

-- Newest revision per block and language for a page, plus the shared "site" blocks (header, footer)
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
    order by r.block_key, r.lang, r.created_at desc, r.id desc
$$;

-- Comments: soft resolve only, never deleted. author_id is an auth user id or a guest id.
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    page text not null,
    block_key text,
    anchor_selector text,
    x_pct numeric,
    y_pct numeric,
    parent_id uuid references public.comments (id),
    body text not null check (length(body) between 1 and 2000),
    author_id text not null,
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by text
);
create index if not exists comments_page on public.comments (page, created_at);

-- Only resolving may change a comment
create or replace function public.comments_resolve_only()
returns trigger
language plpgsql
as $$
begin
    if (new.id, new.page, new.block_key, new.anchor_selector, new.x_pct, new.y_pct, new.parent_id, new.body, new.author_id, new.created_at)
        is distinct from
       (old.id, old.page, old.block_key, old.anchor_selector, old.x_pct, old.y_pct, old.parent_id, old.body, old.author_id, old.created_at) then
        raise exception 'comments can only be resolved or reopened';
    end if;
    return new;
end
$$;

drop trigger if exists comments_resolve_only on public.comments;
create trigger comments_resolve_only
    before update on public.comments
    for each row execute function public.comments_resolve_only();
drop trigger if exists comments_no_delete on public.comments;
create trigger comments_no_delete
    before delete on public.comments
    for each row execute function public.reject_change();

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.revisions enable row level security;
alter table public.comments enable row level security;

-- Reads: anyone with a gated role in their JWT (editors). Guests read through /api with the service role.
create policy profiles_select on public.profiles for select to authenticated
    using (public.auth_role() in ('editor', 'guest'));
create policy blocks_select on public.blocks for select to authenticated
    using (public.auth_role() in ('editor', 'guest'));
create policy revisions_select on public.revisions for select to authenticated
    using (public.auth_role() in ('editor', 'guest'));
create policy comments_select on public.comments for select to authenticated
    using (public.auth_role() in ('editor', 'guest'));

-- Writes: editors only, as themselves. No update or delete policies exist on revisions or blocks.
create policy blocks_insert on public.blocks for insert to authenticated
    with check (public.auth_role() = 'editor');
create policy revisions_insert on public.revisions for insert to authenticated
    with check (public.auth_role() = 'editor' and author_id = auth.uid());
create policy profiles_upsert_self on public.profiles for insert to authenticated
    with check (public.auth_role() = 'editor' and id = auth.uid()::text);
create policy profiles_update_self on public.profiles for update to authenticated
    using (public.auth_role() = 'editor' and id = auth.uid()::text);
create policy comments_insert on public.comments for insert to authenticated
    with check (public.auth_role() in ('editor', 'guest') and author_id = auth.uid()::text);
create policy comments_resolve on public.comments for update to authenticated
    using (public.auth_role() = 'editor' or author_id = auth.uid()::text);

-- Media: public read, editors upload, 50 MB, images and mp4/webm (no SVG, it can carry scripts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy site_media_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'site-media' and public.auth_role() = 'editor');

-- Live updates for editors' browsers
do $$
begin
    alter publication supabase_realtime add table public.revisions;
exception when duplicate_object then null;
end $$;
do $$
begin
    alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end $$;
