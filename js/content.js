// Edited content: loads the newest revisions for the page from /api/content and applies them to the
// data-kalq-key blocks. Text goes through i18n.js (one version per language), media is applied here.
// Keyed blocks stay hidden (html.kalq-loading) until this ran, at most TIMEOUT_MS.
import { applyLanguage, currentLang, setEditedContent } from "./i18n.js";

const TIMEOUT_MS = 1500;
const store = new Map(); // key -> { type, de, en, media }

// Only <br>, <em>, <strong> and <a href> survive, everything else is unwrapped to its text.
// A <template> parses inertly, so nothing in the input runs or loads.
const ALLOWED = new Set(["BR", "EM", "STRONG", "A"]);
const SAFE_HREF = /^(https?:|mailto:|\/|#|[\w-]+\.html(#.*)?$)/i;

export function sanitize(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const out = document.createDocumentFragment();
    const walk = (node, parent) => node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) return parent.append(child.textContent);
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (!ALLOWED.has(child.tagName)) return walk(child, parent);
        const el = document.createElement(child.tagName.toLowerCase());
        if (child.tagName === "A") {
            const href = (child.getAttribute("href") || "").trim();
            if (SAFE_HREF.test(href)) el.setAttribute("href", href);
        }
        walk(child, el);
        parent.append(el);
    });
    walk(template.content, out);
    return out;
}

const textFor = (key, lang) => {
    const entry = store.get(key);
    if (!entry) return null;
    return entry[lang] ?? null;
};

setEditedContent((key, lang) => {
    const html = textFor(key, lang);
    return html == null ? null : sanitize(html);
});

// Blocks that are not translated: media, counter numbers, email addresses
function applyDirect(root) {
    root.querySelectorAll("[data-kalq-key]").forEach((el) => {
        const entry = store.get(el.dataset.kalqKey);
        if (!entry) return;
        const type = el.dataset.kalqType || "text";

        if (type === "image" && entry.media) {
            if (el.tagName === "IMG") { if (el.getAttribute("src") !== entry.media) el.setAttribute("src", entry.media); }
            else el.dataset.image = entry.media; // hover rows keep their image in data-image
        } else if (type === "video" && entry.media) {
            const source = el.querySelector("source");
            if (source && source.getAttribute("src") !== entry.media) {
                source.setAttribute("src", entry.media);
                el.load();
                el.play?.()?.catch(() => { });
            }
        } else if (type === "text" && !el.hasAttribute("data-i18n") && !el.hasAttribute("data-i18n-marquee")) {
            const html = textFor(el.dataset.kalqKey, currentLang()) ?? entry.de ?? entry.en;
            if (html == null) return;
            el.replaceChildren(sanitize(html));
            // An edited email address also changes where the link goes
            const link = el.closest('a[href^="mailto:"]');
            if (link && /^[^\s@]+@[^\s@]+$/.test(el.textContent.trim())) {
                link.setAttribute("href", link.getAttribute("href").replace(/^mailto:[^?]*/, `mailto:${el.textContent.trim()}`));
            }
        }
    });
}

// container: the Barba container of the page being shown (the new one during a transition)
export async function loadPageContent(container = document.querySelector('[data-barba="container"]')) {
    const page = container?.dataset.page;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        if (!page) return;
        const res = await fetch(`/api/content?page=${encodeURIComponent(page)}`, { signal: controller.signal, credentials: "same-origin" });
        if (!res.ok) return;
        const { blocks = [] } = await res.json();
        blocks.forEach(({ key, lang, content, type }) => {
            const entry = store.get(key) || { type };
            if (type === "text") entry[lang || "de"] = content;
            else entry.media = content;
            store.set(key, entry);
        });
        applyLanguage();
        applyDirect(document);
    } catch (error) {
        if (error.name !== "AbortError") console.error("content", error);
    } finally {
        clearTimeout(timer);
        document.documentElement.classList.remove("kalq-loading");
    }
}
