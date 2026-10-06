// Server render of a page: the built page HTML, arranged by its stored layout and filled with its newest content,
// so the page without JavaScript already has every heading, text, link, list and image in document order.
// Drafts and placeholders (blocks without any revision) never appear here; editors get drafts, marked as such.
import { parseHTML } from "linkedom";
import { renderBlock } from "../js/blocks.js";
import { sanitizeSvg } from "./svg-sanitize.js";
import { applyLayout, layoutKey, parseLayout } from "../js/layout.js";
import { renderModule } from "../js/modules/registry.js";
import { filledSomewhere, mediaResolver } from "../js/styleMedia.js";
import { applyNoteSettings } from "../js/dontpanic.js";

const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const SKIP_ATTRS = new Set(["src", "autoplay", "muted", "loop", "playsinline", "preload", "poster", "alt", "loading", "width", "height"]);
const MARQUEE_REPEAT = 60; // as js/i18n.js

// rows: latest_content(page): { block_key, lang, content, type }
// The gate page: only the cookie bar takes the stored settings (the rest of the gate is its own)
export function renderGate(html, rows) {
    const { document } = parseHTML(html);
    const store = contentMap(rows);
    applyNoteSettings(document, (key) => store.get(key) || null);
    return document.toString();
}

export function contentMap(rows) {
    const store = new Map();
    rows.forEach(({ block_key: key, lang, content, type }) => {
        const entry = store.get(key) || { type };
        if (type === "text") entry[lang || "de"] = content;
        else entry.media = content;
        store.set(key, entry);
    });
    return store;
}

function mediaNode(doc, url, like) {
    const video = VIDEO_URL.test(url);
    const node = doc.createElement(video ? "video" : "img");
    if (like) [...like.attributes].forEach((a) => { if (!SKIP_ATTRS.has(a.name)) node.setAttribute(a.name, a.value); });
    if (video) ["muted", "loop", "playsinline", "autoplay"].forEach((a) => node.setAttribute(a, "")), node.setAttribute("aria-hidden", "true");
    else node.setAttribute("alt", like?.getAttribute("alt") || "");
    node.setAttribute("src", url);
    return node;
}

// The same rules as setMedia in js/content.js
function setMedia(doc, el, url) {
    if (el.hasAttribute("data-image")) return el.setAttribute("data-image", url);
    if (el.classList.contains("hero_media") || el.classList.contains("kalq-media-slot")) {
        const section = el.closest("section");
        if (!url) { el.replaceChildren(); section?.classList.remove("has-media"); return; }
        const holder = doc.createElement("i");
        holder.className = el.classList.contains("hero_media") ? "hero_media__el" : "kalq-media-slot__el";
        el.replaceChildren(mediaNode(doc, url, holder));
        section?.classList.add("has-media");
        return;
    }
    if (!url) return;
    const wantVideo = VIDEO_URL.test(url);
    if (wantVideo === (el.tagName === "VIDEO")) {
        const source = el.querySelector("source");
        if (source) source.setAttribute("src", url);
        else el.setAttribute("src", url);
    } else {
        el.replaceWith(mediaNode(doc, url, el));
    }
}

// mediaFor(key): the default style's picture for a slot (js/styleMedia.js); without it the stored one
export function applyContent(doc, store, lang = "de", mediaFor = null) {
    const filled = mediaFor ? filledSomewhere(store) : null;
    doc.querySelectorAll("[data-kalq-key]").forEach((el) => {
        const key = el.getAttribute("data-kalq-key");
        const entry = store.get(key);
        const type = el.getAttribute("data-kalq-type") || "text";
        if (type === "image" || type === "video") {
            if (mediaFor) { const url = mediaFor(key); if (url || filled.has(key)) setMedia(doc, el, url); } // a slot stored nowhere keeps the page's own
            else if (entry && "media" in entry) setMedia(doc, el, entry.media);
            return;
        }
        if (!entry) return;
        const html = entry[lang] ?? entry.de ?? entry.en;
        if (html == null) return;
        if (type === "svg") { el.innerHTML = sanitizeSvg(html); return; } // an SVG logo kept as text (js/modules/final.js)
        if (el.hasAttribute("data-i18n-marquee")) el.textContent = " " + `${html.replace(/<[^>]+>/g, "")} `.repeat(MARQUEE_REPEAT);
        else renderBlock(el, html);
    });
}

// html: the built page; rows: its newest content; editor: show drafts (marked) and keep the built-in sections the
// layout removed, so they can come back without a reload
// The style's navigation and footer as classes on <html> (the same names js/variants.js sets)
export function lookClasses(look) {
    if (!look) return [];
    const menu = ["minimal", "plain", "mega", "overlay"].includes(look.menu_style) ? look.menu_style : null;
    const out = [];
    if (look.menu_style === "panels") out.push("menu-panels");
    if (menu) out.push(`nav-${menu}`);
    if (["minimal", "plain", "mega"].includes(menu)) out.push("nav-bar");
    if (look.footer_style === "harbor") {
        out.push("foot-harbor");
        if (look.footer_wordmark === true) out.push("foot-wordmark");
        if (look.footer_gradient === true) out.push("foot-gradient");
    }
    return out;
}

export function renderPage(html, page, rows, { editor = false, look = null } = {}) {
    const { document } = parseHTML(html);
    const container = document.querySelector('[data-barba="container"]');
    const store = contentMap(rows);
    const mediaFor = mediaResolver((key) => store.get(key), look?.id ? look : null); // the default style's pictures
    let stash = "";
    if (container) {
        // The built-in sections as built, for copies and for editors (before any content is applied)
        const builtins = [...container.querySelectorAll(":scope > section[data-section-builtin]")].map((s) => s.cloneNode(true));
        const modules = (entry, doc) => renderModule(entry, { doc, page, store, lang: "de", editor, mediaFor, mediaStyle: look?.id || "" });
        applyLayout({ doc: document, container, page, stored: parseLayout(store.get(layoutKey(page))?.media), editor, renderModule: modules });
        if (editor) {
            const keep = document.createElement("template");
            keep.className = "kalq-sections";
            container.append(keep);
            stash = builtins.map((n) => n.toString()).join("");
        }
    }
    applyContent(document, store, "de", mediaFor);
    lookClasses(look).forEach((c) => document.documentElement.classList.add(c));
    document.querySelectorAll("[data-current-year]").forEach((n) => { n.textContent = String(new Date().getFullYear()); }); // the legal line's year
    applyNoteSettings(document, (key) => store.get(key) || null); // the cookie bar's mode and texts (site blocks)
    // linkedom does not serialise a template's content, so the stored sections go in as text
    const out = document.toString();
    return stash ? out.replace('<template class="kalq-sections"></template>', `<template class="kalq-sections">${stash}</template>`) : out;
}
