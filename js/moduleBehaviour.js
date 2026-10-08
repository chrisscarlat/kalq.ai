// Behaviour of page builder modules and of the built-in sections on two screens. Everything works as plain HTML
// first; with this script:
//   the scroll modules (js/modules/final.js) get their effects (js/modules/scrollEffects.js): the testimonials'
//   pile, the stacking pinned cards, the horizontal scroll cards; under reduced motion and while editing they stay
//   plain stacked lists;
//   two screens (a device spanning both, css/utilities/_dual.scss): the platform list shows the picture of the row in
//   focus on the right screen.
// A foldable can change posture while the page is open: everything switches back and forth.
import { setupScrollEffect } from "./modules/scrollEffects.js";

const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");

//=================================== Two-screen panels ===================================//
// The platform list: the picture of the row in focus fills the right screen (the first row's to begin with)
function setupListPanel(section) {
    const rows = [...section.querySelectorAll(".elem[data-image]")];
    let panel = section.querySelector(":scope > .kalq-span-panel");
    if (!spanned.matches || !rows.length) { panel?.remove(); return; }
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "kalq-span-panel";
        panel.setAttribute("aria-hidden", "true");
        panel.append(Object.assign(document.createElement("img"), { alt: "" }));
        section.append(panel);
    }
    const img = panel.querySelector("img");
    const show = (row) => { const src = row.getAttribute("data-image"); if (src && img.getAttribute("src") !== src) img.setAttribute("src", src); };
    show(rows[0]);
    rows.forEach((row) => {
        if (row.dataset.spanReady) return;
        row.dataset.spanReady = "true";
        ["pointerenter", "focusin"].forEach((ev) => row.addEventListener(ev, () => show(row)));
    });
}

//=================================== Heroes ===================================//
// The hero with video (js/modules/final.js): it plays on its own, so it has a pause; under reduced motion it stays
// still (the pause then plays it)
const still = window.matchMedia("(prefers-reduced-motion: reduce)");
function setupHeroVideo(section) {
    const video = section.querySelector(".kalq-f-hero__media video");
    const button = section.querySelector(".kalq-f-hero__pause");
    if (!video || !button || button.dataset.ready) return;
    button.dataset.ready = "true";
    const show = () => { const paused = video.paused; button.classList.toggle("is-paused", paused); button.setAttribute("aria-label", button.dataset[paused ? "labelPlay" : "labelPause"]); button.setAttribute("aria-pressed", String(paused)); };
    if (still.matches) { video.removeAttribute("autoplay"); video.pause(); }
    else { video.muted = true; video.play()?.catch?.(() => { }); }
    button.addEventListener("click", () => { if (video.paused) video.play()?.catch?.(() => { }); else video.pause(); });
    video.addEventListener("play", show);
    video.addEventListener("pause", show);
    show();
}

//=================================== Video with a play pill ===================================//
// Nothing plays on its own: the pill plays the video with its sound and its controls, and pauses it
function setupPillVideo(section) {
    const video = section.querySelector(".kalq-f-pv__video");
    const pill = section.querySelector(".kalq-f-pv__pill");
    if (!video || !pill || pill.dataset.ready) return;
    pill.dataset.ready = "true";
    const text = pill.querySelector(".kalq-f-pv__pill-text");
    const show = () => { const playing = !video.paused; text.textContent = pill.dataset[playing ? "labelPause" : "labelPlay"]; pill.classList.toggle("is-playing", playing); pill.setAttribute("aria-pressed", String(playing)); };
    pill.addEventListener("click", () => { if (video.paused) { video.muted = false; video.controls = true; video.play()?.catch?.(() => { }); } else video.pause(); });
    video.addEventListener("play", show);
    video.addEventListener("pause", show);
    show();
}

//=================================== Cards to swipe ===================================//
// The row scrolls sideways natively (touch, trackpad, shift and wheel, the keyboard through the cards' focus); with a
// mouse it is dragged. A gesture that is mostly sideways is kept from the page's smooth scroller (which takes every
// wheel and touch move for the page); one mostly up or down still scrolls the page.
function setupSwipe(section) {
    const track = section.querySelector(".kalq-f-sw__track");
    if (!track || track.dataset.ready) return;
    track.dataset.ready = "true";
    let drag = null;
    track.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; drag = { x: e.clientX, left: track.scrollLeft, moved: false }; });
    window.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { drag.moved = true; track.classList.add("is-dragging"); } track.scrollLeft = drag.left - dx; });
    window.addEventListener("pointerup", () => { if (!drag) return; const moved = drag.moved; drag = null; track.classList.remove("is-dragging"); if (moved) track.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true }); });
    track.addEventListener("focusin", (e) => e.target.closest?.(".kalq-f-sw__card")?.scrollIntoView({ inline: "nearest", block: "nearest" }));
    track.addEventListener("dragstart", (e) => e.preventDefault()); // the pictures: the row moves, not a picture
}
let swipeGuard = false;
function guardSwipes() {
    if (swipeGuard) return;
    swipeGuard = true;
    let touch = null;
    window.addEventListener("wheel", (e) => { if (e.target instanceof Element && e.target.closest(".kalq-f-sw__track") && Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation(); }, { capture: true, passive: true });
    window.addEventListener("touchstart", (e) => { touch = e.target instanceof Element && e.target.closest(".kalq-f-sw__track") ? { x: e.touches[0].clientX, y: e.touches[0].clientY, side: null } : null; }, { capture: true, passive: true });
    window.addEventListener("touchmove", (e) => {
        if (!touch) return;
        if (touch.side === null) touch.side = Math.abs(e.touches[0].clientX - touch.x) > Math.abs(e.touches[0].clientY - touch.y);
        if (touch.side) e.stopPropagation();
    }, { capture: true, passive: true });
}

//=================================== Start ===================================//
export function initModules(root = document) {
    if (!document.body.classList.contains("kalq-edit")) root.querySelectorAll(".kalq-f[data-scroll-effect]").forEach(setupScrollEffect);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    root.querySelectorAll('section[data-hero]').forEach(setupHeroVideo);
    root.querySelectorAll("section[data-pill-video]").forEach(setupPillVideo);
    root.querySelectorAll("section[data-swipe]").forEach(setupSwipe);
    guardSwipes();
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
        document.addEventListener("kalq:layout", () => { // a module just inserted
            document.querySelectorAll("section[data-hero]").forEach(setupHeroVideo);
            document.querySelectorAll("section[data-pill-video]").forEach(setupPillVideo);
            document.querySelectorAll("section[data-swipe]").forEach(setupSwipe);
        });
    }
}
