# Overnight report, 2026-10-17

Local only: commits on `main` in kalq.ai-website, nothing pushed, production database untouched (all database work on
a throwaway local Postgres loaded with a read-only copy of the content).

## Done
1. **Q-Site v1.2.1** (`92b7061`): q-site check 15/15; every page's content against the old code: same.
2. **Browser test** runs on every `npm test` (`d180f63`, playwright-core 1.64.0 as a dev dependency). No install needed.
3. **Full suite**: engine 126/126, site 15/15. Fixed: legal pages without the code failed to load the style code (`9189d23`).
4. **Module audit**: 28 module versions, filled and empty, guest and editor, iPhone 13 mini, iPhone Duo vertical and
   horizontal, MacBook Pro 14: 360 sections, no page error, no sideways scroll. Fixed:
   - scroll modules never started for visitors (stack, tether, horizontal, lit, pill, swipes, belts) (`ab53db9`)
   - horizontal row: pinned stage fits the screen, every card's text and link stay visible; draggable by mouse,
     pen and finger, a drag never opens a link (`ab53db9`)
   - the rail covered the left of every section (240 px on desktop for guests, every line start on a phone): folds
     to your face and opens when pointed at or tapped (`d055e9d`)
   - empty-slot labels invisible on the accent colour (`d055e9d`)
   - background controls sat on the header; empty captions and long labels ran over fields (`fdba859`, `bb0aa93`)
   - phone previews in the picker showed desktop columns in 6 of 7 modules (`064fd93`)
5. **Statement**: the "))" and "Small portrait (optional)" were certil.com's own module (deleted 2026-10-08); Q-Site has
   no "))" (scanned, edit mode, DE and EN). Fixed the same symptoms in Statement that lights up (`d065ad2`).
6. **docs/GO_LIVE.md** (`71e0452`): backup, the 4 migrations, Vercel settings, preview, push. Not done.

## Decisions
- Fixes live in Kalq's own files (`css/_site.scss`, new `js/kalq-site.js`); each engine fix written up in
  `docs/engine-patches/01` to `08` for Q-Site.
- Stayed on 1.2.1 as asked. Real guest cookie for tests (the code's rate limit blocked repeated logins).
- Making room for the rail clipped the screen-sized type, so the rail folds instead. A first fold version put log
  out under the opening tap; caught in testing, fixed before commit.
- Title with three cards ends 53 px below a 14 inch screen: kept, the cards are meant to peek in.

## Still open
- "Text under the first card at the end" did not reproduce once the row worked; most likely the rail.
- iPhone Duo hinge and segments cannot be emulated headless: Duo sizes only.
- Editors on a desktop keep the full rail over the left edge (their workspace; fold with the rail's own button).
- Audit flags left are by design: stacked and tether cards cover each other, closed FAQ answers, the logo belt.
