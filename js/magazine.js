// Magazine mode (prototype, branch only): the page as a book whose pages turn under a finger (StPageFlip 2.0.7,
// js/vendor). An optional enhancement over the normal readable page: built from it on demand, so every word is still
// in the page itself, without JavaScript too. Opens by itself on a device spanning two screens (the spine on the
// hinge, one page per screen); on a plain tablet a button in the header opens it.
//   hard front cover: the hero, with a welcome page beside it (a drawing, a short text and the way back to the web
//   page); pages: the sections' own headings, paragraphs, lists, pictures and buttons, in order, never split (an
//   element taller than a page makes that page scroll inside), a heading never last on a page, a section's last item
//   never alone on one; hard back cover: the wordmark.
//   turn: on the front cover one "next page" button (a short tap hint plays on arrival); after it drag a page, tap a
//   page's outer edge, or arrow keys, Page Up/Down, Home/End; the first time the second spread opens, a drawn hand
//   drags a corner once (with the same hint as one line of text). Esc, the welcome page's button or the icon where the
//   header's book icon sits return to the web page (for the rest of the visit). Read-only: editing is on the web page.
//   Reduced motion: pages change without the turning animation or its shadows, and the drawings do not move.
import { currentLang } from "./i18n.js";

const PAGES_ON = new Set(["home", "platform", "company"]);
const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const tablet = window.matchMedia("(pointer: coarse) and (min-width: 600px) and (max-width: 1366px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const TEXT = {
    de: {
        open: "Als Magazin lesen", close: "Als normale Webseite lesen", next: "Nächste Seite", drag: "Seite ziehen zum Umblättern", book: "Magazin",
        page: (n, of) => `Seite ${n} von ${of}`, welcome: "Willkommen",
        detected: "Gerät mit zwei Bildschirmen erkannt.", intro: "Sie können diese Website als Magazin lesen. Ziehen Sie eine Seite mit dem Finger, um umzublättern.",
    },
    en: {
        open: "Read as a magazine", close: "Read as a normal website", next: "Next page", drag: "Drag a page to turn it", book: "Magazine",
        page: (n, of) => `Page ${n} of ${of}`, welcome: "Welcome",
        detected: "Two-screen device detected.", intro: "You can read this website as a magazine. Drag a page with your finger to turn it.",
    },
};
const t = (k) => TEXT[currentLang() === "en" ? "en" : "de"][k];

// One drafting style for every drawing in the book, like a manual's: fine black lines of one weight on white. The
// hand: the index finger pointing up, its tip at 23,4 of 48×58. Decorative: what a drawing shows is also real text
// or a labelled button.
const HAND_PATHS = '<path d="M25 51.6V56h14v-4.4"/>'
    + '<path d="M19.5 33V7.5a3.5 3.5 0 0 1 7 0V23a3.2 3.2 0 0 1 6.4 0v2a3.1 3.1 0 0 1 6.2 0v2.5a2.9 2.9 0 0 1 5.8 0V37c0 9-4.9 15-13.9 15H27c-5 0-8-2.5-11-6.5l-6.5-9a3.2 3.2 0 0 1 5.1-3.9L19.5 37z"/>'
    + '<path d="M26.5 23v6M32.9 25v5M39.1 27.5v4.5M21.4 7a1.6 1.6 0 0 1 3.2 0" fill="none"/>';
const LINE = 'fill="#fff" stroke="#111" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';
const HAND = `<svg viewBox="0 0 48 58" aria-hidden="true" focusable="false" ${LINE}>${HAND_PATHS}</svg>`;
// The welcome page's drawing: an open book on its spine (a centre line), a leaf being turned by the same hand, the
// path of the turn as a dashed arc. The leaf and the hand sway a little.
const TURN_DRAWING = `<svg class="kalq-mag-welcome__drawing" viewBox="0 0 260 170" aria-hidden="true" focusable="false" ${LINE}>`
    + '<path d="M130 16V160" fill="none" stroke-dasharray="8 3 1.5 3" opacity=".5"/>'
    + '<path d="M130 36C108 28 74 26 40 32V142C74 136 108 138 130 146Z"/>'
    + '<path d="M130 36C152 28 186 26 220 32V142C186 136 152 138 130 146Z"/>'
    + '<path d="M54 52h58M54 61h52M54 70h56M54 79h40M54 96h58M54 105h48" fill="none" opacity=".35"/>'
    + '<path d="M150 61h52M150 70h56M150 79h44" fill="none" opacity=".2"/>'
    + '<path d="M204 12C176 0 118 -1 80 12" fill="none" stroke-dasharray="3 3"/><path d="M86 6l-6 6 8 2.5" fill="none"/>'
    + '<g class="kalq-mag-welcome__leaf"><path d="M130 36C148 24 170 16 194 18C186 52 182 100 186 130C164 130 146 136 130 146Z"/>'
    + '<path d="M146 50h34M146 59h30M146 68h33" fill="none" opacity=".35"/>'
    + `<g transform="translate(170 76) rotate(-28) scale(.78)">${HAND_PATHS}</g></g></svg>`;
const HAND_TIP = { x: 23 / 48, y: 4 / 58 }; // where the fingertip is, as a share of the drawing's width and height
const DRAG_SEEN = "kalq-mag-drag-hint";
const WEB_CHOSEN = "kalq-mag-web"; // the reader chose the web page: no book by itself for the rest of the visit
const chosenWeb = () => { try { return sessionStorage.getItem(WEB_CHOSEN) === "1"; } catch { return false; } };
const chooseWeb = (on) => { try { on ? sessionStorage.setItem(WEB_CHOSEN, "1") : sessionStorage.removeItem(WEB_CHOSEN); } catch { /* private mode */ } };

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
    // counters count up as they scroll into view on the page; in the book they show where they end
    [c, ...c.querySelectorAll("*")].filter((n) => n.dataset?.kalqFinal).forEach((n) => { n.textContent = n.dataset.kalqFinal; n.removeAttribute("data-kalq-final"); });
    if (c.matches(".kalq-m-faq__item")) {
        c.querySelectorAll(".kalq-m-faq__a").forEach((a) => { a.hidden = false; a.removeAttribute("role"); });
        c.querySelectorAll(".kalq-m-faq__toggle").forEach((b) => { const h = document.createElement("span"); h.append(...b.childNodes); b.replaceWith(h); });
    }
    return c;
}

// Fill pages of the given size, section by section (each starts on a new page), with whole elements. Elements that
// lead into the next one travel with it as one unit, so a page never ends on them: a short label ("06") always, a
// heading when its own content follows (not the next item's label, not a heading of the same or a higher level). A
// unit that does not fit goes to the next page; a unit taller than a page gets one to itself and the page scrolls; if
// a section's last page would hold a single unit, the unit before it comes along.
const isLabel = (el) => el.matches("p, span, div") && el.textContent.trim().length <= 3;
const level = (el) => (/^H([1-6])$/.exec(el.tagName) || [])[1];
const leadsIn = (el, next) => {
    if (!next) return false;
    if (isLabel(el)) return true;
    const n = level(el);
    if (!n) return false;
    const m = level(next);
    return !isLabel(next) && !(m && m <= n);
};

function unitsOf(blocks) {
    const units = [];
    let open = [];
    blocks.forEach((el, i) => {
        open.push(el);
        if (!leadsIn(el, blocks[i + 1])) { units.push(open); open = []; }
    });
    return units;
}

function paginate(measure, sections, pageW, pageH) {
    const pages = [];
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
        p.units = [];
        return p;
    };
    const overflows = (p) => p.firstChild.scrollHeight > p.firstChild.clientHeight + 1;
    const place = (p, unit) => { p.firstChild.append(...unit); p.units.push(unit); };
    const take = (p, unit) => { unit.forEach((el) => el.remove()); p.units.splice(p.units.indexOf(unit), 1); };

    sections.forEach((blocks) => {
        const own = [];
        let page = null;
        unitsOf(blocks).forEach((unit) => {
            if (!page) own.push(page = fresh());
            place(page, unit);
            if (!overflows(page)) return;
            if (page.units.length > 1) { take(page, unit); own.push(page = fresh()); place(page, unit); }
            if (!overflows(page)) return;
            // the unit alone is taller than a page: it keeps the page to itself, whole, and the page scrolls
            page.classList.add("is-scroll");
            page = null;
        });
        // a section's last page with a single unit on it: the unit before it comes along, if both fit
        const [prev, last] = own.slice(-2);
        if (prev && last && last.units.length === 1 && prev.units.length > 1 && !last.classList.contains("is-scroll")) {
            const unit = prev.units.at(-1);
            take(prev, unit);
            last.firstChild.prepend(...unit);
            last.units.unshift(unit);
            if (overflows(last)) { take(last, unit); place(prev, unit); }
        }
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
    // the one way on from the cover: an arrow in a circle, a real button (the engine leaves buttons to themselves)
    const cue = document.createElement("div");
    cue.className = "kalq-mag-cue";
    cue.innerHTML = '<span class="kalq-mag-cue__ripple" aria-hidden="true"></span><span class="kalq-mag-cue__ripple" aria-hidden="true"></span>'
        + `<button type="button" class="kalq-mag-cue__btn" aria-label="${t("next")}" title="${t("next")}">`
        + '<svg class="kalq-mag-cue__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
        + `<span class="kalq-mag-cue__hand" aria-hidden="true">${HAND}</span>`;
    p.append(cue);
    return p;
}

//=================================== Hints ===================================//
// The box around the pages in view
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
    // measured once the turned page has settled
    requestAnimationFrame(() => requestAnimationFrame(() => { if (overlay.isConnected) dragHand(overlay, pages, pageW); }));
}

function dragHand(overlay, pages, pageW) {
    const box = shownBox(pages);
    if (!box) return;
    const hint = document.createElement("div");
    hint.className = "kalq-mag-drag";
    hint.setAttribute("aria-hidden", "true");
    hint.style.left = `${box.right}px`;
    hint.style.top = `${box.bottom}px`;
    hint.innerHTML = `<span class="kalq-mag-drag__fold"></span><span class="kalq-mag-drag__hand">${HAND}</span>`;
    overlay.append(hint);
    const fold = hint.firstElementChild, hand = hint.lastElementChild;
    const size = Math.round(Math.min(pageW * 0.42, 220));
    const hw = 46, hh = hw * 58 / 48;
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

//=================================== Open and close ===================================//
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

function geometry() {
    if (spanned.matches) {
        // one page per screen, the spine in the middle of the hinge
        const w = Math.floor(window.innerWidth / 2), h = window.innerHeight;
        return { pageW: w, pageH: h, portrait: false, hinge: hingeWidth() };
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
    if (auto && (closedByUser || chosenWeb())) return;
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
    // the way back sits where the header's book icon is; pages start their content below it
    const spotOf = () => (toggle?.isConnected ? toggle : document.querySelector(".site-menu-toggle"))?.getBoundingClientRect();
    const spot = spotOf();
    const clear = spot?.width ? Math.ceil(spot.bottom + 14 - (window.innerHeight - pageH) / 2) : 0;
    overlay.style.setProperty("--kalq-mag-top", `${Math.max(48, clear)}px`);
    const stage = document.createElement("div");
    stage.className = "kalq-magazine__book";
    // measure pages off screen at their real size, then hand them to the engine
    const measure = document.createElement("div");
    measure.className = "kalq-magazine__measure";
    overlay.append(stage, measure);
    document.body.append(overlay);

    const hero = sections.find((s) => s.matches(".header, .expertise_header, .about_header"));
    const parts = sections.filter((s) => s !== hero).map((s) => blocksOf(s).map(copyOf));
    const footer = page.querySelector("footer");
    if (footer) parts.push(blocksOf(footer).map(copyOf));
    const inner = paginate(measure, parts.filter((b) => b.length), pageW, pageH);
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
        drawShadow: !reducedMotion.matches, maxShadowOpacity: 0.45, flippingTime: reducedMotion.matches ? 1 : 750,
        showPageCorners: !reducedMotion.matches, disableFlipByClick: true, mobileScrollSupport: false, swipeDistance: 24,
        startPage: 0, startZIndex: 2,
    });
    flip.loadFromHTML(pages);

    // Controls: the page number and the drag hint along the bottom; the way back to the web page as an icon where the
    // header's book icon sits, and on the welcome page. The cover's button, dragging, the pages' edges and the keys
    // turn pages.
    const bar = document.createElement("div");
    bar.className = "kalq-magazine__bar";
    const status = document.createElement("span");
    status.className = "kalq-magazine__status";
    status.setAttribute("aria-live", "polite");
    const tip = document.createElement("span"); // the drag hint as words
    tip.className = "kalq-magazine__tip";
    tip.setAttribute("role", "status");
    tip.hidden = true;
    bar.append(status, tip);
    const exit = document.createElement("button");
    exit.type = "button";
    exit.className = "kalq-magazine__exit";
    exit.setAttribute("aria-label", t("close"));
    exit.title = t("close");
    exit.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 9h17M6.4 7h.01M8.6 7h.01"/></svg>';
    exit.addEventListener("click", () => leaveForWeb());
    // the header settles (fonts, its own buttons) after the book opens: the icon follows the book icon's place
    const placeExit = () => {
        const r = spotOf();
        if (r?.width) Object.assign(exit.style, { left: `${Math.round(r.left + r.width / 2 - 17)}px`, top: `${Math.round(r.top + r.height / 2 - 17)}px`, right: "auto" });
    };
    placeExit();
    overlay.append(bar, exit);

    // The welcome page: beside the cover, where the book has no page yet (two pages side by side only)
    let welcome = null;
    if (!portrait) {
        welcome = document.createElement("section");
        welcome.className = "kalq-mag-welcome";
        welcome.setAttribute("aria-label", t("welcome"));
        Object.assign(welcome.style, { width: `${pageW}px`, height: `${pageH}px` });
        welcome.innerHTML = `<div class="kalq-mag-welcome__body">${TURN_DRAWING}<p class="kalq-mag-welcome__text">`
            + (spanned.matches ? `<strong>${t("detected")}</strong> ` : "") + `${t("intro")}</p>`
            + `<button type="button" class="kalq-mag-welcome__web">${t("close")}</button></div>`;
        welcome.querySelector("button").addEventListener("click", () => leaveForWeb());
        stage.prepend(welcome);
    }
    const cue = pages[0].querySelector(".kalq-mag-cue");
    cue.querySelector("button").addEventListener("click", () => flip.flipNext());
    cue.classList.add("is-play"); // the tap hint, once on arrival (CSS; none under reduced motion)

    // A tap on a page's outer edge turns it (the engine itself turns pages tapped on a corner: then nothing more)
    let down = null;
    stage.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, time: Date.now() }; });
    stage.addEventListener("pointerup", (e) => {
        const tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && Date.now() - down.time < 500;
        down = null;
        if (!tap || e.target.closest("a, button, input, textarea, select, video[controls], .kalq-mag-welcome")) return;
        const box = shownBox(pages);
        if (!box) return;
        const edge = Math.max(40, pageW * 0.14);
        const dir = e.clientX > box.right - edge ? 1 : e.clientX < box.left + edge ? -1 : 0;
        if (!dir) return;
        const at = flip.getCurrentPageIndex();
        setTimeout(() => { if (flip.getState() === "read" && flip.getCurrentPageIndex() === at) (dir > 0 ? flip.flipNext() : flip.flipPrev()); }, 40);
    });

    const update = () => {
        const i = flip.getCurrentPageIndex();
        status.textContent = t("page")(i + 1, pages.length);
        if (i !== 1) tip.hidden = true;
        placeExit();
        if (flip.getState() !== "read") overlay.querySelectorAll(".kalq-mag-drag").forEach((n) => n.remove()); // turning on: the hint has done its job
        // the welcome page lies under the left pages; in front and reachable only while the cover is closed
        if (welcome) {
            const atCover = i === 0 && flip.getState() === "read";
            welcome.classList.toggle("is-front", atCover);
            welcome.inert = !atCover;
        }
        // only what is shown is reachable and playing
        pages.forEach((p) => {
            const shown = p.style.display !== "none" && p.closest(".stf__item, .stf__parent") && getComputedStyle(p).display !== "none";
            p.inert = !shown;
            p.querySelectorAll("video").forEach((v) => (shown && !reducedMotion.matches ? v.play?.()?.catch(() => { }) : v.pause()));
        });
    };
    flip.on("flip", () => { update(); if (flip.getCurrentPageIndex() === 1) dragHint(overlay, pages, pageW, tip); overlay.querySelector(".kalq-mag-page:not([inert]) :is(h1, h2, h3, p)")?.closest(".kalq-mag-page")?.focus?.({ preventScroll: true }); });
    flip.on("changeState", update);
    setTimeout(update, 50);

    // Keys work wherever focus is while the book is open (after a drag it sits on the page body). The book is
    // read-only: the site's own shortcuts (editing, comments, panels) never reach the page underneath. Tab, Enter
    // and Space keep their usual meaning.
    const onKey = (e) => {
        const step = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
        const act = step ? () => (step > 0 ? flip.flipNext() : flip.flipPrev())
            : e.key === "Home" ? () => { flip.turnToPage(0); update(); }
            : e.key === "End" ? () => { flip.turnToPage(pages.length - 1); update(); }
            : e.key === "Escape" ? () => leaveForWeb() : null;
        e.stopImmediatePropagation();
        if (!act) return;
        e.preventDefault();
        act();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", placeExit);
    document.fonts?.ready.then(placeExit);
    setTimeout(placeExit, 600);
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
    book = { overlay, flip, pages, onKey, onTouch, placeExit, returnFocus: document.activeElement };
    pages[0].tabIndex = -1;
    // focus without scrolling: the button sits inside the engine's page, whose clipped ancestors a scroll would shift
    cue.querySelector("button").focus({ preventScroll: true });
}

// The reader's way back: the web page for the rest of the visit (the header's book icon still opens the book)
function leaveForWeb() {
    chooseWeb(true);
    closeMagazine(true);
}

export function closeMagazine(byUser = false) {
    if (!book) return;
    if (byUser) closedByUser = true;
    window.removeEventListener("keydown", book.onKey, true);
    window.removeEventListener("resize", book.placeExit);
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
