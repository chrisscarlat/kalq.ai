// Kalq's own additions on top of Q-Site, on every page (tools/build_pages.py), public so the legal pages have them too
// (site.config.json publicScripts). Each one is also written up for the engine in docs/engine-patches/.

// 1. Modules drawn again start working again (docs/engine-patches/02-modules-redrawn.md). For visitors the engine
// draws the page's library modules afresh whenever it applies content, the language or the style (js/content.js
// applyStoredLayout, fresh), but announces qs:layout, on which the modules start (js/main.js initModules), only when
// the sections' order or options change. The style is known only after the page has started, so the redrawn modules
// stayed without their scroll effects, swipes, belts and videos. Every section with a module added to a page's
// container now announces it once, the way the engine does for an inserted module.
let announced = false;
const announce = () => {
    if (announced) return;
    announced = true;
    requestAnimationFrame(() => { announced = false; document.dispatchEvent(new CustomEvent("qs:layout", { detail: { redrawn: true } })); });
};
new MutationObserver((records) => {
    for (const r of records) {
        if (!r.target.matches?.('[data-barba="container"]')) continue;
        if ([...r.addedNodes].some((n) => n.nodeType === 1 && n.matches("section[data-module]"))) return announce();
    }
}).observe(document.body, { childList: true, subtree: true });

// 2. The horizontal card row (scroll.horizontal) follows the hand as well as the scroll
// (docs/engine-patches/03-horizontal-drag.md). While it is pinned, its row moves one pixel for each pixel scrolled
// (js/modules/scrollEffects.js: the pin lasts as long as the row is wider than the screen), so dragging the row
// sideways scrolls the page by the same distance, back and forth within the pin, and the row moves with the hand.
// A drag never becomes a click on a card's link. On a touch screen only a sideways move drags; up and down scroll.
const bar = () => { const c = document.querySelector(".scrollbar-container"); return c && window.Scrollbar ? window.Scrollbar.get(c) : null; };
const scrollY = () => bar()?.offset.y ?? window.scrollY;
const setScroll = (y) => { const b = bar(); if (b) b.setPosition(0, y); else window.scrollTo(0, y); window.ScrollTrigger?.update(); };
let drag = null, suppressClick = false;

document.addEventListener("pointerdown", (e) => {
    const track = e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track");
    if (!track || e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0) || document.body.classList.contains("qs-edit")) return;
    const sec = track.closest("section");
    const top = scrollY() + sec.getBoundingClientRect().top; // where the pin starts
    const dist = Math.max(0, track.scrollWidth - track.clientWidth); // how far the pin lasts
    if (!dist) return;
    drag = { track, id: e.pointerId, x: e.clientX, y: e.clientY, from: scrollY(), min: top, max: top + dist, axis: null };
}, true);

document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (drag.axis === "y") { drag = null; return; } // up and down: the page scrolls as always
        drag.track.setPointerCapture?.(e.pointerId);
        drag.track.classList.add("is-dragging");
    }
    e.preventDefault();
    setScroll(Math.min(drag.max, Math.max(drag.min, drag.from - dx)));
}, { capture: true, passive: false });

const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.axis === "x") { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    drag.track.classList.remove("is-dragging");
    drag = null;
};
document.addEventListener("pointerup", end, true);
document.addEventListener("pointercancel", end, true);
document.addEventListener("click", (e) => {
    if (suppressClick && e.target.closest?.(".qs-f-hs__track")) { e.preventDefault(); e.stopPropagation(); }
}, true);
// the browser's own dragging of a card's picture or link would take the pointer away
document.addEventListener("dragstart", (e) => { if (e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track")) e.preventDefault(); }, true);

// A finger: the touch events (the browser cancels a touch's pointer events as soon as the page's smooth scroller takes
// the gesture). Once a move is clearly sideways it is the row's alone: the scroller never sees it.
const startDrag = (track, x, y) => {
    const sec = track.closest("section");
    const dist = Math.max(0, track.scrollWidth - track.clientWidth);
    if (!dist) return null;
    const top = scrollY() + sec.getBoundingClientRect().top;
    return { track, x, y, from: scrollY(), min: top, max: top + dist, axis: null };
};
let touch = null;
document.addEventListener("touchstart", (e) => {
    const track = e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track");
    touch = track && e.touches.length === 1 && !document.body.classList.contains("qs-edit") ? startDrag(track, e.touches[0].clientX, e.touches[0].clientY) : null;
}, { capture: true, passive: true });
document.addEventListener("touchmove", (e) => {
    if (!touch || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
    if (!touch.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        touch.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (touch.axis === "y") { touch = null; return; }
        touch.track.classList.add("is-dragging");
    }
    e.preventDefault();
    e.stopPropagation();
    setScroll(Math.min(touch.max, Math.max(touch.min, touch.from - dx)));
}, { capture: true, passive: false });
const endTouch = (e) => {
    if (!touch) return;
    if (touch.axis === "x") { e.stopPropagation(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); }
    touch.track.classList.remove("is-dragging");
    touch = null;
};
document.addEventListener("touchend", endTouch, true);
document.addEventListener("touchcancel", endTouch, true);
