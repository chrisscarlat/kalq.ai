// Server render of a page: the built page HTML, arranged by its stored layout and filled with its newest content,
// so the page without JavaScript already has every heading, text, link, list and image in document order.
// Drafts and placeholders (blocks without any revision) never appear here; editors get drafts, marked as such.
import { parseHTML } from "linkedom";
import { renderBlock } from "../js/blocks.js";
import { applyLayout, layoutKey, parseLayout } from "../js/layout.js";
import { fillScreen2, renderModule } from "../js/modules/registry.js";

const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const SKIP_ATTRS = new Set(["src", "autoplay", "muted", "loop", "playsinline", "preload", "poster", "alt", "loading", "width", "height"]);
const MARQUEE_REPEAT = 60; // as js/i18n.js

// rows: latest_content(page): { block_key, lang, content, type }
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

export function applyContent(doc, store, lang = "de") {
    doc.querySelectorAll("[data-kalq-key]").forEach((el) => {
        const entry = store.get(el.getAttribute("data-kalq-key"));
        if (!entry) return;
        const type = el.getAttribute("data-kalq-type") || "text";
        if (type === "image" || type === "video") {
            if ("media" in entry) setMedia(doc, el, entry.media);
            return;
        }
        const html = entry[lang] ?? entry.de ?? entry.en;
        if (html == null) return;
        if (el.hasAttribute("data-i18n-marquee")) el.textContent = " " + `${html.replace(/<[^>]+>/g, "")} `.repeat(MARQUEE_REPEAT);
        else renderBlock(el, html);
    });
}

// html: the built page; rows: its newest content; editor: show drafts (marked) and keep the built-in sections the
// layout removed, so they can come back without a reload
export function renderPage(html, page, rows, { editor = false } = {}) {
    const { document } = parseHTML(html);
    const container = document.querySelector('[data-barba="container"]');
    const store = contentMap(rows);
    let stash = "";
    if (container) {
        // The built-in sections as built, for copies and for editors (before any content is applied)
        const builtins = [...container.querySelectorAll(":scope > section[data-section-builtin]")].map((s) => s.cloneNode(true));
        const modules = (entry, doc) => renderModule(entry, { doc, page, store, lang: "de", editor });
        applyLayout({ doc: document, container, page, stored: parseLayout(store.get(layoutKey(page))?.media), editor, renderModule: modules });
        if (editor) {
            const keep = document.createElement("template");
            keep.className = "kalq-sections";
            container.append(keep);
            stash = builtins.map((n) => n.toString()).join("");
        }
    }
    applyContent(document, store);
    if (container) fillScreen2(container, document); // call-to-action bands' right screen on two-screen devices
    // linkedom does not serialise a template's content, so the stored sections go in as text
    const out = document.toString();
    return stash ? out.replace('<template class="kalq-sections"></template>', `<template class="kalq-sections">${stash}</template>`) : out;
}
