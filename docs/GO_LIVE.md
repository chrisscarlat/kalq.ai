# kalq.ai on Q-Site: going live

Prepared 2026-10-17, not done. Everything below changes the live site or its database; do it in this order, from the
`kalq.ai-website` folder, on `main` as committed locally (Q-Site v1.2.1). Nothing here has been run against
production. Steps 2 to 4 are reversible as noted; step 5 is the switch.

## 1. Before anything: a backup

- Supabase dashboard, Kalq's project: Database, Backups. Note the newest backup's time, or take a fresh one.
- Optional, read only: `pg_dump --schema-only` of the project, to compare afterwards.

## 2. The database: the engine's four new migrations

Kalq's project has the schema of its seven migrations (archived in `supabase/archive/migrations-before-q-site/`).
Q-Site 1.2.1 adds four. All four are additive and idempotent (tested twice in a row on a local copy with Kalq's
production content: `latest_content` identical for every page afterwards). The site as it runs today keeps working
with them, so this step can go first.

Write them with Kalq's own sign-in message in the signup hook:

    npx q-site migrations /tmp/kalq-migrations
    ls /tmp/kalq-migrations/supabase/migrations

Apply, in this order, only these four:

1. `20261009120000_engine_constraints.sql`: block types (text, image, video, layout) and `text/plain` for `site-media`
2. `20261015090000_publish.sql`: `page_publications` and `published_content` (unused while `publishing` is off)
3. `20261016090000_domain_invites.sql`: `domain_invites`, `access_requests`, `access_revocations`; re-creates
   `is_allowed_editor_email`, `auth_role`, `hook_before_user_created` (same answers as today, plus revocations)
4. `20261016120000_account_links.sql`: `account_links`, `account_signouts` (unused until `account` is set)

How:

- **SQL editor (safe in every case):** paste each file in the order above and run it.
- **`supabase db push`:** only if the project's migration history already lists the seven old versions. Check first
  (read only): `select version from supabase_migrations.schema_migrations order by 1;`. If they are all there, put
  the four files after the seven in a workdir and run
  `supabase db push --workdir /tmp/kalq-migrations --db-url "<Kalq's database URL>"`. If they are missing, the push
  would run all eleven again: use the SQL editor instead.

Check afterwards (read only): `select count(*) from public.page_publications;` answers 0, and the live site still
shows its content.

Undo: not needed (only new tables and functions with the same behaviour); the backup from step 1 covers the rest.

## 3. Vercel: project `kalq.ai`

Settings, General (`vercel.json` sets these too and wins; keep the dashboard in step):

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `.` |
| Install Command | `sh tools/vercel-install.sh` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 24.x (the engine needs 20 or later) |

Settings, Environment Variables (Production and Preview):

| Variable | Change |
| --- | --- |
| `Q_SITE_GITHUB_TOKEN` | **new**: a fine-grained GitHub token, read-only (Contents: Read) on `chrisscarlat/q-site` only. Without it the install cannot fetch the private engine and the build fails. |
| `ACCESS_CODE`, `GATE_COOKIE_SECRET`, `IP_HASH_SALT` | unchanged |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | unchanged |

Nothing else changes: same domains, same Supabase project. The middleware runs on Node.js (set in `middleware.js`).

## 4. A preview first

    npx vercel link            # once: this folder has no .vercel yet; choose the project kalq.ai
    npx vercel deploy          # a Preview deployment from this folder, production untouched

On the preview URL: the gate (code and Google), every page in German and `?lang=en`, Impressum and Datenschutz without
the code, the editor's rail and Text and images, a scroll module if one is placed. Undo: nothing to undo.

## 5. The switch

    git push origin main

Vercel builds `main` for production. Undo: Vercel, Deployments, the previous production deployment, Instant Rollback
(the database from step 2 serves both).

## After the switch: what people notice

- **Everyone signs in again once.** The gate cookie is `qs_gate` now (was `kalq_gate`): guests enter the code, editors
  log in with Google or LinkedIn again.
- Choices kept in the browser start fresh once: language, light or dark, the last style (`qs-*` instead of `kalq-*`).
- Signed-in visitors get the engine's rail on the left (comment, history, log out; the tools for editors). See
  `docs/OVERNIGHT_REPORT.md` for what it covers on small screens.
