-- Text that was split into separate blocks only for layout or animation becomes one block each:
--   hero lines, footer heading, Impressum address and register: line blocks (lines separated by <br>)
--   "Unser Ansatz" and Company "Gemeinsame Semantik": paragraph blocks (<p>...</p>)
-- The current content of the old blocks is copied into the new ones in a single batch. The old blocks and all
-- their revisions stay, so the history keeps everything. Also adds the empty hero media slots.
-- Safe to run twice: new blocks that already have content are left alone.

insert into public.blocks (key, page, type) values
    ('home.hero.slogan', 'home', 'text'),
    ('site.footer.heading', 'site', 'text'),
    ('home.approach.text', 'home', 'text'),
    ('company.shared.text', 'company', 'text'),
    ('impressum.provider.address', 'impressum', 'text'),
    ('impressum.register.text', 'impressum', 'text'),
    ('platform.hero.media', 'platform', 'image'),
    ('company.hero.media', 'company', 'image')
on conflict (key) do nothing;

with parts (new_key, page, old_key, position, glue) as (
    values
        -- The hero showed lines 1 and 2 on one line on a desktop, line 3 below
        ('home.hero.slogan', 'home', 'home.hero.line1', 1, ''),
        ('home.hero.slogan', 'home', 'home.hero.line2', 2, ' '),
        ('home.hero.slogan', 'home', 'home.hero.line3', 3, '<br>'),
        ('site.footer.heading', 'site', 'site.footer.heading1', 1, ''),
        ('site.footer.heading', 'site', 'site.footer.heading2', 2, '<br>'),
        ('home.approach.text', 'home', 'home.approach.p1', 1, 'p'),
        ('home.approach.text', 'home', 'home.approach.p2', 2, 'p'),
        ('company.shared.text', 'company', 'company.shared.p1', 1, 'p'),
        ('company.shared.text', 'company', 'company.shared.p2', 2, 'p'),
        ('impressum.provider.address', 'impressum', 'impressum.provider.company', 1, ''),
        ('impressum.provider.address', 'impressum', 'impressum.provider.street', 2, '<br>'),
        ('impressum.provider.address', 'impressum', 'impressum.provider.city', 3, '<br>'),
        ('impressum.provider.address', 'impressum', 'impressum.provider.country', 4, '<br>'),
        ('impressum.register.text', 'impressum', 'impressum.register.court', 1, ''),
        ('impressum.register.text', 'impressum', 'impressum.register.number', 2, '<br>')
),
latest as (
    select distinct on (r.block_key, r.lang) r.block_key, r.lang, r.content
    from public.revisions r
    where r.block_key in (select old_key from parts)
    order by r.block_key, r.lang, r.seq desc
),
merged as (
    select p.new_key, p.page, l.lang,
           string_agg(case when p.glue = 'p' then '<p>' || l.content || '</p>' else p.glue || l.content end, '' order by p.position) as content
    from parts p
    join latest l on l.block_key = p.old_key
    where not exists (select 1 from public.revisions done where done.block_key = p.new_key)
    group by p.new_key, p.page, l.lang
),
batch as (select gen_random_uuid() as id)
insert into public.revisions (block_key, page, lang, content, batch_id, batch_scope, batch_label)
select m.new_key, m.page, m.lang, m.content, batch.id, 'site', 'Merged split text into single blocks'
from merged m, batch;
