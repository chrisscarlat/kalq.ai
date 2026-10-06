// Every picture and video slot on the site, for pencil mode's "Use for" (js/edit.js): the built-in pages' slots and
// each module's, on every page. Browser only (it draws each page's modules off screen to find their slots).
//   hero: Home's hero, and every Hero card module's background (the heroes with a background slot; a hero without
//         one is not listed, so it is never given one). Platform's and Company's top pictures are ordinary images.
//   identity: a person's or a brand's picture (testimonial portraits, logos as images): never filled from elsewhere
//   file: what the given style shows there ("" for none), from that page's stored blocks
import { renderModule } from "./modules/registry.js";
import { layoutKey, parseLayout } from "./layout.js";
import { HERO_MODULES, HOME_HERO, mediaResolver } from "./styleMedia.js";

const CARDS = ["should-cost", "machine-intelligence", "supplier-fit", "manufacturing-cost", "rfq-award", "price-quote"];
export const BUILTIN_MEDIA = [
    HOME_HERO, ...CARDS.map((c) => `home.platform.${c}.image`),
    "platform.hero.media", "platform.header.image", ...CARDS.map((c) => `platform.cards.${c}.image`),
    "company.hero.media", "company.header.image", "company.why.image1", "company.why.image2", "company.shared.image", "company.prices.image",
];
const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];

export async function siteMediaSlots(style = null) {
    const out = BUILTIN_MEDIA.map((key) => ({ key, hero: key === HOME_HERO, identity: false }));
    const doc = document.implementation.createHTMLDocument("slots");
    const resolvers = {};
    for (const page of PAGES) {
        const res = await fetch(`/api/content?page=${encodeURIComponent(page)}`, { credentials: "same-origin" }).catch(() => null);
        if (!res?.ok) continue;
        const { blocks = [] } = await res.json();
        const store = new Map();
        blocks.forEach(({ key, lang, content, type }) => { const e = store.get(key) || { type }; if (type === "text" || type === "layout") e[lang || "de"] = content; if (type !== "text") e.media = content; store.set(key, e); });
        resolvers[page] = mediaResolver((k) => store.get(k) || null, style);
        const layout = parseLayout(store.get(layoutKey(page))?.media);
        for (const entry of layout?.sections || []) {
            if (!entry.module || entry.module === "legacy") continue;
            const node = renderModule(entry, { doc, page, store, lang: "de", editor: true });
            if (!node) continue;
            node.querySelectorAll('[data-kalq-type="image"], [data-kalq-type="video"]').forEach((el) => {
                const key = el.getAttribute("data-kalq-key");
                out.push({ key, hero: HERO_MODULES.has(entry.module) && key === `${page}.${entry.id}.media`, identity: el.hasAttribute("data-kalq-identity") });
            });
        }
    }
    return out.filter((x, i) => out.findIndex((y) => y.key === x.key) === i)
        .map((x) => ({ ...x, file: resolvers[x.key.split(".")[0]]?.(x.key) || "" }));
}

// The pictures a style has somewhere on the site to lend an empty slot: its own files (no videos), never a portrait's
// or a logo's, each once
export const lendable = (slots) => [...new Set(slots.filter((s) => !s.identity && s.file && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(s.file)).map((s) => s.file))];

// The slots a "Use for" target covers, besides the slot it starts from
export function targetSlots(slots, target) {
    if (target === "heroes") return slots.filter((s) => s.hero);
    if (target === "images") return slots.filter((s) => !s.hero && !s.identity);
    if (target === "all") return slots.filter((s) => !s.identity);
    return [];
}
