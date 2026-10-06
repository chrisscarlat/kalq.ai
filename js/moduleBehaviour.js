// Behaviour of page builder modules and of the built-in sections on two screens. Everything works as plain HTML
// first; with this script:
//   the inquiry chat (js/modules/chat.js) plays its questions as a conversation (js/modules/chatBehaviour.js);
//   the scroll modules (js/modules/final.js) get their effects (js/modules/scrollEffects.js): the testimonials'
//   pile, the stacking pinned cards, the horizontal scroll cards; under reduced motion and while editing they stay
//   plain stacked lists;
//   two screens (a device spanning both, css/utilities/_dual.scss): the platform list shows the picture of the row in
//   focus on the right screen.
// A foldable can change posture while the page is open: everything switches back and forth.
import { setupScrollEffect } from "./modules/scrollEffects.js";
import { setupChat } from "./modules/chatBehaviour.js";

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

//=================================== Start ===================================//
export function initModules(root = document) {
    if (!document.body.classList.contains("kalq-edit")) root.querySelectorAll(".kalq-f[data-scroll-effect]").forEach(setupScrollEffect);
    root.querySelectorAll(".kalq-m-chat[data-chat]").forEach(setupChat);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
        document.addEventListener("kalq:language", () => initModules()); // the chat's labels follow the language
    }
}
