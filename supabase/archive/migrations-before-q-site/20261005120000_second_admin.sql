-- A second admin (style variants: create, edit, delete, publish), the same rights as the first
insert into public.admins (email) values ('chris.scarlat@neurawork.ai') on conflict (email) do nothing;
