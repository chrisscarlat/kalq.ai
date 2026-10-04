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

//=================================== Logo belt ===================================//
// The row drifts by CSS; here: the pause button, and still while off screen (no work for nothing)
const en = () => document.documentElement.lang === "en";
function setupBelt(belt) {
    const pause = belt.querySelector(".kalq-m-belt__pause");
    if (pause) {
        pause.setAttribute("aria-label", en() ? "Pause the logos" : "Laufband anhalten");
        if (!pause.dataset.ready) {
            pause.dataset.ready = "true";
            pause.addEventListener("click", () => {
                const on = pause.getAttribute("aria-pressed") !== "true";
                pause.setAttribute("aria-pressed", on);
                belt.classList.toggle("is-paused", on);
            });
        }
    }
    if (!belt.dataset.watched && "IntersectionObserver" in window) {
        belt.dataset.watched = "true";
        new IntersectionObserver(([e]) => belt.classList.toggle("is-offscreen", !e.isIntersecting)).observe(belt);
    }
}

//=================================== Hero ===================================//
// The title rises in, word by word (the words stay the h1's own text, only wrapped); the rotating word turns every
// 2.5 s; a video plays muted. One pause control stops all of it. Under reduced motion all is still and complete.
function words(el) {
    if (el.dataset.split) return;
    el.dataset.split = "true";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest(".kalq-sr") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const texts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
    let i = 0;
    texts.forEach((n) => {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const w = document.createElement("span");
            w.className = "kalq-word";
            w.style.setProperty("--i", i++);
            w.textContent = part;
            frag.append(w);
        });
        n.replaceWith(frag);
    });
}

// The rotating word: the word in the title keeps its text (the h1 stays the sentence); what turns is drawn by CSS
// over it (::after, from data-word), so no other word ever becomes part of the heading's text
function rotate(title, hero) {
    let list;
    try { list = JSON.parse(title.dataset.rotate || "[]"); } catch { list = []; }
    if (list.length < 2 || title.querySelector(".kalq-m-hero__rot") || reducedMotion.matches) return;
    const word = [...title.querySelectorAll(".kalq-word")].find((w) => w.textContent.replace(/[^\p{L}\p{N}-]/gu, "") === list[0]);
    if (!word) return;
    // each word's own width, so the line closes up around the shorter ones (the width eases from one to the next)
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    title.append(probe);
    const widths = list.map((w) => { probe.textContent = w; return Math.ceil(probe.getBoundingClientRect().width); });
    probe.remove();
    word.classList.add("kalq-m-hero__rot");
    word.style.width = `${widths[0]}px`;
    word.dataset.word = list[0];
    let n = 0;
    hero.rotateTimer = setInterval(() => {
        if (hero.classList.contains("is-paused") || !word.isConnected) return;
        word.classList.add("is-out");
        setTimeout(() => {
            n = (n + 1) % list.length;
            word.dataset.word = list[n];
            word.style.width = `${widths[n]}px`;
            word.classList.remove("is-out");
            word.classList.add("is-in");
            requestAnimationFrame(() => requestAnimationFrame(() => word.classList.remove("is-in")));
        }, 320);
    }, 2500);
}

function setupHero(hero) {
    const title = hero.querySelector(".kalq-m-hero__title");
    if (!document.body.classList.contains("kalq-edit") && title && !hero.dataset.ready) {
        hero.dataset.ready = "true";
        if (!reducedMotion.matches) { words(title); hero.classList.add("is-entering"); }
        else words(title);
        rotate(title, hero);
    }
    const video = hero.querySelector(".kalq-m-hero__media video");
    if (video) { video.muted = true; if (reducedMotion.matches) video.pause(); }
    const pause = hero.querySelector(".kalq-m-hero__pause");
    if (pause) {
        pause.setAttribute("aria-label", en() ? "Pause the motion" : "Bewegung anhalten");
        const still = reducedMotion.matches;
        if (still) { pause.setAttribute("aria-pressed", "true"); hero.classList.add("is-paused"); }
        if (!pause.dataset.ready) {
            pause.dataset.ready = "true";
            pause.addEventListener("click", () => {
                const on = pause.getAttribute("aria-pressed") !== "true";
                pause.setAttribute("aria-pressed", on);
                hero.classList.toggle("is-paused", on);
                if (video) on ? video.pause() : video.play?.()?.catch(() => { });
            });
        }
    }
    const next = hero.querySelector(".kalq-m-hero__next");
    if (next) next.setAttribute("aria-label", en() ? "To the next section" : "Zum nächsten Abschnitt");
}

//=================================== Start ===================================//
export function initModules(root = document) {
    const container = [...root.querySelectorAll('[data-barba="container"]')].pop();
    root.querySelectorAll(".kalq-m-faq").forEach(setupFaq);
    root.querySelectorAll(".kalq-m-belt").forEach(setupBelt);
    root.querySelectorAll(".kalq-m-hero").forEach(setupHero);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    if (container) setupScreen2(container);
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
        document.addEventListener("kalq:language", () => initModules()); // the controls' labels
    }
}
