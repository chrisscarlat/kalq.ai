-- Page builder, foundation: each page's layout (which sections, in which order, draft or live) is stored as a
-- block "layout.<page>" of the new type 'layout', with JSON revisions like every other block. So every insert,
-- move, copy and removal is a revision: in Versions, previewable and restorable with the existing restore_to.
-- A placeholder is a block without any revision yet: it never appears in the public page.
alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in ('text', 'image', 'video', 'layout'));
