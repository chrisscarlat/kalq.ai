// Module library for the page builder. Shared by the server render (lib/render-page.js, on a linkedom document) and
// the browser (insert, edit, live changes), so no browser globals at the top level.
//
// A module has versions; all versions of a module share its slots, so switching version never loses content.
// Every slot is a block "<page>.<sectionId>.<slot>" (text per language, or one image/video for both).
// A placeholder is a slot without any revision: editors see a labelled empty block, the public page never gets it.
// Placeholder labels name the kind of content ("Frage", "Antwort"); they never invent claims, numbers or quotes.
import { renderBlock } from "../blocks.js";

const SAFE_HREF = /^(https?:|mailto:|\/|#|[\w-]+\.html(#.*)?$)/i;
const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export const CATEGORIES = [
    { id: "heroes", de: "Heroes", en: "Heroes", note: { de: "Wird pro Stil gewählt (Phase 4).", en: "Chosen per style (phase 4)." } },
    { id: "navigation", de: "Navigation", en: "Navigation", note: { de: "Wird pro Stil gewählt (Phase 4).", en: "Chosen per style (phase 4)." } },
    { id: "content", de: "Inhalt", en: "Content" },
    { id: "cards", de: "Karten", en: "Cards", note: { de: "Kommt in Phase 5.", en: "Coming in phase 5." } },
    { id: "cta", de: "Handlungsaufrufe", en: "Calls to action" },
    { id: "interaction", de: "Newsletter und Interaktion", en: "Newsletter and interaction", note: { de: "Kommt in Phase 6.", en: "Coming in phase 6." } },
    { id: "faq", de: "FAQ", en: "FAQs" },
    { id: "footers", de: "Footer", en: "Footers", note: { de: "Wird pro Stil gewählt (Phase 3).", en: "Chosen per style (phase 3)." } },
];

// Slot kinds: heading (h2), eyebrow, text (paragraphs), button (label) + link (address), media (image or video)
// magazine: how the module reads as a spread in the magazine (js/book/layouts.js), like its versions for the page:
//   layout A (picture | text, order per version), C (picture across), F (questions | answer); media: which slot is the
//   spread's picture
const L = (de, en) => ({ de, en });
const FAQ_ITEMS = 6;

export const MODULES = {
    "content.split": {
        category: "content",
        name: L("Bild und Text nebeneinander", "Image and text side by side"),
        keywords: "split image text bild text zwei spalten two columns",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            text: { kind: "text", label: L("Text", "Text"), required: true },
            button: { kind: "button", label: L("Button-Text", "Button label") },
            link: { kind: "link", label: L("Button-Link (z. B. platform.html)", "Button link (e.g. platform.html)") },
            media: { kind: "media", label: L("Bild oder Video", "Image or video"), required: true },
        },
        versions: {
            "image-left": { name: L("Bild links, Text rechts", "Image left, text right"),
                wire: [["media", 4, 6, 44, 48], ["eyebrow", 54, 16, 14], ["heading", 54, 22, 36], ["heading", 54, 28, 26], ["line", 54, 36, 38], ["line", 54, 40, 34], ["line", 54, 44, 30], ["button", 54, 50, 14]] },
            "text-left": { name: L("Text links, Bild rechts", "Text left, image right"),
                wire: [["eyebrow", 4, 16, 14], ["heading", 4, 22, 36], ["heading", 4, 28, 26], ["line", 4, 36, 38], ["line", 4, 40, 34], ["line", 4, 44, 30], ["button", 4, 50, 14], ["media", 52, 6, 44, 48]] },
        },
        magazine: { layout: "A", order: { "image-left": "media-text", "text-left": "text-media" } },
        render: renderSplit,
    },
    "content.media-center": {
        category: "content",
        name: L("Bild oder Video in der Mitte", "Central image or video"),
        keywords: "central centre center image video bild video mitte",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            media: { kind: "media", label: L("Bild oder Video", "Image or video"), required: true },
            caption: { kind: "text", label: L("Bildunterschrift", "Caption") },
        },
        versions: {
            image: { name: L("Zentrales Bild", "Central image"),
                wire: [["heading", 30, 6, 40], ["media", 10, 13, 80, 36], ["line", 30, 53, 40]] },
            video: { name: L("Zentrales Video", "Central video"),
                wire: [["heading", 30, 6, 40], ["media", 4, 13, 92, 36, "play"], ["line", 30, 53, 40]] },
        },
        magazine: { layout: "C" },
        render: renderMediaCenter,
    },
    "cta.band": {
        category: "cta",
        name: L("Aufruf-Band", "Call to action band"),
        keywords: "call to action cta band banner aufruf button",
        slots: {
            heading: { kind: "heading", label: L("Aufruf", "Call to action"), required: true },
            text: { kind: "text", label: L("Text", "Text") },
            button: { kind: "button", label: L("Button-Text", "Button label"), required: true },
            link: { kind: "link", label: L("Button-Link", "Button link"), required: true },
            media2: { kind: "media", label: L("Bild für zwei Bildschirme (optional)", "Picture for two screens (optional)") },
        },
        versions: {
            centered: { name: L("Zentriert", "Centred"),
                wire: [["band", 0, 8, 100, 44], ["heading", 22, 20, 56, "light"], ["heading", 30, 27, 40, "light"], ["line", 32, 36, 36, "light"], ["button", 43, 43, 14, "light"]] },
            split: { name: L("Text links, Button rechts", "Text left, button right"),
                wire: [["band", 0, 14, 100, 32], ["heading", 6, 23, 50, "light"], ["line", 6, 31, 40, "light"], ["button", 78, 26, 16, "light"]] },
        },
        magazine: { layout: "A", order: "text-media", media: "media2" }, // the text facing its picture for two screens
        render: renderCtaBand,
    },
    "faq.single": {
        category: "faq",
        name: L("Fragen und Antworten", "Questions and answers"),
        keywords: "faq questions answers fragen antworten accordion akkordeon",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            ...Object.fromEntries(Array.from({ length: FAQ_ITEMS }, (_, i) => [
                [`q${i + 1}`, { kind: "question", label: L(`Frage ${i + 1}`, `Question ${i + 1}`), required: i === 0 }],
                [`a${i + 1}`, { kind: "answer", label: L(`Antwort ${i + 1}`, `Answer ${i + 1}`), required: i === 0 }],
            ]).flat()),
        },
        versions: {
            single: { name: L("Eine Spalte, aufklappbar", "One column, expandable"),
                wire: [["heading", 30, 6, 40], ...[16, 26, 36, 46].flatMap((y) => [["line", 18, y, 56, "bold"], ["plus", 80, y], ["rule", 18, y + 5, 66]])] },
            split: { name: L("Überschrift links, Fragen rechts", "Heading left, questions right"),
                wire: [["heading", 4, 10, 28], ["heading", 4, 16, 20], ...[10, 20, 30, 40].flatMap((y) => [["line", 42, y, 44, "bold"], ["plus", 92, y], ["rule", 42, y + 5, 54]])] },
        },
        magazine: { layout: "F" },
        render: renderFaq,
    },
};

export const moduleVersion = (module, version) => MODULES[module]?.versions[version] ? MODULES[module].versions[version] : null;

//=================================== Rendering ===================================//
// ctx: { doc, page, id, entry, store (key -> {type, de, en, media}), lang, editor }
const keyOf = (ctx, slot) => `${ctx.page}.${ctx.id}.${slot}`;

function textOf(ctx, slot) {
    const e = ctx.store.get(keyOf(ctx, slot));
    if (!e) return null;
    return e[ctx.lang] ?? e.de ?? e.en ?? null;
}

const mediaOf = (ctx, slot) => ctx.store.get(keyOf(ctx, slot))?.media || null;

// A slot's element: filled from its block, or for editors an empty placeholder with its label; for the public page
// an empty slot is left out (null)
function slotEl(ctx, slot, tag, { className = "", format } = {}) {
    const def = MODULES[ctx.entry.module].slots[slot];
    const html = textOf(ctx, slot);
    if (html == null && !ctx.editor) return null;
    const el = ctx.doc.createElement(tag);
    if (className) el.className = className;
    el.setAttribute("data-kalq-key", keyOf(ctx, slot));
    if (format) el.setAttribute("data-kalq-format", format);
    if (html != null) renderBlock(el, html);
    else placeholder(el, def);
    return el;
}

function placeholder(el, def) {
    el.classList.add("kalq-ph");
    el.setAttribute("data-ph-de", def.label.de);
    el.setAttribute("data-ph-en", def.label.en);
}

function mediaEl(ctx, slot, className) {
    const url = mediaOf(ctx, slot);
    const def = MODULES[ctx.entry.module].slots[slot];
    if (!url && !ctx.editor) return null;
    const box = ctx.doc.createElement("div");
    box.className = `${className} kalq-m-media`;
    let el;
    if (!url) {
        el = ctx.doc.createElement("div");
        placeholder(el, def);
        el.classList.add("kalq-ph-media");
    } else if (VIDEO_URL.test(url)) {
        el = ctx.doc.createElement("video");
        ["muted", "loop", "playsinline", "autoplay"].forEach((a) => el.setAttribute(a, ""));
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("src", url);
    } else {
        el = ctx.doc.createElement("img");
        el.setAttribute("src", url);
        el.setAttribute("alt", "");
        el.setAttribute("loading", "lazy");
    }
    el.setAttribute("data-kalq-key", keyOf(ctx, slot));
    el.setAttribute("data-kalq-type", "image");
    box.append(el);
    return box;
}

// A button: a real link when it has a label and a safe address. Editors get the address as an editable field.
function buttonEl(ctx, className = "kalq-m-button") {
    const wrap = ctx.doc.createElement("div");
    wrap.className = "kalq-m-actions";
    const label = textOf(ctx, "button");
    const href = (textOf(ctx, "link") || "").replace(/<[^>]+>/g, "").trim();
    if (!ctx.editor) {
        if (!label || !SAFE_HREF.test(href)) return null;
        const a = ctx.doc.createElement("a");
        a.className = className;
        a.setAttribute("href", href);
        renderBlock(a, label);
        wrap.append(a);
        return wrap;
    }
    const a = ctx.doc.createElement("span");
    a.className = className;
    a.setAttribute("data-kalq-key", keyOf(ctx, "button"));
    if (label != null) renderBlock(a, label); else placeholder(a, MODULES[ctx.entry.module].slots.button);
    wrap.append(a);
    const link = slotEl(ctx, "link", "span", { className: "kalq-m-link-field" });
    if (link) wrap.append(link);
    return wrap;
}

function section(ctx, className) {
    const s = ctx.doc.createElement("section");
    s.className = `kalq-m ${className}`;
    s.setAttribute("data-module", `${ctx.entry.module}:${ctx.entry.version || ""}`);
    return s;
}

const append = (parent, ...nodes) => { nodes.forEach((n) => n && parent.append(n)); return parent; };

function renderSplit(ctx) {
    const s = section(ctx, `kalq-m-split is-${ctx.entry.version === "text-left" ? "text-left" : "image-left"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const text = ctx.doc.createElement("div");
    text.className = "kalq-m-split__text";
    append(text, slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }),
        slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }), buttonEl(ctx));
    append(inner, mediaEl(ctx, "media", "kalq-m-split__media"), text);
    return append(s, inner);
}

function renderMediaCenter(ctx) {
    const s = section(ctx, `kalq-m-center is-${ctx.entry.version === "video" ? "video" : "image"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const figure = ctx.doc.createElement("figure");
    figure.className = "kalq-m-center__figure";
    append(figure, mediaEl(ctx, "media", "kalq-m-center__media"));
    const caption = slotEl(ctx, "caption", "figcaption", { className: "kalq-m-caption" });
    if (caption) figure.append(caption);
    append(inner, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }), figure);
    return append(s, inner);
}

function renderCtaBand(ctx) {
    const s = section(ctx, `kalq-m-cta is-${ctx.entry.version === "split" ? "split" : "centered"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const text = ctx.doc.createElement("div");
    text.className = "kalq-m-cta__text";
    append(text, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }), slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }));
    append(inner, text, buttonEl(ctx, "kalq-m-button is-light"), screen2(ctx));
    return append(s, inner);
}

// The right screen on a two-screen device: the optional picture for two screens; without one, the server (and the
// browser after an edit) put in the page's first video, else its first image, else the panel stays calm in the band's
// colour. Hidden everywhere else; editors see it to set the picture.
function screen2(ctx) {
    const box = ctx.doc.createElement("div");
    box.className = "kalq-m-cta__screen2";
    box.setAttribute("aria-hidden", "true");
    const own = mediaEl(ctx, "media2", "kalq-m-cta__screen2-media");
    if (own) box.append(own);
    if (!mediaOf(ctx, "media2")) box.setAttribute("data-auto", "");
    return box;
}

// The page's first video, else its first image, outside call-to-action bands (for their right screen)
export function firstPageMedia(container) {
    const outside = (n) => !n.closest(".kalq-m-cta, .kalq-picker, .kalq-device");
    const video = [...container.querySelectorAll("video")].find((v) => outside(v) && (v.getAttribute("src") || v.querySelector("source")?.getAttribute("src")));
    if (video) return { kind: "video", src: video.getAttribute("src") || video.querySelector("source").getAttribute("src") };
    const img = [...container.querySelectorAll("img[src]")].find((i) => outside(i) && !/\.svg(\?|$)/i.test(i.getAttribute("src")));
    return img ? { kind: "img", src: img.getAttribute("src") } : null;
}

// Fill the call-to-action panels that have no picture of their own; decorative, loaded only when shown
export function fillScreen2(container, doc) {
    const media = firstPageMedia(container);
    container.querySelectorAll(".kalq-m-cta__screen2[data-auto]").forEach((box) => {
        if (box.querySelector(".kalq-auto") || !media) return;
        const el = doc.createElement(media.kind === "video" ? "video" : "img");
        el.className = "kalq-auto";
        el.setAttribute("src", media.src);
        el.setAttribute("aria-hidden", "true");
        if (media.kind === "video") ["muted", "loop", "playsinline"].forEach((a) => el.setAttribute(a, "")), el.setAttribute("preload", "none");
        else el.setAttribute("alt", ""), el.setAttribute("loading", "lazy");
        box.append(el);
    });
}

// Real headings and buttons: each question is a <button> that opens its answer (works as plain text without JS:
// the answers are in the HTML and only hidden once the script runs)
function renderFaq(ctx) {
    const s = section(ctx, `kalq-m-faq is-${ctx.entry.version === "split" ? "split" : "single"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const head = ctx.doc.createElement("div");
    head.className = "kalq-m-faq__head";
    append(head, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }));
    const list = ctx.doc.createElement("div");
    list.className = "kalq-m-faq__list";
    for (let i = 1; i <= FAQ_ITEMS; i++) {
        const q = slotEl(ctx, `q${i}`, "span", { className: "kalq-m-faq__q" });
        const a = slotEl(ctx, `a${i}`, "div", { className: "kalq-m-faq__a", format: "paragraphs" });
        if (!q || (!a && !ctx.editor)) continue;
        const item = ctx.doc.createElement("div");
        item.className = "kalq-m-faq__item";
        const h = ctx.doc.createElement("h3");
        h.className = "kalq-m-faq__title";
        if (ctx.editor) h.append(q); // editors edit the question text in place
        else {
            // visitors: the question is a button that opens its answer (js/moduleBehaviour.js); without the script the
            // answers simply stay open
            const b = ctx.doc.createElement("button");
            b.type = "button";
            b.className = "kalq-m-faq__toggle";
            b.setAttribute("aria-expanded", "true");
            b.setAttribute("aria-controls", `${ctx.id}-a${i}`);
            b.append(q);
            h.append(b);
            a.setAttribute("id", `${ctx.id}-a${i}`);
        }
        item.append(h);
        if (a) item.append(a);
        list.append(item);
    }
    append(inner, head, list);
    return append(s, inner);
}

// The entry point used by js/layout.js: an element for a registry module, or null for an unknown one
// A module this code does not know (added by a newer version of the site): visitors never see it, editors get a stub
// so they can still move or remove it. Its stored entry and blocks stay untouched either way.
export function renderModule(entry, ctx) {
    const def = MODULES[entry.module];
    if (def?.versions[entry.version]) return def.render({ ...ctx, entry, id: entry.id });
    if (!ctx.editor) return null;
    const stub = ctx.doc.createElement("section");
    stub.className = "kalq-m-unknown";
    stub.setAttribute("data-module", `${entry.module}:${entry.version || ""}`);
    const note = ctx.doc.createElement("p");
    note.textContent = ctx.lang === "en" ? `Unknown module: ${entry.module} (${entry.version || "–"}), not shown on the page`
        : `Unbekanntes Modul: ${entry.module} (${entry.version || "–"}), wird auf der Seite nicht angezeigt`;
    stub.append(note);
    return stub;
}

// Required slots that are still placeholders (a section with any cannot go live)
export function missingRequired(entry, page, store) {
    const def = MODULES[entry.module];
    if (!def) return [];
    return Object.entries(def.slots).filter(([slot, s]) => {
        if (!s.required) return false;
        const e = store(`${page}.${entry.id}.${slot}`);
        return !e || (s.kind === "media" ? !e.media : e.de == null && e.en == null);
    }).map(([slot, s]) => s.label);
}
