-- Phase 1: gate. Who may become an editor, guest animals, rate limiting, the signup hook.

-- Editors come from these domains or from invites
create table if not exists public.allowed_domains (
    domain text primary key
);
insert into public.allowed_domains (domain) values ('certil.com'), ('neurawork.ai')
on conflict (domain) do nothing;

create table if not exists public.invites (
    email text primary key,
    invited_by uuid references auth.users (id),
    created_at timestamptz not null default now()
);

-- One animal per salted IP hash. The raw IP is never stored.
create table if not exists public.guest_identities (
    ip_hash text primary key,
    animal text not null,
    emoji text not null,
    color text not null,
    created_at timestamptz not null default now()
);

-- Access code attempts for rate limiting (10 per IP hash per 10 minutes)
create table if not exists public.gate_attempts (
    id bigint generated always as identity primary key,
    ip_hash text not null,
    created_at timestamptz not null default now()
);
create index if not exists gate_attempts_ip_time on public.gate_attempts (ip_hash, created_at desc);

alter table public.allowed_domains enable row level security;
alter table public.invites enable row level security;
alter table public.guest_identities enable row level security;
alter table public.gate_attempts enable row level security;
-- allowed_domains, guest_identities and gate_attempts have no policies: service role only.

-- Role from the JWT app_metadata, set by /api/code and /api/session
create or replace function public.auth_role()
returns text
language sql
stable
as $$
    select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.is_allowed_editor_email(email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select $1 is not null and (
        exists (select 1 from public.allowed_domains d where d.domain = lower(split_part($1, '@', 2)))
        or exists (select 1 from public.invites i where lower(i.email) = lower($1))
    )
$$;
-- Not callable from the browser, so nobody can probe the invite list
revoke execute on function public.is_allowed_editor_email(text) from public, anon, authenticated;
grant execute on function public.is_allowed_editor_email(text) to service_role, supabase_auth_admin;

create policy invites_select on public.invites
    for select to authenticated
    using (public.auth_role() = 'editor');

create policy invites_insert on public.invites
    for insert to authenticated
    with check (public.auth_role() = 'editor' and invited_by = auth.uid());

-- Auth hook "Before User Created": rejects OAuth signups outside the allowed domains and invites.
-- Anonymous (guest) users pass through. Attach it in Authentication > Hooks.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    new_user jsonb := event -> 'user';
begin
    if coalesce((new_user ->> 'is_anonymous')::boolean, false) then
        return '{}'::jsonb;
    end if;
    if public.is_allowed_editor_email(new_user ->> 'email') then
        return '{}'::jsonb;
    end if;
    return jsonb_build_object(
        'error', jsonb_build_object(
            'http_code', 403,
            'message', 'This login is for Certil and Neurawork colleagues. Use the access code or ask for an invite.'
        )
    );
end
$$;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
