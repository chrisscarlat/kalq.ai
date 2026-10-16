# Engine patch 05: the rail covers the page

Found in the module audit (2026-10-17). The 1.0 rail (`js/collab.js`, `.qs-rail` in `css/collab.scss`) floats over the
page's left edge for everyone through the gate. As a column it covered the first 240 px of every section for guests on
a desktop; icons only, it still cut off the start of every line on a phone (iPhone 13 mini). The page is not moved
aside (`--qs-rail-w` exists but nothing uses it), and moving it aside clips type that is sized to the screen (`vw`).

Site fix (kalq.ai `css/_site.scss`): where it would hide the page (guests everywhere, editors up to 700 px) the rail
folds to the person's face below the header and opens while pointed at, tapped or used. Its head stays on the same
spot folded and open: a first version anchored at the foot put the log-out button under the finger that opened it,
and one tap logged people out. A dot stands in for the face until presence has drawn it.

Engine fix: the same folding in collab.scss, or a rail that collapses to one button on phones; a regression test that
taps the rail's opener on a phone and checks the person is still signed in.
