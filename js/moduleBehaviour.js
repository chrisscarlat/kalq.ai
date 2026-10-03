// Behaviour of page builder modules and of the built-in sections on two screens. Everything works as plain HTML
// first: FAQ answers are in the page and visible. With this script:
//   one screen: the FAQ folds into an accordion (the first answer open);
//   two screens (a device spanning both, css/utilities/_dual.scss): the FAQ questions become tabs on the left screen
//   and the selected answer fills the right one; the platform list shows the picture of the row in focus on the right
//   screen; call-to-action bands show their picture on the right screen.
// A foldable can change posture while the page is open: everything switches back and forth.
import { fillScreen2 } from "./modules/registry.js";

const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

//=================================== FAQ ===================================//
function faqParts(faq) {
    return [...faq.querySelectorAll(".kalq-m-faq__toggle")].map((toggle) => {
        const answer = faq.querySelector(`#${CSS.escape(toggle.getAttribute("aria-controls"))}`);
        if (!toggle.id) toggle.id = `${toggle.getAttribute("aria-controls")}-q`;
        return { toggle, answer };
    }).filter((p) => p.answer);
}

function accordion(faq) {
    const parts = faqParts(faq);
    faq.classList.remove("is-tabs");
    faq.querySelector(".kalq-m-faq__list")?.removeAttribute("role");
    faq.querySelector(".kalq-m-faq__list")?.removeAttribute("aria-orientation");
    parts.forEach(({ toggle, answer }, i) => {
        ["role", "aria-selected", "tabindex"].forEach((a) => toggle.removeAttribute(a));
        ["role", "aria-labelledby", "tabindex"].forEach((a) => answer.removeAttribute(a));
        toggle.parentElement.removeAttribute("role"); // the <h3>
        const open = i === 0;
        toggle.setAttribute("aria-expanded", open);
        answer.hidden = !open;
    });
}

// Questions as vertical tabs (arrow keys, Home, End), the selected answer as its panel
function tabs(faq) {
    const parts = faqParts(faq);
    faq.classList.add("is-tabs");
    const list = faq.querySelector(".kalq-m-faq__list");
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-orientation", "vertical");
    const select = (index, focus) => parts.forEach(({ toggle, answer }, i) => {
        const on = i === index;
        toggle.setAttribute("aria-selected", on);
        toggle.tabIndex = on ? 0 : -1;
        answer.hidden = !on;
        if (on && focus) toggle.focus();
    });
    parts.forEach(({ toggle, answer }) => {
        toggle.removeAttribute("aria-expanded");
        toggle.setAttribute("role", "tab");
        toggle.parentElement.setAttribute("role", "presentation"); // the <h3> around a tab
        answer.setAttribute("role", "tabpanel");
        answer.setAttribute("aria-labelledby", toggle.id);
        answer.tabIndex = 0;
    });
    const current = parts.findIndex(({ toggle }) => toggle.getAttribute("aria-selected") === "true");
    select(current < 0 ? 0 : current, false);
}

function setupFaq(faq) {
    if (!faq.dataset.ready) {
        faq.dataset.ready = "true";
        faq.addEventListener("click", (e) => {
            const toggle = e.target.closest(".kalq-m-faq__toggle");
            if (!toggle) return;
            const parts = faqParts(faq);
            const i = parts.findIndex((p) => p.toggle === toggle);
            if (faq.classList.contains("is-tabs")) {
                parts.forEach(({ toggle: t, answer }, j) => { t.setAttribute("aria-selected", j === i); t.tabIndex = j === i ? 0 : -1; answer.hidden = j !== i; });
            } else {
                const open = toggle.getAttribute("aria-expanded") !== "true";
                toggle.setAttribute("aria-expanded", open);
                parts[i].answer.hidden = !open;
            }
            window.dispatchEvent(new Event("resize")); // the smooth scroller measures the page again
        });
        faq.addEventListener("keydown", (e) => {
            if (!faq.classList.contains("is-tabs") || !e.target.closest(".kalq-m-faq__toggle")) return;
            const parts = faqParts(faq);
            const i = parts.findIndex((p) => p.toggle === e.target.closest(".kalq-m-faq__toggle"));
            const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: parts.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const j = (next + parts.length) % parts.length;
            parts[j].toggle.click();
            parts[j].toggle.focus();
        });
    }
    if (spanned.matches) tabs(faq); else accordion(faq);
}

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

// Call-to-action bands: their right-screen picture plays only while it is shown
function setupScreen2(container) {
    fillScreen2(container, document);
    container.querySelectorAll(".kalq-m-cta__screen2 video").forEach((v) => {
        if (spanned.matches && !reducedMotion.matches) { v.muted = true; v.play?.()?.catch(() => { }); }
        else v.pause?.();
    });
}

//=================================== Start ===================================//
export function initModules(root = document) {
    const container = [...root.querySelectorAll('[data-barba="container"]')].pop();
    root.querySelectorAll(".kalq-m-faq").forEach(setupFaq);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    if (container) setupScreen2(container);
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
    }
}
