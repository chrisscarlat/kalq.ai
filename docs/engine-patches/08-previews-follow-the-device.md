# Engine patch 08: module previews show the device's layout

Found in the module audit (2026-10-17). The picker's devices and the module panel's device window draw a module at a
device's width inside the editor's window. Modules are size containers (`css/components/_modules.scss`) and most of
their rules use `@container`, but some use `@media` on the window (`css/components/_final.scss`: heroes' row, cards,
bottom and note; lit stats; swipe cards; FAQ; results; pricing; services). In a 375 px preview inside a desktop window
those kept their desktop columns (measured: 2 or 3 columns where the phone has 1, in 6 of 7 modules).

Site fix (kalq.ai `css/_site.scss`): the same rules again as `@container (max-width: 999px | 690px)`.

Engine fix: write those rules as `@container` only (the page is unchanged: a module is as wide as the window there);
`.qs-f-sw__card { flex-basis: 72cqi; }` instead of `72vw`.
