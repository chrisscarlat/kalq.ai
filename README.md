# kalq.ai

Static site built from the Digiverse Studio template (`templates/digiverseStudio`, kept for reference).

## Run

    python3 -m http.server 8000

## Styles

Edit the SCSS in `css/`, then compile:

    npx sass --no-source-map css/main.scss css/main.css

## Pages and translations

The HTML pages are generated. Edit `tools/build_pages.py` (markup) or `i18n/strings.json` (copy), then run:

    python3 tools/build_pages.py

Templates are written in English; the script tags them with `data-i18n`, writes the pages in German (the default language) and writes `js/strings.js` from the JSON. The site has two languages, German and English, both fully translated.

## Brand

- Font: Clash Grotesk (Fontshare), self-hosted in `fonts/`.
- `assets/kalq-mark.svg`: symbol. `assets/kalq-wordmark.svg`: KALQ outlined from Clash Grotesk Medium, the Q tail runs at 45°, parallel to the symbol's diagonal, and ends on the baseline at the O's right edge.
- Header and hero inline the SVGs so they take `currentColor`. The header symbol is drawn as 8 lines; `js/logoAnimation.js` forms K, A, L, Q only by growing and shrinking the rays along their own axes, opens back to the symbol between letters, then turns it in 3D (own perspective projection with depth shading) and loops (off with prefers-reduced-motion).

## Open TODOs

Hover and header images, Impressum data, Datenschutz text.

## Gate (temporary)

Every page needs the signed `kalq_gate` cookie, otherwise `middleware.js` shows `gate.html`. Guests enter the access code (`/api/code`, they get an animal), editors log in with Google or LinkedIn (`/api/session`). Shared server code is in `lib/`. Impressum and Datenschutz are public (linked from the gate footer) together with the styles and scripts they need; their copy comes from `js/strings-public.js`, the rest of the site's copy stays in the gated `js/strings.js`. Gated requests get the gate with status 401. `vercel.json` and `robots.txt` keep the gated site out of search engines.

- Local testing needs `npx vercel dev` (middleware and `/api` do not run under `python3 -m http.server`).
- Gate styles: `npx sass --no-source-map css/gate.scss css/gate.css`
- Database: `supabase/migrations/`, apply with `supabase db push` or the SQL editor.
- Env vars (Vercel, Production and Preview): `ACCESS_CODE`, `GATE_COOKIE_SECRET`, `IP_HASH_SALT`, plus `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the Supabase integration.

## Editable content (Phase 2)

Every editable element has a stable `data-kalq-key` (`page.section.item`, shared header and footer use `site.*`), set by `tools/build_pages.py`. Media also have `data-kalq-type="image"` or `"video"`. Keys must never change once shipped.

- `supabase/migrations/20261001090000_content.sql`: `profiles`, `blocks`, append-only `revisions` (one per language for text), `comments` (resolve only), `latest_content(page)`, the `site-media` bucket.
- `/api/content?page=`: newest content for a page; needs the gate cookie except for the legal pages. `js/content.js` applies it (sanitised: only br, em, strong, a href) and keeps keyed blocks hidden until then, 1.5 s at most.
- Seed once after the migration: `node scripts/seed-blocks.mjs --dry-run`, then without the flag. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (`npx vercel env pull .env`). Never commit `.env`.

## Presence and cursors (Phase 3)

`js/collab.js` and `css/collab.css` (compile: `npx sass --no-source-map css/collab.scss css/collab.css`) add the toolbar at the bottom: who is online on this page and logout. One Supabase Realtime channel per page, `presence:<page>:<key>`; the key comes from `/api/me` (gate cookie needed), so only people through the gate can find the channel. Cursors are sent about 20 times a second from mouse devices only, as `x_pct` and document `y`, so they land right after scrolling.

## Edit mode (Phase 4)

Editors get a pencil in the toolbar (or press `E`). Click a text block to edit it in place: Enter is a line break, `Cmd/Ctrl+Enter` or clicking elsewhere saves, `Esc` cancels; paste is plain text. Images and videos get a "Replace" button (upload to `site-media`, max 50 MB). Saves go to Supabase with the editor's own login (RLS), then the page channel announces the change and every browser, guests included, reloads it from `/api/content` and briefly highlights it.

Supabase allows a client only 5 presence updates per 30 seconds and closes the channel beyond that, so "X is editing" is a broadcast repeated every 4 s (expires after 10 s), not a presence update. Channels that close anyway are rejoined with growing waits.

## Comments (Phase 5)

Everyone through the gate can comment: `C` or the bubble button, then click anywhere on the page. A pin attaches to the nearest `data-kalq-key` block (position in % of the block, so it stays on the spot on any screen width), otherwise to the page. Threads have replies and can be resolved or reopened by editors or the author. `H` or the clock opens the side panel with this page's comments (resolved ones on request). All reads and writes go through `/api/comments` (gate cookie; author always from the cookie; 1 to 2000 characters; 30 per person per 10 minutes); changes are announced on the page channel and reloaded by everyone.

## History, restore, invites (Phase 6)

The clock opens the side panel on Versions: save batches newest first, for this page or the whole site. A click previews the page as it was right after that batch (live updates pause, `Esc` or "Exit preview" ends it). Editors can restore the block, the page or the whole site; `restore_to` copies the old content as new revisions in one batch that points back at the previewed one, so nothing is lost and a restore can be restored. Order comes from the `seq` column (insert order), never from timestamps. Editors invite colleagues from the toolbar (`/api/invite`: adds the email to `invites` and sends a Supabase invite).

## Line blocks, paragraph blocks, media slots

- `data-kalq-format="lines"` (hero slogan, footer heading, Impressum address and register): one block, every line break is a line that rises in with a stagger (`js/blocks.js`). Add or remove lines by editing.
- `data-kalq-format="paragraphs"` ("Unser Ansatz", Company "Gemeinsame Semantik"): one block with `<p>` paragraphs. In edit mode Enter starts a paragraph, Shift+Enter breaks a line.
- In `i18n/strings.json` these use `\n` between lines and a blank line between paragraphs.
- Media slots take an image or a video, the file decides. Platform and Company have a hero slot (`*.hero.media`), empty until an editor adds something; in edit mode hero controls sit vertically centred on the right.
- `supabase/migrations/20261001180000_merge_blocks.sql` copies the old split blocks' current content into the new blocks once; the old revisions stay in the history.

## Style variants (Phase 7)

A variant is a complete look: letter, name, logo SVG, colours (background, text, accent, light, dark), heading and body font (Clash Grotesk, Google Fonts or an uploaded woff2), hero video and replacements for any keyed image. Anything left empty falls back to the built-in site. Variant A is today's look and the default.

- Stored as blocks `variant.<id>` (JSON) on the page `variants`, so every change is an append-only revision; versions and restore live in the Styles panel. Content history and "restore whole site" leave variants alone.
- Admins (`admins` table, `is_admin()` in RLS) create, edit, publish, delete and restore variants in the Styles panel (`S` or the palette button). Uploads go to `site-media/variants/<id>/`, which only admins may write.
- Logos (uploaded file or pasted code) go through `lib/svg-sanitize.js`, the same allowlist sanitiser in the browser and on the server.
- `js/variants.js` applies a variant as custom properties on `:root` (`--kalq-bg`, `--kalq-text`, `--kalq-accent`, `--kalq-light`, `--kalq-dark`, `--kalq-font-heading`, `--kalq-font-body`), without reload; the dot switcher next to the logo remembers the choice in localStorage.
- The gate cycles only its logo through the published variants, once a second with a crossfade.
- Hold the header logo three seconds to open the viewer: cards per variant, votes (one per person, again to take back), voter faces, comments, sort by votes, arrow keys and swipe. Variant changes, votes and variant comments travel on a site-wide realtime channel, so every page sees them live.

Manual step: run `supabase/migrations/20261002090000_variants.sql` (SQL Editor or `supabase db push`). It adds the admins table with chris.scarlat@certil.com, variant A, votes, the RLS and Storage policies, and woff2 uploads. Nothing else needs configuring.
