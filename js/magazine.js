// Magazine mode (prototype, branch only): the page as a book whose pages turn under a finger (StPageFlip 2.0.7,
// js/vendor). An optional enhancement over the normal readable page: built from it on demand, so every word is still
// in the page itself, without JavaScript too. Opens by itself on a device spanning two screens (the spine on the
// hinge, one page per screen); on a plain tablet a button in the header opens it.
//   hard front cover: the hero; pages: the sections' own headings, paragraphs, lists, pictures and buttons, in order,
//   never split (an element taller than a page makes that page scroll inside); hard back cover: the wordmark.
//   turn: drag a page with a finger, arrow keys, Page Up/Down, Home/End, or the buttons; Esc or the close button
//   returns to the page at the same place. Reduced motion: pages change without the turning animation.
import { currentLang } from "./i18n.js";

const PAGES_ON = new Set(["home", "platform", "company"]);
const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const tablet = window.matchMedia("(pointer: coarse) and (min-width: 600px) and (max-width: 1366px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const TEXT = {
    de: { open: "Als Magazin lesen", close: "Als Webseite lesen", prev: "Vorherige Seite", next: "Nächste Seite", book: "Magazin", page: (n, of) => `Seite ${n} von ${of}` },
    en: { open: "Read as a magazine", close: "Read as a web page", prev: "Previous page", next: "Next page", book: "Magazine", page: (n, of) => `Page ${n} of ${of}` },
};
const t = (k) => TEXT[currentLang() === "en" ? "en" : "de"][k];

let book = null; // { overlay, flip, pages, closedByUser }
let closedByUser = false;

const container = () => [...document.querySelectorAll('[data-barba="container"]')].pop();
const pageName = () => container()?.dataset.page;

//=================================== The engine ===================================//
let engine = null;
function loadEngine() {
    if (window.St?.PageFlip) return Promise.resolve(window.St);
    engine ||= new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "js/vendor/page-flip.js";
        s.onload = () => resolve(window.St);
        s.onerror = reject;
        document.head.append(s);
    });
    return engine;
}

//=================================== Content ===================================//
// The readable elements of a section, outermost only, in order; decoration, editing tools and placeholders left out
const BLOCKS = "h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, img, video, .kalq-m-button, a.btn, .kalq-m-faq__item";
const SKIP = "[aria-hidden='true'], .marquee, .kalq-section-tools, .kalq-inserts, .kalq-ph, .kalq-media-tools, template, .kalq-m-cta__screen2, .overlay, .kalq-span-panel, script, style";

function blocksOf(section) {
    const taken = [];
    section.querySelectorAll(BLOCKS).forEach((el) => {
        if (el.closest(SKIP) || taken.some((t) => t.contains(el))) return;
        const media = el.matches("img, video");
        if (!media && !el.textContent.trim()) return;
        if (media && !(el.getAttribute("src") || el.querySelector("source")?.getAttribute("src"))) return;
        taken.push(el);
    });
    return taken;
}

// A clean copy: no ids, keys or scripts' hooks, links keep working, media without autoplay
function copyOf(el) {
    const c = el.cloneNode(true);
    [c, ...c.querySelectorAll("*")].forEach((n) => {
        ["id", "data-kalq-key", "data-i18n", "contenteditable", "style", "data-kalq-animated"].forEach((a) => n.removeAttribute(a));
        n.classList?.remove("kalq-flash", "kalq-section-selected");
    });
    if (c.matches("video")) {
        const src = el.getAttribute("src") || el.querySelector("source")?.getAttribute("src");
        c.replaceChildren();
        c.setAttribute("src", src);
        ["muted", "loop", "playsinline"].forEach((a) => c.setAttribute(a, ""));
        c.removeAttribute("autoplay");
        c.setAttribute("preload", "metadata");
    }
    if (c.matches("img")) c.removeAttribute("loading");
    if (c.matches(".kalq-m-faq__item")) {
        c.querySelectorAll(".kalq-m-faq__a").forEach((a) => { a.hidden = false; a.removeAttribute("role"); });
        c.querySelectorAll(".kalq-m-faq__toggle").forEach((b) => { const h = document.createElement("span"); h.append(...b.childNodes); b.replaceWith(h); });
    }
    return c;
}

// Fill pages of the given size with whole elements: one goes to the next page if it does not fit; a single element
// taller than a page gets the page to itself and the page scrolls
function paginate(measure, blocks, pageW, pageH) {
    const pages = [];
    let current = null;
    const fresh = () => {
        const p = document.createElement("div");
        p.className = "kalq-mag-page";
        p.style.width = `${pageW}px`;
        p.style.height = `${pageH}px`;
        const body = document.createElement("div");
        body.className = "kalq-mag-page__body";
        p.append(body);
        measure.append(p);
        pages.push(p);
        return body;
    };
    blocks.forEach((block) => {
        if (block === "break") { current = null; return; } // each section starts on a new page
        current ||= fresh();
        current.append(block);
        if (current.scrollHeight > current.clientHeight + 1 && current.children.length > 1) {
            block.remove();
            current = fresh();
            current.append(block);
        }
        if (current.scrollHeight > current.clientHeight + 1) { current.parentElement.classList.add("is-scroll"); current = null; }
    });
    return pages;
}

function cover(section, pageW, pageH, back) {
    const p = document.createElement("div");
    p.className = `kalq-mag-page is-cover${back ? " is-back" : ""}`;
    p.setAttribute("data-density", "hard");
    p.style.width = `${pageW}px`;
    p.style.height = `${pageH}px`;
    if (back) {
        const mark = document.querySelector(".hero_title svg, .site-logo__word svg")?.cloneNode(true);
        if (mark) { mark.removeAttribute("role"); mark.setAttribute("aria-hidden", "true"); p.append(mark); }
        return p;
    }
    // the hero: its picture or video and its title and slogan
    const media = section?.querySelector("video, .hero_media img, .hero_media video");
    if (media) p.append(copyOf(media));
    const shade = document.createElement("div");
    shade.className = "kalq-mag-cover__shade";
    p.append(shade);
    const text = document.createElement("div");
    text.className = "kalq-mag-cover__text";
    section?.querySelectorAll(".hero_title, .hero_slogan, h1, h2").forEach((el) => { if (!text.querySelector(el.tagName) && el.textContent.trim()) text.append(copyOf(el)); });
    p.append(text);
    return p;
}

//=================================== Open and close ===================================//
function geometry() {
    if (spanned.matches) {
        // one page per screen, the spine in the middle of the hinge
        const w = Math.floor(window.innerWidth / 2), h = window.innerHeight;
        return { pageW: w, pageH: h, portrait: false, hinge: Math.max(0, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--seg-hinge")) || 0) };
    }
    const landscape = window.innerWidth > window.innerHeight;
    const h = window.innerHeight - 96;
    const w = landscape ? Math.min(Math.floor((window.innerWidth - 48) / 2), Math.round(h * 0.75)) : Math.min(window.innerWidth - 32, Math.round(h * 0.72));
    return { pageW: w, pageH: h, portrait: !landscape, hinge: 0 };
}

// Only one book at a time: a second request while one is being built (page start and a posture change can come
// together) waits for the first
let opening = null;
export function openMagazine(options = {}) {
    opening ||= build(options).finally(() => { opening = null; });
    return opening;
}

async function build({ auto = false } = {}) {
    if (book || !PAGES_ON.has(pageName())) return;
    if (auto && closedByUser) return;
    const St = await loadEngine().catch(() => null);
    if (!St?.PageFlip || book) return;
    const page = container();
    const sections = [...page.querySelectorAll(":scope > section[data-section]")].filter((s) => s.dataset.sectionState !== "draft");
    const { pageW, pageH, portrait, hinge } = geometry();

    const overlay = document.createElement("div");
    overlay.className = "kalq-magazine";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", t("book"));
    overlay.style.setProperty("--kalq-mag-hinge", `${hinge}px`);
    if (spanned.matches) overlay.classList.add("is-spanned");
    const stage = document.createElement("div");
    stage.className = "kalq-magazine__book";
    // measure pages off screen at their real size, then hand them to the engine
    const measure = document.createElement("div");
    measure.className = "kalq-magazine__measure";
    overlay.append(stage, measure);
    document.body.append(overlay);

    const hero = sections.find((s) => s.matches(".header, .expertise_header, .about_header"));
    const blocks = [];
    sections.filter((s) => s !== hero).forEach((s) => { blocks.push("break"); blocksOf(s).forEach((el) => blocks.push(copyOf(el))); });
    const footer = page.querySelector("footer");
    if (footer) { blocks.push("break"); blocksOf(footer).forEach((el) => blocks.push(copyOf(el))); }
    const inner = paginate(measure, blocks, pageW, pageH);
    // an even number of inner pages, so the back cover closes the book
    if (inner.length % 2 === 1) inner.push(Object.assign(document.createElement("div"), { className: "kalq-mag-page is-blank" }));
    const pages = [cover(hero, pageW, pageH, false), ...inner, cover(null, pageW, pageH, true)];
    pages.forEach((p, i) => {
        p.tabIndex = -1;
        p.style.width = `${pageW}px`;
        p.style.height = `${pageH}px`;
        p.dataset.side = i % 2 ? "left" : "right"; // after the single front cover, pages alternate left, right
        p.setAttribute("role", "group");
        p.setAttribute("aria-roledescription", "page");
        p.setAttribute("aria-label", t("page")(i + 1, pages.length));
        stage.append(p);
    });
    measure.remove();

    const flip = new St.PageFlip(stage, {
        width: pageW, height: pageH, size: "fixed", showCover: true, usePortrait: portrait, autoSize: false,
        drawShadow: !reducedMotion.matches, maxShadowOpacity: 0.35, flippingTime: reducedMotion.matches ? 1 : 750,
        showPageCorners: !reducedMotion.matches, disableFlipByClick: true, mobileScrollSupport: false, swipeDistance: 24,
        startPage: 0, startZIndex: 2,
    });
    flip.loadFromHTML(pages);

    // Controls: close, previous, next (for mouse and keyboard; fingers drag the pages)
    const bar = document.createElement("div");
    bar.className = "kalq-magazine__bar";
    const button = (cls, label, fn, html) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `kalq-magazine__btn ${cls}`;
        b.setAttribute("aria-label", label);
        b.title = label;
        b.innerHTML = html;
        b.addEventListener("click", fn);
        return b;
    };
    const prev = button("is-prev", t("prev"), () => flip.flipPrev(), "&larr;");
    const next = button("is-next", t("next"), () => flip.flipNext(), "&rarr;");
    const status = document.createElement("span");
    status.className = "kalq-magazine__status";
    status.setAttribute("aria-live", "polite");
    const close = button("is-close", t("close"), () => closeMagazine(true), `<span>${t("close")}</span>`);
    bar.append(close, prev, status, next);
    overlay.append(bar);

    const update = () => {
        const i = flip.getCurrentPageIndex();
        status.textContent = t("page")(i + 1, pages.length);
        prev.disabled = i <= 0;
        next.disabled = i >= pages.length - 1;
        // only what is shown is reachable and playing
        pages.forEach((p) => {
            const shown = p.style.display !== "none" && p.closest(".stf__item, .stf__parent") && getComputedStyle(p).display !== "none";
            p.inert = !shown;
            p.querySelectorAll("video").forEach((v) => (shown && !reducedMotion.matches ? v.play?.()?.catch(() => { }) : v.pause()));
        });
    };
    flip.on("flip", () => { update(); overlay.querySelector(".kalq-mag-page:not([inert]) :is(h1, h2, h3, p)")?.closest(".kalq-mag-page")?.focus?.(); });
    flip.on("changeState", update);
    setTimeout(update, 50);

    // Keys work wherever focus is while the book is open (after a drag it sits on the page body); the site's own
    // shortcuts stay out of the book
    const onKey = (e) => {
        if (e.target.closest?.("input, textarea, [contenteditable='true']")) return;
        const step = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
        const act = step ? () => (step > 0 ? flip.flipNext() : flip.flipPrev())
            : e.key === "Home" ? () => { flip.turnToPage(0); update(); }
            : e.key === "End" ? () => { flip.turnToPage(pages.length - 1); update(); }
            : e.key === "Escape" ? () => closeMagazine(true) : null;
        if (!act) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        act();
    };
    document.addEventListener("keydown", onKey, true);
    // The engine follows the finger through touchmove and touchend on the window, which the site's smooth scroller
    // stops at the document on the way up. Hand them to the engine first while the book is open.
    const ui = flip.getUI?.();
    const onTouch = (e) => {
        if (!ui || !e.target.closest?.(".kalq-magazine__book")) return;
        e.stopPropagation(); // the engine gets it here instead of on the window (not twice)
        if (e.type === "touchmove") ui.onTouchMove(e); else ui.onTouchEnd(e);
    };
    window.addEventListener("touchmove", onTouch, { capture: true, passive: false });
    window.addEventListener("touchend", onTouch, { capture: true });
    // a link in the book leaves it (the page change goes on as usual)
    overlay.addEventListener("click", (e) => { if (e.target.closest(".kalq-mag-page a[href]")) closeMagazine(false); });

    // the page underneath is out of reach while the book is open
    page.inert = true;
    document.querySelector(".site-header")?.setAttribute("inert", "");
    document.documentElement.classList.add("kalq-magazine-open", "kalq-scroll-lock");
    book = { overlay, flip, pages, onKey, onTouch, returnFocus: document.activeElement };
    pages[0].tabIndex = -1;
    overlay.querySelector(".kalq-magazine__btn.is-next").focus();
}

export function closeMagazine(byUser = false) {
    if (!book) return;
    if (byUser) closedByUser = true;
    document.removeEventListener("keydown", book.onKey, true);
    window.removeEventListener("touchmove", book.onTouch, { capture: true });
    window.removeEventListener("touchend", book.onTouch, { capture: true });
    book.flip.destroy?.();
    book.overlay.remove();
    const page = container();
    if (page) page.inert = false;
    document.querySelector(".site-header")?.removeAttribute("inert");
    document.documentElement.classList.remove("kalq-magazine-open", "kalq-scroll-lock");
    const back = book.returnFocus;
    book = null;
    updateToggle();
    back?.focus?.();
}

//=================================== Start ===================================//
// The header button on tablets (and on two screens, to reopen after closing)
let toggle = null;
function updateToggle() {
    const show = PAGES_ON.has(pageName()) && (tablet.matches || spanned.matches);
    if (!show) { toggle?.remove(); toggle = null; return; }
    if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "kalq-magazine-toggle";
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 6c-2-1.3-4.7-2-8-2v14c3.3 0 6 .7 8 2 2-1.3 4.7-2 8-2V4c-3.3 0-6 .7-8 2zM12 6v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        toggle.addEventListener("click", () => openMagazine());
        document.querySelector(".site-header__right")?.prepend(toggle);
    }
    toggle.title = t("open");
    toggle.setAttribute("aria-label", t("open"));
}

export function initMagazine() {
    updateToggle();
    if (spanned.matches) openMagazine({ auto: true });
    if (!initMagazine.listening) {
        initMagazine.listening = true;
        // folding or unfolding: the book follows (a new size, or back to the page)
        spanned.addEventListener("change", () => { closeMagazine(false); closedByUser = false; updateToggle(); if (spanned.matches) openMagazine({ auto: true }); });
        tablet.addEventListener("change", updateToggle);
        document.addEventListener("kalq:language", updateToggle);
        window.barba?.hooks.before(() => closeMagazine(false));
    }
}
