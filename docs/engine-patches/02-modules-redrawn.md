# Engine patch 02: modules drawn again lose their behaviour

Found in the module audit (2026-10-17). For visitors `js/content.js` `applyStoredLayout` draws every library module
afresh (`fresh: !editor || restyle`) whenever content, the language or the style is applied, but it dispatches
`qs:layout` (on which `js/main.js` runs `initModules`) only when the sections' order or options change. The default
style is known only after start-up, so on every page load the modules are replaced by new nodes that never get their
scroll effects (stack, tether, horizontal, parallax, lit, pill), swipes, logo belts or hero videos.

Site workaround (kalq.ai): `js/kalq-site.js` part 1 dispatches `qs:layout` when a module section is added to a page's
container.

Engine fix: in `applyStoredLayout`, also dispatch `qs:layout` when any section node was replaced (compare the nodes,
not only the signature), or let `applyLayout` report whether it rendered fresh modules.
