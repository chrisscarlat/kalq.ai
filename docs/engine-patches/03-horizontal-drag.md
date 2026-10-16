# Engine patch 03: the horizontal card row by hand

Asked for in the module audit (2026-10-17). `scroll.horizontal` moves only with the page's scroll. While it is pinned,
the row moves one pixel per pixel scrolled, so a drag can scroll the page by the same distance within the pin.

Site version (kalq.ai): `js/kalq-site.js` part 2 (mouse and pen through pointer events, a finger through touch events,
since the browser cancels a touch's pointer events once the smooth scroller takes the gesture; up and down stay the
page's; a drag never opens a card's link) and the grab cursor in `css/_site.scss`.

Engine fix: the same inside `horizontal()` in `js/modules/scrollEffects.js`, where the ScrollTrigger is known, with
`st.start` and `st.end` as the limits.
