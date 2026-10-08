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

//=================================== Logo belt ===================================//
// The belt moves by CSS only with motion allowed; its pause stops and restarts it
function setupLogoBelt(section) {
    const pause = section.querySelector(".kalq-f-logos__pause");
    if (!pause || pause.dataset.ready) return;
    pause.dataset.ready = "true";
    const labels = { de: ["Logos anhalten", "Logos weiterlaufen lassen"], en: ["Pause the logos", "Play the logos"] }[document.documentElement.lang === "en" ? "en" : "de"];
    pause.addEventListener("click", () => {
        const stopped = section.classList.toggle("is-paused");
        pause.setAttribute("aria-pressed", String(stopped));
        pause.setAttribute("aria-label", labels[stopped ? 1 : 0]);
    });
}

//=================================== Project list ===================================//
// A row's picture follows the pointer while it is over the row (a mouse only; decoration, the title is the link)
function setupFollow(section) {
    if (section.dataset.followReady) return;
    section.dataset.followReady = "true";
    const img = Object.assign(document.createElement("img"), { alt: "", className: "kalq-f-pl__follow" });
    img.setAttribute("aria-hidden", "true");
    section.append(img);
    section.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const row = e.target.closest?.("[data-follow-src]");
        if (!row) { img.classList.remove("is-on"); return; }
        if (img.getAttribute("src") !== row.dataset.followSrc) img.setAttribute("src", row.dataset.followSrc);
        const r = section.getBoundingClientRect();
        img.style.transform = `translate(${Math.round(e.clientX - r.left)}px, ${Math.round(e.clientY - r.top)}px) translate(-50%, -50%)`;
        img.classList.add("is-on");
    });
    section.addEventListener("pointerleave", () => img.classList.remove("is-on"));
}

//=================================== Testimonial slider ===================================//
// One quote at a time: the arrows and the counter; the others stay in the page, hidden (nothing moves by itself)
function setupSlider(section) {
    const slides = [...section.querySelectorAll(".kalq-f-sl__slide")];
    if (slides.length < 2 || section.dataset.sliderReady || document.body.classList.contains("kalq-edit")) return;
    section.dataset.sliderReady = "true";
    const en = document.documentElement.lang === "en";
    const button = (dir) => { const b = document.createElement("button"); b.type = "button"; b.className = `kalq-f-sl__arrow is-${dir}`; b.setAttribute("aria-label", dir === "prev" ? (en ? "Previous quote" : "Vorheriges Zitat") : (en ? "Next quote" : "Nächstes Zitat")); return b; };
    const prev = button("prev"), next = button("next");
    const count = document.createElement("p");
    count.className = "kalq-f-sl__count";
    count.setAttribute("aria-live", "polite");
    let at = 0;
    const show = (i) => {
        at = (i + slides.length) % slides.length;
        slides.forEach((sl, k) => { sl.hidden = k !== at; });
        count.textContent = `${at + 1} / ${slides.length}`;
    };
    prev.addEventListener("click", () => show(at - 1));
    next.addEventListener("click", () => show(at + 1));
    section.querySelector(".kalq-f-sl__inner").append(prev, next, count);
    section.classList.add("is-sliding");
    show(0);
}

//=================================== Person cards with video ===================================//
// A card's play button puts the person's video in the card, with its controls, and plays it (nothing plays on its own)
function setupVideoCards(section) {
    if (section.dataset.vcReady) return;
    section.dataset.vcReady = "true";
    section.addEventListener("click", (e) => {
        const play = e.target.closest?.(".kalq-f-vc__play");
        if (!play) return;
        const card = play.closest(".kalq-f-vc__card");
        const video = Object.assign(document.createElement("video"), { src: play.dataset.video, controls: true, playsInline: true, className: "kalq-f-vc__video" });
        card.querySelector(".kalq-f-vc__media")?.remove();
        card.prepend(video);
        card.classList.add("is-playing");
        play.remove();
        video.play()?.catch?.(() => { });
        video.focus();
    });
}

//=================================== Start ===================================//
export function initModules(root = document) {
    if (!document.body.classList.contains("kalq-edit")) root.querySelectorAll(".kalq-f[data-scroll-effect]").forEach(setupScrollEffect);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    root.querySelectorAll('section[data-hero]').forEach(setupHeroVideo);
    root.querySelectorAll("section[data-pill-video]").forEach(setupPillVideo);
    root.querySelectorAll("section[data-swipe]").forEach(setupSwipe);
    guardSwipes();
    root.querySelectorAll(".kalq-f-logos.is-belt").forEach(setupLogoBelt);
    root.querySelectorAll("section[data-follow]").forEach(setupFollow);
    root.querySelectorAll("section[data-slider]").forEach(setupSlider);
    root.querySelectorAll(".kalq-f-vc").forEach(setupVideoCards);
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
        document.addEventListener("kalq:layout", () => { // a module just inserted
            document.querySelectorAll("section[data-hero]").forEach(setupHeroVideo);
            document.querySelectorAll("section[data-pill-video]").forEach(setupPillVideo);
            document.querySelectorAll("section[data-swipe]").forEach(setupSwipe);
            document.querySelectorAll(".kalq-f-logos.is-belt").forEach(setupLogoBelt);
            document.querySelectorAll("section[data-follow]").forEach(setupFollow);
            document.querySelectorAll("section[data-slider]").forEach(setupSlider);
            document.querySelectorAll(".kalq-f-vc").forEach(setupVideoCards);
        });
    }
}
