# kalq.ai

Kalq's website on the Q-Site engine. Q-Site began as this repository's code (its first commit imports kalq.ai main
at 7958c8c); since Q-Site 1.1.0 (now 1.2.1) Kalq consumes it like every other Q-Forge site.

## Engine: Q-Site

The engine (page builder, modules, editor, styles, gate, history, `/api`, middleware, Supabase schema) is Q-Site,
an npm package from git (`package.json`: `"q-site": "github:chrisscarlat/q-site#v1.2.1"`). This repository holds
only Kalq: its pages, copy and brand. `middleware.js` and `api/*.js` are one-line references to the engine;
`site.config.json` tells the engine Kalq's pages, picture slots, logo, gate and sign-in message.

    npm install
    npm run dev      # http://localhost:3000, the gate, /api and the pages as on Vercel (values in .env)
    npm run build    # dist/: what Vercel serves (the engine's files, Kalq's on top, CSS compiled)
    npm test         # q-site check: the gate, every page in German and English, the copy's keys, a browser run

Kalq's own files the engine uses: `js/strings.js`, `js/strings-public.js` (generated, see below),
`js/logoAnimation.js` (the mark forming K, A, L, Q), `js/inquiry-text.js` (the chat's words), `css/_brand.scss`
(Clash Grotesk, the gate's black), `css/_site.scss` (empty: Kalq's look is the engine's), `assets/logo.svg` (the
mark). Engine updates: change the tag in `package.json`, `npm install`, `npm test`.

On Vercel the install step (`tools/vercel-install.sh`) fetches the private engine with `Q_SITE_GITHUB_TOKEN`; the
build command is `npm run build` and Vercel serves `dist/` (`vercel.json`).

## Deploying

Deploy only by pushing to `main`. Vercel's Git integration builds every push to `main` and puts it live on kalq.ai.
Never deploy with the Vercel CLI (`vercel deploy`, `vercel --prod`, `vercel promote`): a CLI deploy and the automatic
one from `main` race, and whichever finishes last goes live, which can be an older commit.

## Database

Kalq's Supabase project already has the schema up to its seven migrations, kept in
`supabase/archive/migrations-before-q-site/` as they were applied. The engine's migrations in full:

    npx q-site migrations <dir>    # the engine's migrations, with Kalq's sign-in message in the signup hook

On Kalq's project only the four newer ones are new (20261009120000_engine_constraints, 20261015090000_publish,
20261016090000_domain_invites, 20261016120000_account_links): additive and idempotent, see PORT_NOTES.md.

## Pages and translations

The HTML pages are generated. Edit `tools/build_pages.py` (markup) or `i18n/strings.json` (copy), then run:

    python3 tools/build_pages.py

Templates are written in English; the script tags them with `data-i18n`, writes the pages in German (the default
language) and writes `js/strings.js` and `js/strings-public.js` from the JSON. The site has two languages, German and
English, both fully translated. Every editable element has a stable `data-qs-key` (`page.section.item`, shared
header and footer use `site.*`); keys never change once shipped, so everything stored in Supabase applies as it is.

## Brand

- Font: Clash Grotesk (Fontshare), self-hosted in `fonts/`.
- `assets/logo.svg`: the symbol as 8 lines (site.config.json "logo"); the engine draws it in the header and on the
  gate. `assets/kalq-mark.svg`: the symbol as filled shapes. `assets/kalq-wordmark.svg`: KALQ outlined from Clash
  Grotesk Medium, the Q tail runs at 45°, parallel to the symbol's diagonal, and ends on the baseline at the O's
  right edge.
- `js/logoAnimation.js` ("logoAnimation": true) forms K, A, L, Q only by growing and shrinking the rays along their
  own axes, opens back to the symbol between letters, then turns it in 3D and loops (off with prefers-reduced-motion).
  It finds the rays by the order `assets/logo.svg` draws them; a style's own logo stays still.

## Open TODOs

Impressum data, Datenschutz text.
