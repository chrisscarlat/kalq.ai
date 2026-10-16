# Engine patch 06: text placeholders in a fixed blue

Found in the module audit (2026-10-17). `.qs-ph:empty::before` (`css/collab.scss`) draws an empty slot's label in
`#3B82F6`, the default accent: on the accent colour (Big title on colour, `heroes.statement`) an empty module showed
editors a plain blue screen; over pictures and on dark sections the labels were faint. The picture placeholders already
use `currentColor`.

Site fix (kalq.ai `css/_site.scss`): label and dashed outline in `currentColor` (60 %, outline 55 %).

Engine fix: the same in `css/collab.scss`.
