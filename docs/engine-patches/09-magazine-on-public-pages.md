# Engine patch 09: the magazine on a public site

Found when Kalq removed its gate (2026-10-19). `js/main.js` loads the magazine only on gated pages ("the book of the
gated pages"), and `js/magazine.js`, `js/book/*.js` and `js/vendor/page-flip.js` are served only with the gate cookie.
A site whose pages are all public (`"public": true` on every page) therefore has no magazine at all, on the iPhone Duo
or anywhere.

Site workaround (kalq.ai): site.config.json makes those files public (publicScripts "magazine", publicFiles js/book/*
and js/vendor/page-flip.js) and `js/kalq-site.js` part 6 starts the magazine on every page and after page changes, as
main.js does on gated pages.

Engine fix: load the magazine on public pages too when the site has no gated page (or always, now that its copy is the
site's public copy), with its files public in that case.
