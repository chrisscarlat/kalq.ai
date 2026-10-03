// Magazine mode (branch only): the whole site as one bound book whose pages turn under a finger (StPageFlip 2.0.7,
// js/vendor). An optional enhancement: the normal scrolling site stays the readable version (also without
// JavaScript), and the book is drawn from it, so nothing exists only in the book. Opens by itself on a device spanning
// two screens (one page per screen); on a tablet the book icon in the header opens it.
//   The book: hard front cover (the brand mark and the way in), with a welcome page beside it while it is closed;
//   About (the project in one statement); Contents (every spread, each line a link); then every page of the site as a
//   chapter, every section as its own designed spread (js/book/layouts.js; built-in sections in js/book/kalq.js,
//   page builder modules in js/modules/registry.js); the legal pages as a technical appendix; hard back cover
//   (brand, contacts, closing line). One more turn there closes the book.
//   Navigation: the contents, the "Contents" control at the top left (always back to the contents), dragging, a tap on
//   a page's outer edge, arrow keys, Page Up/Down, Home/End. Links to the site's own pages turn to their chapter.
//   The way back to the web page, light/dark and the language sit with it at the top left. Esc leaves too.
//   Read-only: editing happens on the web page. Reduced motion: pages change without the turning animation or its
//   shadows, the drawings do not move.
import { currentLang, t as tr } from "./i18n.js";
import { renderBlock, textToHtml } from "./blocks.js";
import { MODULES } from "./modules/registry.js";
import { setLanguage, bindLangSwitcher } from "./header.js";
import { getMode, setMode } from "./variants.js";
import { HAND, HAND_TIP, TURN } from "./book/drawings.js";
import { LAYOUTS, page as newPage, textOf, parasOf, mediaUrl, mediaBox, actionOf, fit } from "./book/layouts.js";
import { CHAPTERS, SECTIONS, footerOf } from "./book/kalq.js";

const PAGES_ON = new Set(CHAPTERS.filter((c) => !c.appendix).map((c) => c.page));
const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const tablet = window.matchMedia("(pointer: coarse) and (min-width: 600px) and (max-width: 1366px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const TEXT = {
    de: {
        open: "Als Magazin lesen", close: "Als normale Webseite lesen", next: "Nächste Seite", drag: "Seite ziehen zum Umblättern", book: "Magazin",
        page: (n, of) => `Seite ${n} von ${of}`, welcome: "Willkommen", contents: "Inhalt", index: "Index", toContents: "Index: zum Inhaltsverzeichnis", appendix: "Rechtliches",
        detected: "Gerät mit zwei Bildschirmen erkannt.", intro: "Sie können diese Website als Magazin lesen. Ziehen Sie eine Seite mit dem Finger, um umzublättern.",
        cover: "Zum Titel", controls: "Magazin-Steuerung",
    },
    en: {
        open: "Read as a magazine", close: "Read as a normal website", next: "Next page", drag: "Drag a page to turn it", book: "Magazine",
        page: (n, of) => `Page ${n} of ${of}`, welcome: "Welcome", contents: "Contents", index: "Index", toContents: "Index: back to the contents", appendix: "Legal",
        detected: "Two-screen device detected.", intro: "You can read this website as a magazine. Drag a page with your finger to turn it.",
        cover: "Back to the cover", controls: "Magazine controls",
    },
};
const t = (k) => TEXT[currentLang() === "en" ? "en" : "de"][k];

const DRAG_SEEN = "kalq-mag-drag-hint";
const WEB_CHOSEN = "kalq-mag-web"; // the reader chose the web page: no book by itself for the rest of the visit
const chosenWeb = () => { try { return sessionStorage.getItem(WEB_CHOSEN) === "1"; } catch { return false; } };
const chooseWeb = (on) => { try { on ? sessionStorage.setItem(WEB_CHOSEN, "1") : sessionStorage.removeItem(WEB_CHOSEN); } catch { /* private mode */ } };
const CONTENTS_AT = 3; // front cover, About (1–2), Contents (3–4)

let book = null;
let closedByUser = false;

const container = () => [...document.querySelectorAll('[data-barba="container"]')].pop();
const pageName = () => container()?.dataset.page;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

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

//=================================== Sources ===================================//
// Every chapter's page as the site shows it: the page open now from the document itself (with whatever is being
// edited), the others as the server renders them (published content), in the reader's language.
const sourceCache = new Map();

async function localize(root, page, lang) {
    const res = await fetch(`/api/content?page=${encodeURIComponent(page)}`, { credentials: "same-origin" }).catch(() => null);
    const { blocks = [] } = res?.ok ? await res.json() : {};
    const edited = new Map(blocks.filter((b) => b.type === "text" && b.lang === lang).map((b) => [b.key, b.content]));
    root.querySelectorAll("[data-i18n], [data-kalq-key]").forEach((n) => {
        if ((n.dataset.kalqType || "text") !== "text" || n.hasAttribute("data-i18n-marquee")) return;
        const own = n.dataset.kalqKey && edited.get(n.dataset.kalqKey);
        if (own != null) return renderBlock(n, own);
        const key = n.dataset.i18n;
        if (!key || tr(key) === key) return;
        if (n.dataset.kalqFormat) renderBlock(n, textToHtml(tr(key), n.dataset.kalqFormat));
        else n.textContent = tr(key);
    });
}

function sourceOf(ch) {
    const here = container();
    if (here?.dataset.page === ch.page) return Promise.resolve(here.cloneNode(true));
    const lang = currentLang();
    const key = `${ch.file}|${lang}`;
    if (!sourceCache.has(key)) {
        sourceCache.set(key, (async () => {
            const res = await fetch(ch.file, { credentials: "same-origin" });
            if (!res.ok) throw new Error(`${ch.file}: ${res.status}`);
            const root = new DOMParser().parseFromString(await res.text(), "text/html").querySelector('[data-barba="container"]');
            if (!root) throw new Error(`${ch.file}: no page`);
            if (lang !== "de") await localize(root, ch.page, lang); // the server writes German
            return root;
        })().catch((e) => { sourceCache.delete(key); console.warn("magazine", e.message); return null; }));
    }
    return sourceCache.get(key).then((root) => root?.cloneNode(true) || null);
}

//=================================== Units ===================================//
const sectionKind = (s) => s.dataset.section in SECTIONS ? s.dataset.section
    : (s.classList[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); // a copy keeps its class

function moduleUnit(s, module, version) {
    const m = MODULES[module].magazine;
    const slot = (name) => s.querySelector(`[data-kalq-key$=".${name}"]`);
    if (m.layout === "F") {
        const pairs = [...s.querySelectorAll(".kalq-m-faq__item")].map((it) => ({ q: it.querySelector(".kalq-m-faq__q"), a: it.querySelector(".kalq-m-faq__a") }))
            .filter((p) => p.q?.textContent.trim());
        return { layout: "F", title: slot("heading"), pairs };
    }
    return {
        layout: m.layout, order: typeof m.order === "object" ? m.order[version] : m.order,
        eyebrow: slot("eyebrow"), title: slot("heading"), body: parasOf(slot("text")), caption: slot("caption"),
        actions: [...s.querySelectorAll("a.kalq-m-button, a.btn")], media: [mediaUrl(slot(m.media || "media"))], focal: s.dataset.focal,
    };
}

// A chapter's sections as units, in order; the hero, the About text, social links and the footer are kept aside for
// the covers and the opening (the first page that has them gives them)
function unitsOf(root, ch, shared) {
    const units = [];
    const sections = [...root.querySelectorAll(":scope > section[data-section]")].filter((s) => s.dataset.sectionState !== "draft");
    const taken = new Set();
    sections.forEach((s, i) => {
        if (taken.has(s.dataset.section)) return;
        const [module, version] = (s.dataset.module || "").split(":");
        let made = null;
        if (module && MODULES[module]?.magazine) made = moduleUnit(s, module, version);
        else if (SECTIONS[sectionKind(s)]) made = SECTIONS[sectionKind(s)](s, { next: sections[i + 1], chapter: ch });
        [made].flat().filter(Boolean).forEach((u) => {
            if (u.takes) taken.add(u.takes);
            if (u.role) { shared[u.role] ||= u; return; }
            units.push(u);
        });
    });
    shared.footer ||= footerOf(root);
    return units;
}

const firstSentence = (s) => (s || "").replace(/\s+/g, " ").trim().replace(/^(.{12,}?[.!?])\s.*$/, "$1");
const labelOf = (u) => {
    if (Array.isArray(u.label)) return u.label.map((n) => n?.textContent.trim()).filter(Boolean).join(" · ");
    const src = u.title || u.statement;
    return firstSentence(src?.textContent || "");
};

//=================================== Special pages ===================================//
function markOf(selector) {
    const svg = document.querySelector(selector)?.cloneNode(true);
    if (!svg) return null;
    svg.removeAttribute("role");
    svg.setAttribute("aria-hidden", "true");
    return svg;
}

// Front cover, like a magazine's: the brand title along the top, the hero's video behind, cover lines along the foot
// (each chapter with one of its real headings, a link to it) and the way in at the bottom right
function frontCover(cover, lines, { exit = false } = {}) {
    const p = newPage("is-cover is-front-cover");
    p.setAttribute("data-density", "hard");
    p.inner.append(mediaBox(cover?.media?.[0] || null, { cls: "bk-cover__media" }), el("div", "bk-cover__shade"));
    const title = el("h1", "bk-cover__title");
    const svg = cover?.mark?.querySelector("svg")?.cloneNode(true) || markOf(".site-logo__word svg");
    if (svg) { svg.removeAttribute("role"); svg.setAttribute("aria-hidden", "true"); title.append(svg, el("span", "kalq-sr", cover?.mark?.textContent.trim() || "KALQ")); }
    else title.textContent = cover?.mark?.textContent.trim() || "KALQ";
    const foot = el("div", "bk-cover__foot");
    const list = el("ul", "bk-cover__lines");
    lines.forEach((l) => {
        const li = el("li");
        const a = el("a");
        a.href = `#kalq-book-p${l.at}`;
        a.dataset.to = l.at;
        a.append(el("span", "bk-eyebrow", l.chapter), " ", el("span", "bk-cover__line", l.text)); // read as "chapter, line"
        li.append(a);
        list.append(li);
    });
    const cue = el("div", "kalq-mag-cue");
    cue.innerHTML = '<span class="kalq-mag-cue__ripple" aria-hidden="true"></span><span class="kalq-mag-cue__ripple" aria-hidden="true"></span>'
        + `<button type="button" class="kalq-mag-cue__btn" aria-label="${t("next")}" title="${t("next")}">`
        + '<svg class="kalq-mag-cue__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
        + `<span class="kalq-mag-cue__hand" aria-hidden="true">${HAND}</span>`;
    foot.append(list, cue);
    p.inner.append(title, foot);
    if (exit) {
        const b = el("button", "bk-cover__exit", t("close"));
        b.type = "button";
        b.dataset.bkAction = "web";
        p.inner.append(b);
    }
    return p;
}

// Masthead, top left of a left page: the logo symbol and the name of the section the page belongs to
function masthead(chapter, sub) {
    const m = el("p", "bk-mast");
    const mark = markOf(".site-logo__custom svg") || markOf("svg.site-logo__mark");
    if (mark) {
        mark.setAttribute("role", "img"); // the logo, also for machines
        mark.setAttribute("aria-label", "Kalq");
        mark.removeAttribute("aria-hidden");
        mark.querySelectorAll("line, path, circle, rect, polyline").forEach((n) => n.setAttribute("pathLength", "1")); // for the draw
        m.append(mark);
    }
    m.append(el("span", "bk-mast__chapter", chapter));
    if (sub) m.append(el("span", "bk-mast__sub", sub));
    return m;
}

// The controls, bottom left of a right page, in the header's own design: back to the cover, Index (the contents),
// light or dark, the language (the header's own E / D switch). Each right page carries a copy that turns with it (a
// picture, not reachable); one live set lies exactly over the copy of the settled page, so a tap always lands.
let controlId = 0;
function controls({ live = false, signal } = {}) {
    const nav = el(live ? "nav" : "div", `bk-controls${live ? " is-live" : ""}`);
    if (live) nav.setAttribute("aria-label", t("controls"));
    else { nav.setAttribute("aria-hidden", "true"); nav.inert = true; }
    const button = (action, label, html, cls = "") => {
        const b = el("button", `bk-control ${cls}`.trim());
        b.type = "button";
        b.dataset.bkAction = action;
        b.setAttribute("aria-label", label);
        b.title = label;
        b.innerHTML = html;
        nav.append(b);
        return b;
    };
    button("cover", t("cover"), '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8.5 3.5v17"/></svg>');
    button("index", t("toContents"), '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5"/></svg>');
    const mode = document.querySelector(".site-header .mode-toggle")?.cloneNode(true);
    if (mode) {
        const id = `kalq-moon-bite-bk${controlId++}`; // the copy's own mask
        mode.querySelector("mask")?.setAttribute("id", id);
        mode.querySelector("[mask]")?.setAttribute("mask", `url(#${id})`);
        mode.dataset.bkAction = "mode";
        nav.append(mode);
    }
    const lang = document.querySelector(".site-header [data-lang-switcher]")?.cloneNode(true);
    if (lang) {
        lang.removeAttribute("data-lang-switcher");
        lang.classList.remove("is-open");
        lang.querySelectorAll(".is-preview, .is-dimmed").forEach((n) => n.classList.remove("is-preview", "is-dimmed"));
        nav.append(lang);
        if (live) bindLangSwitcher(lang, { pick: (code) => { if (code !== currentLang()) setLanguage(code); }, signal });
    }
    if (!live) nav.querySelectorAll("button").forEach((b) => (b.tabIndex = -1));
    return nav;
}

// About: the About section's picture over the whole left page (the placeholder glyph until one is set) with the
// project's statement over it; facing it, the figures, each with what it counts, and the description, at the foot
function aboutSpread(cover, about) {
    const left = newPage("is-media bk-about bk-about__media");
    left.inner.append(mediaBox(about?.media || null));
    const statement = textOf(cover?.statement, "p", "bk-statement");
    if (statement) { const o = el("div", "bk-over bk-over--centre"); o.append(statement); left.inner.append(o); }
    const right = newPage("bk-about");
    const flow = el("div", "bk-flow");
    if (about?.figures?.length) {
        const list = el("dl", "bk-figures");
        about.figures.forEach((f) => { const d = el("div"); d.append(textOf(f.value, "dt", "bk-figure"), textOf(f.label, "dd", "bk-body")); list.append(d); });
        flow.append(list);
    }
    if (about?.lead) flow.append(textOf(about.lead, "p", "bk-small"));
    right.inner.append(flow);
    return [left, right];
}

// Contents: one block per chapter, every spread a line that turns to it
function contentsSpread(groups) {
    const [left, right] = [newPage("bk-contents"), newPage("bk-contents")];
    const head = el("h2", "bk-title bk-contents__title", t("contents"));
    head.id = "kalq-book-contents";
    left.inner.append(head);
    const spacer = el("p", "bk-title bk-contents__title is-spacer", t("contents")); // the same height, so both columns start together
    spacer.setAttribute("aria-hidden", "true");
    right.inner.append(spacer);
    const lists = [el("div", "bk-flow"), el("div", "bk-flow")];
    groups.forEach((g) => {
        const block = el("section", "bk-chapter");
        const head = el("h3", "bk-eyebrow");
        const link = el("a", null, g.title);
        link.href = `#kalq-book-p${g.at}`;
        link.dataset.to = g.at;
        head.append(link);
        block.append(head);
        const ol = el("ol", "bk-entries");
        g.entries.forEach((e) => {
            const li = el("li");
            const a = el("a", null);
            a.href = `#kalq-book-p${e.at}`;
            a.dataset.to = e.at;
            a.append(el("span", "bk-entry__label", e.label), el("span", "bk-entry__folio", String(e.at + 1)));
            li.append(a);
            ol.append(li);
        });
        block.append(ol);
        lists[0].append(block);
    });
    left.inner.append(lists[0]);
    right.inner.append(lists[1]);
    return [left, right];
}

// Chapters move to the right page until the left one holds what it can
function balance([left, right]) {
    const [a, b] = [left.querySelector(".bk-flow"), right.querySelector(".bk-flow")];
    const over = (f) => f.scrollHeight > f.clientHeight + 1;
    while (over(a) && a.children.length > 1) b.prepend(a.lastElementChild);
    if (!b.children.length && a.children.length > 2) { // all fitted on the left: share them out over both pages
        while (a.children.length > b.children.length + 1) b.prepend(a.lastElementChild);
    }
}

// Back cover: the brand name small on top, the logo in the middle, the cover video again; contacts (some as small
// buttons, some as plain text), the closing line
function backCover(cover, footer, social) {
    const p = newPage("is-cover is-back-cover");
    p.setAttribute("data-density", "hard");
    p.inner.append(mediaBox(cover?.media?.[0] || null, { cls: "bk-cover__media" }), el("div", "bk-cover__shade"));
    const word = markOf(".site-logo__word svg") || markOf(".hero_title svg");
    const top = el("p", "bk-back__name");
    if (word) top.append(word); else top.textContent = "KALQ";
    const logo = el("div", "bk-back__logo");
    const mark = markOf(".site-logo__custom svg") || markOf("svg.site-logo__mark");
    if (mark) logo.append(mark);
    const end = el("div", "bk-back__end");
    if (footer?.closing) end.append(textOf(footer.closing, "p", "bk-back__closing"));
    if (footer?.sub) end.append(textOf(footer.sub, "p", "bk-small"));
    if (social?.label) end.append(textOf(social.label, "p", "bk-eyebrow"));
    const buttons = el("div", "bk-actions");
    [...(footer?.buttons || []), ...(social?.links || []).map((l) => Object.assign(document.createElement("a"), { href: l.href, textContent: l.text, target: "_blank" }))]
        .map(actionOf).filter(Boolean).forEach((a) => buttons.append(a));
    if (buttons.children.length) end.append(buttons);
    const plain = el("p", "bk-back__plain");
    if (footer?.small) plain.append(el("span", null, footer.small.textContent.trim()));
    (footer?.links || []).forEach((a) => { const l = el("a", null, a.textContent.trim()); l.href = a.getAttribute("href"); plain.append(l); });
    if (plain.children.length) end.append(plain);
    p.inner.append(top, logo, end);
    return p;
}

//=================================== Hints ===================================//
function shownBox(pages) {
    const rects = pages.filter((p) => !p.inert && getComputedStyle(p).display !== "none").map((p) => p.getBoundingClientRect()).filter((r) => r.width);
    if (!rects.length) return null;
    return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)), top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)) };
}

// The first time the second spread opens: the hand takes the lower outer corner, drags it across and lets it fall
// back, once; then it is gone. The same hint stays as a line of text while the spread is open.
function dragHint(overlay, pages, pageW, tip) {
    try { if (localStorage.getItem(DRAG_SEEN)) return; localStorage.setItem(DRAG_SEEN, "1"); } catch { /* no storage: show it this time */ }
    tip.textContent = t("drag");
    tip.hidden = false;
    if (reducedMotion.matches) return;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (overlay.isConnected) dragHand(overlay, pages, pageW); }));
}

function dragHand(overlay, pages, pageW) {
    const box = shownBox(pages);
    if (!box) return;
    const hint = el("div", "kalq-mag-drag");
    hint.setAttribute("aria-hidden", "true");
    hint.style.left = `${box.right}px`;
    hint.style.top = `${box.bottom}px`;
    hint.innerHTML = `<span class="kalq-mag-drag__fold"></span><span class="kalq-mag-drag__hand">${HAND}</span>`;
    overlay.append(hint);
    const fold = hint.firstElementChild, hand = hint.lastElementChild;
    const size = Math.round(Math.min(pageW * 0.42, 220));
    const hw = 46, hh = hw * 60 / 48;
    const at = (s) => `translate(${-s - hw * HAND_TIP.x}px, ${-s - hh * HAND_TIP.y}px)`; // fingertip on the folded corner
    const timing = { duration: 3000, delay: 350, easing: "cubic-bezier(.45,0,.25,1)", fill: "both" };
    fold.animate([
        { width: "0px", height: "0px", offset: 0 }, { width: "0px", height: "0px", offset: 0.18 },
        { width: `${size}px`, height: `${size}px`, offset: 0.58 }, { width: `${size}px`, height: `${size}px`, offset: 0.72 },
        { width: "0px", height: "0px", offset: 0.9 }, { width: "0px", height: "0px", offset: 1 },
    ], timing);
    hand.animate([
        { transform: `${at(-40)}`, opacity: 0, offset: 0 }, { transform: at(0), opacity: 1, offset: 0.18 },
        { transform: at(size), opacity: 1, offset: 0.58 }, { transform: at(size), opacity: 1, offset: 0.72 },
        { transform: `${at(size)} translate(5px, -9px)`, opacity: 0, offset: 0.8 }, // lets go: lifts off where it is
        { transform: `${at(size)} translate(5px, -9px)`, opacity: 0, offset: 1 },
    ], timing).finished.then(() => hint.remove(), () => hint.remove());
}

//=================================== Turning ===================================//
// StPageFlip folds a page from one of its corners, and on a grab puts that corner where the finger is: grabbed at the
// middle of an edge, the corner jumped there and lifted. True folds from any point are not something it can do. The
// closest natural feel: the nearest corner starts from where it lies and moves by exactly as much as the finger does,
// so the page lifts gradually from the side that was taken hold of. A tap (no movement) stays a tap.
function holdWhereGrabbed(flip, pageW) {
    const start = flip.startUserTouch.bind(flip), move = flip.userMove.bind(flip), stop = flip.userStop.bind(flip);
    let hold = null;
    const corner = (p) => {
        const r = flip.getRender().getRect(); // the book within the engine's frame, in the engine's coordinates
        const right = r.width <= r.pageWidth + 1 ? true : p.x > r.left + r.width / 2;
        const c = { x: right ? r.left + r.width - 2 : r.left + 2, y: p.y < r.top + r.height / 2 ? r.top + 2 : r.top + r.height - 2 }; // just inside, as a hand would take it
        const near = Math.hypot(r.pageWidth, r.height) / 5; // the engine's own corner size
        return Math.hypot(p.x - c.x, p.y - c.y) < near ? null : c;
    };
    const shifted = (p) => (hold?.c ? { x: hold.c.x + p.x - hold.p.x, y: hold.c.y + p.y - hold.p.y } : p);
    flip.startUserTouch = (p) => { hold = { p, c: corner(p) }; start(hold.c || p); };
    flip.userMove = (p, touch) => move(flip.isUserTouch === false || !hold ? p : shifted(p), touch);
    flip.userStop = (p, swipe) => {
        const moved = hold && Math.hypot(p.x - hold.p.x, p.y - hold.p.y) > 5;
        const at = moved ? shifted(p) : p;
        hold = null;
        stop(at, swipe);
    };
}

//=================================== Geometry ===================================//
// The gap between the two screens in pixels: none on a continuous fold, a real hinge on a Surface Duo. --seg-hinge is a
// calc() of env() values, so it is measured rather than parsed.
function hingeWidth() {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;width:var(--seg-hinge, 0px);height:0";
    document.body.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.max(0, Math.round(w));
}

// Exploration (not committed): ?book=inset (or localStorage kalq-book-inset=1) shows the book a little smaller than
// the screen on a tablet, so it reads as a magazine lying on the page
const inset = () => { try { return /[?&]book=inset\b/.test(location.search) || localStorage.getItem("kalq-book-inset") === "1"; } catch { return false; } };

function geometry() {
    if (spanned.matches) {
        // one page per screen, the spine in the middle of the hinge
        const w = Math.floor(window.innerWidth / 2), h = window.innerHeight;
        return { pageW: w, pageH: h, portrait: false, hinge: hingeWidth() };
    }
    const scale = inset() ? 0.92 : 1;
    const landscape = window.innerWidth > window.innerHeight;
    const h = Math.round((window.innerHeight - 96) * scale);
    const w = landscape ? Math.min(Math.floor((window.innerWidth - 48) * scale / 2), Math.round(h * 0.75)) : Math.min(Math.round((window.innerWidth - 32) * scale), Math.round(h * 0.72));
    return { pageW: w, pageH: h, portrait: !landscape, hinge: 0 };
}

//=================================== Open and close ===================================//
// Only one book at a time: a second request while one is being built (page start and a posture change can come
// together) waits for the first
let opening = null;
export function openMagazine(options = {}) {
    opening ||= build(options).finally(() => { opening = null; });
    return opening;
}

async function build({ auto = false, at = null } = {}) {
    if (book || !PAGES_ON.has(pageName())) return;
    if (auto && (closedByUser || chosenWeb())) return;
    const [St, sources] = await Promise.all([loadEngine().catch(() => null), Promise.all(CHAPTERS.map(sourceOf))]);
    if (!St?.PageFlip || book) return;
    const { pageW, pageH, portrait, hinge } = geometry();
    const listeners = new AbortController(); // the controls' document listeners, detached when the book closes

    const overlay = el("div", "kalq-magazine");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", t("book"));
    overlay.style.setProperty("--kalq-mag-hinge", `${hinge}px`);
    overlay.style.setProperty("--bk-w", `${pageW}px`);
    overlay.style.setProperty("--bk-h", `${pageH}px`);
    if (spanned.matches) overlay.classList.add("is-spanned");
    if (inset() && !spanned.matches) overlay.classList.add("is-inset");
    if (portrait) overlay.classList.add("is-portrait");
    const stage = el("div", "kalq-magazine__book");
    const measure = el("div", "kalq-magazine__measure");
    overlay.append(stage, measure);
    document.body.append(overlay);

    // Units, chapter by chapter
    const shared = {};
    const chapters = CHAPTERS.map((ch, i) => ({ ch, root: sources[i] })).filter((c) => c.root)
        .map(({ ch, root }) => ({ ch, units: unitsOf(root, ch, shared) }));
    let uid = 0;
    const spreads = [];
    chapters.forEach(({ ch, units }) => units.forEach((u) => {
        if (u.layout === "opener") u.chapter = tr(ch.label);
        if (u.tech) u.code = `${t("appendix")} · ${tr(ch.label)}`;
        const layout = LAYOUTS[u.layout];
        if (!layout) return;
        spreads.push({ ch, unit: u, label: labelOf(u), pages: layout(u, { uid: `bk${uid++}` }) });
    }));

    // Lay every page out at its real size, fit long text (two columns, then more pages), keep spreads in pairs
    const sized = (p) => { p.style.width = `${pageW}px`; p.style.height = `${pageH}px`; return p; };
    spreads.forEach((s) => { s.pages.forEach((p) => measure.append(sized(p))); });
    let appendixPages = [];
    spreads.forEach((s) => {
        s.pages = fit(s.pages, pageW >= 440, measure).map(sized);
        if (s.unit.tech) return;
        if (s.pages.length % 2) s.pages.push(sized(newPage("is-blank")));
    });
    // the appendix runs on as one technical section: an even number of pages in all
    const appendix = spreads.filter((s) => s.unit.tech);
    appendixPages = appendix.flatMap((s) => s.pages);
    if (appendixPages.length % 2) { const blank = sized(newPage("is-tech is-blank")); appendix.at(-1).pages.push(blank); }

    // Numbering: front cover 0, About 1–2, Contents 3–4, then the chapters
    let folio = CONTENTS_AT + 2;
    spreads.forEach((s) => { s.at = folio; folio += s.pages.length; });
    const groups = [];
    spreads.forEach((s) => {
        const title = s.unit.tech ? t("appendix") : tr(s.ch.label);
        let g = groups.at(-1);
        if (!g || g.title !== title) groups.push(g = { title, entries: [], at: s.at, page: s.ch.page });
        if (s.unit.tech && g.entries.some((e) => e.page === s.ch.page)) return;
        g.entries.push({ label: s.unit.tech ? tr(s.ch.label) : s.label || tr(s.ch.label), at: s.at, page: s.ch.page });
    });
    const chapterAt = Object.fromEntries(spreads.map((s) => [s.ch.file, s.at]).reverse());
    const contents = contentsSpread(groups);
    contents.forEach((p) => measure.append(sized(p)));
    balance(contents);
    spreads.forEach((s) => s.pages.forEach((p) => { p.mast = s.unit.tech ? [t("appendix"), tr(s.ch.label)] : [tr(s.ch.label), s.unit.layout === "opener" ? "" : s.label]; }));
    // cover lines: each chapter of the site with its first real heading
    const lines = groups.filter((g) => g.title !== t("appendix")).map((g) => ({ chapter: g.title, text: g.entries[0]?.label || "", at: g.at }));
    const pages = [frontCover(shared.cover, lines, { exit: portrait }), ...aboutSpread(shared.cover, shared.about), ...contents,
        ...spreads.flatMap((s) => s.pages), backCover(shared.cover, shared.footer, shared.social)];
    measure.remove();
    pages.forEach((p, i) => {
        sized(p);
        p.tabIndex = -1;
        p.id = `kalq-book-p${i}`;
        p.dataset.side = i % 2 ? "left" : "right"; // after the single front cover, pages alternate left, right
        p.setAttribute("role", "group");
        p.setAttribute("aria-roledescription", "page");
        p.setAttribute("aria-label", t("page")(i + 1, pages.length));
        if (i > 0 && i < pages.length - 1) {
            p.append(el("span", "bk-folio", String(i + 1)));
            const left = portrait || i % 2 === 1, right = portrait || i % 2 === 0;
            if (left && p.mast && !p.matches(".bk-opener, .bk-about, .bk-contents")) p.append(masthead(...p.mast));
            if (right) p.append(controls());
        }
        stage.append(p);
    });

    const start = at ?? (pageName() === "home" ? 0 : chapterAt[CHAPTERS.find((c) => c.page === pageName())?.file] ?? 0);
    const flip = new St.PageFlip(stage, {
        width: pageW, height: pageH, size: "fixed", showCover: true, usePortrait: portrait, autoSize: false,
        drawShadow: !reducedMotion.matches, maxShadowOpacity: 0.45, flippingTime: reducedMotion.matches ? 1 : 750,
        showPageCorners: !reducedMotion.matches, disableFlipByClick: true, mobileScrollSupport: false, swipeDistance: 24,
        startPage: Math.min(start, pages.length - 1), startZIndex: 2,
    });
    flip.loadFromHTML(pages);
    holdWhereGrabbed(flip, pageW);
    stage.kalqFlip = flip; // the engine, for tests and the console
    const goTo = (i) => {
        if (i === flip.getCurrentPageIndex()) return;
        if (reducedMotion.matches) { flip.turnToPage(i); update(); requestAnimationFrame(() => requestAnimationFrame(update)); } else flip.flip(i);
    };

    // The controls on the pages: Index, light or dark, the web page, the cover (the language switch handles itself)
    overlay.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bk-action]");
        if (!b) return;
        const act = b.dataset.bkAction;
        if (act === "index") goTo(CONTENTS_AT);
        else if (act === "cover") goTo(0);
        else if (act === "web") leaveForWeb();
        else if (act === "mode") { setMode(getMode() === "dark" ? "light" : "dark"); setTimeout(onLook, 0); }
    });
    const live = controls({ live: true, signal: listeners.signal });
    live.hidden = true;
    overlay.append(live);
    const status = el("p", "kalq-magazine__status kalq-sr"); // the page number, announced (the folios are what one sees)
    status.setAttribute("aria-live", "polite");
    const tip = el("p", "kalq-magazine__tip"); // the drag hint as words
    tip.setAttribute("role", "status");
    tip.hidden = true;
    overlay.append(status, tip);

    // The welcome page: beside the cover, where the book has no page yet (two pages side by side only)
    let welcome = null;
    if (!portrait) {
        welcome = el("section", "kalq-mag-welcome");
        welcome.setAttribute("aria-label", t("welcome"));
        Object.assign(welcome.style, { width: `${pageW}px`, height: `${pageH}px` });
        welcome.innerHTML = `<div class="kalq-mag-welcome__body">${TURN}<p class="kalq-mag-welcome__text">`
            + (spanned.matches ? `<strong>${t("detected")}</strong> ` : "") + `${t("intro")}</p>`
            + `<button type="button" class="kalq-mag-welcome__web">${t("close")}</button></div>`;
        welcome.querySelector("button").addEventListener("click", () => leaveForWeb());
        stage.prepend(welcome);
    }
    const cue = pages[0].querySelector(".kalq-mag-cue");
    cue.querySelector("button").addEventListener("click", () => flip.flipNext());
    cue.classList.add("is-play"); // the tap hint, once on arrival (CSS; none under reduced motion)

    // Past the back cover: the book closes to the normal background
    const finish = () => {
        if (reducedMotion.matches) return closeMagazine(true);
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" }).finished.then(() => closeMagazine(true));
    };
    const last = pages.length - 1;

    // A tap on a page's outer edge turns it (the engine itself turns pages tapped on a corner: then nothing more)
    let down = null;
    stage.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, time: Date.now() }; });
    stage.addEventListener("pointerup", (e) => {
        const tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && Date.now() - down.time < 500;
        down = null;
        if (!tap || e.target.closest("a, button, input, textarea, select, video[controls], [tabindex='0'], .kalq-mag-welcome")) return;
        const box = shownBox(pages);
        if (!box) return;
        const edge = Math.max(40, pageW * 0.14);
        const dir = e.clientX > box.right - edge ? 1 : e.clientX < box.left + edge ? -1 : 0;
        if (!dir) return;
        const i = flip.getCurrentPageIndex();
        if (dir > 0 && i >= last) return finish();
        setTimeout(() => { if (flip.getState() === "read" && flip.getCurrentPageIndex() === i) (dir > 0 ? flip.flipNext() : flip.flipPrev()); }, 40);
    });

    const update = () => {
        const i = flip.getCurrentPageIndex();
        status.textContent = t("page")(i + 1, pages.length);
        if (i !== 1) tip.hidden = true;
        if (flip.getState() !== "read") overlay.querySelectorAll(".kalq-mag-drag").forEach((n) => n.remove()); // turning on: the hint has done its job
        // the welcome page lies under the left pages; in front and reachable only while the cover is closed
        if (welcome) {
            const atCover = i === 0 && flip.getState() === "read";
            welcome.classList.toggle("is-front", atCover);
            welcome.inert = !atCover;
        }
        // only what is shown is reachable and playing
        pages.forEach((p) => {
            const shown = p.style.display !== "none" && getComputedStyle(p).display !== "none";
            p.inert = !shown;
            p.querySelectorAll("video").forEach((v) => (shown && !reducedMotion.matches ? v.play?.()?.catch(() => { }) : v.pause()));
        });
        // the drag hint's words sit under the left page (on two screens: the left screen)
        const box = shownBox(pages);
        if (box) tip.style.left = `${Math.round(portrait ? (box.left + box.right) / 2 : box.left + pageW / 2)}px`;
        settle();
    };
    // Settled: the live controls over the copy on the page in view, the masthead's logo drawn once; turning: the
    // copies turn with their pages and the live set steps aside
    const settle = () => {
        const read = flip.getState() === "read";
        const shown = pages.filter((p) => !p.inert && p.offsetWidth);
        const copy = read && shown.map((p) => p.querySelector(":scope > .bk-controls")).find(Boolean);
        overlay.querySelectorAll(".kalq-mag-page > .bk-controls").forEach((c) => { c.style.visibility = c === copy ? "hidden" : ""; });
        if (!copy) { if (live.contains(document.activeElement)) live.dataset.refocus = "1"; live.hidden = true; }
        else {
            const r = copy.getBoundingClientRect();
            Object.assign(live.style, { left: `${Math.round(r.left)}px`, top: `${Math.round(r.top)}px` });
            live.classList.toggle("is-light", copy.closest(".is-media") !== null || !!copy.closest(".kalq-mag-page")?.querySelector(".bk-over"));
            live.hidden = false;
            if (live.dataset.refocus) { delete live.dataset.refocus; live.querySelector("button")?.focus({ preventScroll: true }); }
        }
        pages.forEach((p) => {
            const m = p.querySelector(":scope > .bk-mast");
            if (!m) return;
            if (!shown.includes(p)) m.classList.remove("is-drawn", "is-drawing");
            else if (read && !m.classList.contains("is-drawn") && !reducedMotion.matches) { m.classList.add("is-drawn", "is-drawing"); }
        });
    };
    flip.on("flip", () => {
        update();
        requestAnimationFrame(() => requestAnimationFrame(update)); // again once the engine has drawn the new pages (an instant turn reports first)
        if (flip.getCurrentPageIndex() === 1) dragHint(overlay, pages, pageW, tip);
        overlay.querySelector(".kalq-mag-page:not([inert]) :is(h1, h2, h3, p)")?.closest(".kalq-mag-page")?.focus?.({ preventScroll: true });
    });
    flip.on("changeState", update);
    setTimeout(update, 50);

    // Keys work wherever focus is while the book is open (after a drag it sits on the page body). The book is
    // read-only: the site's own shortcuts (editing, comments, panels) never reach the page underneath. Tab, Enter
    // and Space keep their usual meaning.
    const onKey = (e) => {
        const step = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
        const inTabs = e.target.closest?.(".bk-tabs, .bk-list");
        const act = step && !(inTabs && /Arrow(Up|Down)/.test(e.key)) ? () => (step > 0 && flip.getCurrentPageIndex() >= last ? finish() : step > 0 ? flip.flipNext() : flip.flipPrev())
            : e.key === "Home" && !inTabs ? () => goTo(0)
            : e.key === "End" && !inTabs ? () => goTo(last)
            : e.key === "Escape" ? () => leaveForWeb() : null;
        e.stopImmediatePropagation();
        if (!act) return;
        e.preventDefault();
        act();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", settle, { signal: listeners.signal });
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
    // Links: the contents and the site's own pages turn the book; mail and other sites open as usual; any other link
    // on the site leaves the book for it
    overlay.addEventListener("click", (e) => {
        const a = e.target.closest(".kalq-mag-page a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        const file = href.replace(/^\.?\//, "").split(/[?#]/)[0] || "index.html";
        const to = a.dataset.to != null ? +a.dataset.to : chapterAt[file];
        if (to != null) { e.preventDefault(); goTo(to); return; }
        if (/^(mailto:|tel:|https?:)/.test(href) || a.target === "_blank") return;
        closeMagazine(false);
    });

    // Rebuild in place: another language, or new content (a picture arrives in its slot)
    const rebuild = () => { const i = flip.getCurrentPageIndex(); closeMagazine(false, { keepFocus: true }); openMagazine({ at: i }); };
    const onLanguage = () => rebuild();
    let pending = 0;
    const onContent = () => { clearTimeout(pending); pending = setTimeout(() => { sourceCache.clear(); rebuild(); }, 600); };
    // the copies of the light/dark switch say what they do, like the header's
    const onLook = () => {
        const dark = getMode() === "dark", en = currentLang() === "en";
        const text = dark ? (en ? "Light design" : "Helles Design") : (en ? "Dark design" : "Dunkles Design"); // as the header says it
        overlay.querySelectorAll(".bk-controls .mode-toggle").forEach((b) => { b.setAttribute("aria-label", text); b.title = text; b.setAttribute("aria-pressed", dark); });
    };
    onLook();
    document.addEventListener("kalq:language", onLanguage);
    document.addEventListener("kalq:content", onContent);
    document.addEventListener("kalq:look", onLook);

    // the page underneath is out of reach while the book is open
    const page = container();
    page.inert = true;
    document.querySelector(".site-header")?.setAttribute("inert", "");
    document.documentElement.classList.add("kalq-magazine-open", "kalq-scroll-lock");
    book = { overlay, flip, pages, onKey, onTouch, onLanguage, onContent, onLook, listeners, returnFocus: book?.returnFocus || document.activeElement };
    // focus without scrolling: the button sits inside the engine's page, whose clipped ancestors a scroll would shift
    if (start === 0) cue.querySelector("button").focus({ preventScroll: true });
    else setTimeout(() => live.querySelector("button")?.focus({ preventScroll: true }), 120);
}

// The reader's way back: the web page for the rest of the visit (the header's book icon still opens the book)
function leaveForWeb() {
    chooseWeb(true);
    closeMagazine(true);
}

export function closeMagazine(byUser = false, { keepFocus = false } = {}) {
    if (!book) return;
    if (byUser) closedByUser = true;
    window.removeEventListener("keydown", book.onKey, true);
    window.removeEventListener("touchmove", book.onTouch, { capture: true });
    window.removeEventListener("touchend", book.onTouch, { capture: true });
    document.removeEventListener("kalq:language", book.onLanguage);
    document.removeEventListener("kalq:content", book.onContent);
    document.removeEventListener("kalq:look", book.onLook);
    book.listeners.abort();
    book.flip.destroy?.();
    book.overlay.remove();
    const page = container();
    if (page) page.inert = false;
    document.querySelector(".site-header")?.removeAttribute("inert");
    document.documentElement.classList.remove("kalq-magazine-open", "kalq-scroll-lock");
    const back = book.returnFocus;
    book = null;
    updateToggle();
    if (!keepFocus) back?.focus?.();
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
        toggle.addEventListener("click", () => { chooseWeb(false); closedByUser = false; openMagazine(); });
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
