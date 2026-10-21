# Engine patch 10: the menus' login entry

Found 2026-10-21. `js/loginKey.js` (1.4) appends a `.qs-login-item` ("Anmelden" with the key, "Abmelden" once signed
in) to the bottom of `#site-menu` and of `.site-nav`. The header already has the key (signed in: the person's avatar,
which opens the card with Log out), so the menus showed a second entrance. In the panel menu (`html.menu-panels`,
`css/components/_menu.scss`) `#site-menu` is a flex row: the entry became a fourth box at `width: 100%`, which pushed
the three panels from the right edge into the middle of the screen and shrank them from 240 px to about 130 px.

Site fix (kalq.ai `css/_site.scss`): `.qs-login-item` is not shown; signing in and out goes through the header's key.

Engine fix: a site setting for the menus' entry (off by default when the header has the key), and in the panel menu
keep anything that is not a page link out of the row (`html.menu-panels .site-menu > :not(a)`).
