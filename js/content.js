// Edited content: loads the newest revisions for the page from /api/content and applies them to the
// data-kalq-key blocks. Text goes through i18n.js (one version per language), media is applied here.
// Keyed blocks stay hidden (html.kalq-loading) until this ran, at most TIMEOUT_MS.
import { applyLanguage, currentLang, setEditedContent } from "./i18n.js";
import { renderBlock, sanitize } from "./blocks.js";
import { applyLayout, layoutKey, parseLayout } from "./layout.js";
import { renderModule } from "./modules/registry.js";

const TIMEOUT_MS = 1500;
const store = new Map(); // key -> { type, de, en, media }

// Sanitising and rendering live in blocks.js; sanitize stays importable from here
export { sanitize };

const textFor = (key, lang) => {
    const entry = store.get(key);
    if (!entry) return null;
    return entry[lang] ?? null;
};

setEditedContent((key, lang) => textFor(key, lang));

// Any media slot takes an image or a video: the file decides, the element is swapped when needed
const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
export const isVideoUrl = (url) => VIDEO_URL.test(url || "");
const SKIP_ATTRS = new Set(["src", "autoplay", "muted", "loop", "playsinline", "preload", "poster", "alt", "loading", "width", "height"]);

function mediaNode(url, like) {
    const video = isVideoUrl(url);
    const node = document.createElement(video ? "video" : "img");
    if (like) [...like.attributes].forEach((a) => { if (!SKIP_ATTRS.has(a.name) && !a.name.startsWith("data-ph-")) node.setAttribute(a.name, a.value); });
    node.classList.remove("kalq-ph", "kalq-ph-media"); // a filled placeholder is no longer one
    if (video) {
        node.muted = true;
        node.loop = true;
        node.playsInline = true;
        node.autoplay = true;
        ["muted", "loop", "playsinline", "autoplay"].forEach((a) => node.setAttribute(a, ""));
        node.setAttribute("aria-hidden", "true");
        node.src = url;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) node.play?.()?.catch(() => { });
    } else {
        node.alt = "";
        node.src = url;
    }
    return node;
}

const currentUrl = (node) => (node.tagName === "VIDEO" ? node.querySelector("source")?.getAttribute("src") || node.getAttribute("src") : node.getAttribute("src"));

export function setMedia(el, url) {
    // Hover rows on Home keep their image in data-image
    if (el.hasAttribute("data-image")) { el.dataset.image = url; return; }
    // Hero slots: a wrapper that holds the image or video, or nothing
    if (el.classList.contains("hero_media")) {
        const section = el.closest("section");
        if (!url) { el.replaceChildren(); section?.classList.remove("has-media"); return; }
        const old = el.firstElementChild;
        if (!old || currentUrl(old) !== url) el.replaceChildren(mediaNode(url, old || Object.assign(document.createElement("i"), { className: "hero_media__el" })));
        section?.classList.add("has-media");
        return;
    }
    // <img> or <video> in the page: same kind updates, other kind replaces the element
    if (!url || currentUrl(el) === url) return;
    const wantVideo = isVideoUrl(url);
    if (wantVideo === (el.tagName === "VIDEO")) {
        const source = el.querySelector("source");
        if (source) { source.setAttribute("src", url); el.load(); el.play?.()?.catch(() => { }); }
        else el.setAttribute("src", url);
    } else {
        el.replaceWith(mediaNode(url, el));
    }
}

// A style variant can replace any image or the hero video (js/variants.js); null keeps the page's own
let mediaOverride = () => null;
export const setMediaOverride = (fn) => { mediaOverride = fn; };

// What a media slot showed in the HTML, so switching back to a variant without a replacement restores it
const defaultUrl = (el) => (el.classList.contains("hero_media") ? "" : el.getAttribute("data-image") ?? currentUrl(el) ?? "");

// Blocks that are not translated: media, counter numbers, email addresses
export function applyDirect(root) {
    root.querySelectorAll("[data-kalq-key]").forEach((el) => {
        const key = el.dataset.kalqKey;
        const entry = store.get(key);
        const type = el.dataset.kalqType || "text";

        if (type === "image" || type === "video") {
            if (el.dataset.kalqDefault === undefined) el.dataset.kalqDefault = defaultUrl(el);
            const url = mediaOverride(key) || (entry && "media" in entry ? entry.media : el.dataset.kalqDefault);
            setMedia(el, url || "");
        } else if (!entry) {
            return;
        } else if (type === "text" && !el.hasAttribute("data-i18n") && !el.hasAttribute("data-i18n-marquee")) {
            const html = textFor(el.dataset.kalqKey, currentLang()) ?? entry.de ?? entry.en;
            if (html == null) return;
            renderBlock(el, html);
            // An edited email address also changes where the link goes
            const link = el.closest('a[href^="mailto:"]');
            if (link && /^[^\s@]+@[^\s@]+$/.test(el.textContent.trim())) {
                link.setAttribute("href", link.getAttribute("href").replace(/^mailto:[^?]*/, `mailto:${el.textContent.trim()}`));
            }
        }
    });
}

// The current page's container (during a Barba transition the new one is the last)
const currentContainer = () => { const all = document.querySelectorAll('[data-barba="container"]'); return all[all.length - 1] || null; };

// Arrange the page's sections by the stored layout (the server already did for the first view; this follows edits,
// restores, previews and other people's changes). Editors' pages carry the built-in section store.
export function applyStoredLayout(container = currentContainer()) {
    const page = container?.dataset.page;
    if (!page) return null;
    const sig = (s) => s.dataset.section + (s.dataset.sectionState || "") + (s.dataset.sectionTheme || "");
    const before = [...container.querySelectorAll(":scope > section[data-section]")].map(sig).join();
    const editor = !!container.querySelector(":scope > template.kalq-sections");
    const modules = (entry, doc) => renderModule(entry, { doc, page, store, lang: currentLang(), editor });
    const layout = applyLayout({ doc: document, container, page, stored: parseLayout(store.get(layoutKey(page))?.media), editor,
        renderModule: modules, fresh: !editor });
    const after = [...container.querySelectorAll(":scope > section[data-section]")].map(sig).join();
    if (before !== after) document.dispatchEvent(new CustomEvent("kalq:layout", { detail: { page, layout } }));
    return layout;
}

// Content and layout of the page, as stored (for the page builder)
export const storedEntry = (key) => store.get(key) || null;
export const storedKeys = () => [...store.keys()];

const applyAll = () => {
    applyStoredLayout();
    applyLanguage();
    applyDirect(document);
};

// Keep a saved edit locally, so switching language or re-applying keeps it
export function setLocalContent(key, lang, content, type = "text") {
    const entry = store.get(key) || { type };
    if (type === "text") entry[lang || "de"] = content;
    else entry.media = content;
    store.set(key, entry);
}

const flash = (keys, color) => keys.forEach((key) => {
    document.querySelectorAll(`[data-kalq-key="${CSS.escape(key)}"]`).forEach((node) => {
        node.style.setProperty("--kalq-flash", color || "#3B82F6");
        node.classList.remove("kalq-flash");
        void node.offsetWidth;
        node.classList.add("kalq-flash");
        setTimeout(() => node.classList.remove("kalq-flash"), 1600);
    });
});

//=================================== Preview ===================================//
// Showing an older version: live updates pause, leaving the preview reloads the current content.
let previewing = false;
let saved = null;

export const isPreviewing = () => previewing;

export function enterPreview(blocks) {
    if (!saved) saved = new Map([...store].map(([key, entry]) => [key, { ...entry }]));
    previewing = true;
    // Start from the current state, so blocks that did not exist back then keep their text
    store.clear();
    saved.forEach((entry, key) => store.set(key, { ...entry }));
    blocks.forEach(({ key, lang, content, type }) => setLocalContent(key, lang, content, type));
    applyAll();
}

export async function exitPreview() {
    if (!previewing) return;
    previewing = false;
    if (saved) { store.clear(); saved.forEach((entry, key) => store.set(key, entry)); saved = null; }
    await refreshContent([]);
}

// Someone saved: fetch the page's content again (the database is the truth, not the message) and highlight
export async function refreshContent(keys = [], color) {
    if (previewing) return; // paused while looking at an older version
    const page = document.querySelectorAll('[data-barba="container"]');
    const name = page.length ? page[page.length - 1].dataset.page : null;
    if (!name) return;
    const res = await fetch(`/api/content?page=${encodeURIComponent(name)}`, { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return; }
    const { blocks = [] } = await res.json();
    blocks.forEach(({ key, lang, content, type }) => setLocalContent(key, lang, content, type));
    applyAll();
    flash(keys, color);
}

// container: the Barba container of the page being shown (the new one during a transition)
export async function loadPageContent(container = document.querySelector('[data-barba="container"]')) {
    previewing = false; // a new page always shows the current version
    saved = null;
    const page = container?.dataset.page;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        if (!page) return;
        const res = await fetch(`/api/content?page=${encodeURIComponent(page)}`, { signal: controller.signal, credentials: "same-origin" });
        if (!res.ok) {
            res.body?.cancel(); // close the unread response
            return;
        }
        const { blocks = [] } = await res.json();
        blocks.forEach(({ key, lang, content, type }) => setLocalContent(key, lang, content, type));
        applyStoredLayout(container);
        applyLanguage();
        applyDirect(document);
    } catch (error) {
        if (error.name !== "AbortError") console.error("content", error);
    } finally {
        clearTimeout(timer);
        document.documentElement.classList.remove("kalq-loading");
    }
}
