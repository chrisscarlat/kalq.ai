# Engine patch 04: the pinned horizontal row fits the screen

Found in the module audit (2026-10-17). The armed `.qs-f-hs__pin` has `min-height: 100svh` and pins below the section's
top padding (`--f-pad-y`), and its cards keep a 4:5 picture. On a phone (iPhone 13 mini) and on short screens (iPhone
Duo held sideways, 626 px) the heading, the intro and the pictures filled the screen: every card's title, text and
link stayed below its bottom edge for the whole slide, and only the last card could be read, after the pin.

Site fix (kalq.ai `css/_site.scss`): the pinned stage is `calc(100svh - var(--f-pad-y))` high, the track takes the
rest and the pictures flex into it (min 4.5rem, max 62svh); on screens up to 720 px high the heading follows the
screen's height. Measured: the last link of a card is on the screen on all four audit devices.

Engine fix: the same rules in `css/components/_final.scss`.
