# Engine patch 01: lookParts.js must be public

Found while porting Kalq (2026-10-17). `js/variants.js` imports `js/lookParts.js` statically (0.9.4), but
`lookParts` is not in `ENGINE_SCRIPTS` in `middleware.js`. On the public legal pages, without the gate cookie, the
browser gets 401 for `/js/lookParts.js`, so `variants.js` and everything that imports it fail to load.

Site workaround (kalq.ai): `"publicScripts": ["lookParts"]` in site.config.json.

Engine fix (q-site `middleware.js`): add `"lookParts"` to `ENGINE_SCRIPTS`; a site check that loads every public
page without the cookie and fails on any 401 for a file under `/js/` would have caught it.
