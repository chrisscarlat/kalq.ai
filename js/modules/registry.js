// Module library for the page builder. Shared by the server render (lib/render-page.js, on a linkedom document) and
// the browser (insert, edit, live changes), so no browser globals at the top level.
//
// A module has versions; all versions of a module share its slots, so switching version never loses content.
// Every slot is a block "<page>.<sectionId>.<slot>" (text per language, or one image/video for both).
// A placeholder is a slot without any revision: editors see a labelled empty block, the public page never gets it.
// Placeholder labels name the kind of content ("Frage", "Antwort"); they never invent claims, numbers or quotes.
import { FINAL, FINAL_CATEGORIES } from "./final.js";
import { L, append, mediaEl, section, slotEl } from "./kit.js";

// The picker's categories, in order; navigation and footer are chosen in the style, their notes say so
const NOTES = [
    { id: "navigation", de: "Navigation", en: "Navigation", note: { de: "Die Navigation wird im Stil gewählt (Stile: Menü), für alle Seiten.", en: "The navigation is chosen in the style (Styles: menu), for every page." } },
    { id: "footers", de: "Footer", en: "Footers", note: { de: "Der Footer wird im Stil gewählt (Stile: Footer), für die ganze Website.", en: "The footer is chosen in the style (Styles: footer), for the whole site." } },
];
export const CATEGORIES = [
    FINAL_CATEGORIES.find((c) => c.id === "custom"),
    FINAL_CATEGORIES.find((c) => c.id === "heroes"),
    { id: "content", de: "Inhalt", en: "Content" },
    ...FINAL_CATEGORIES.filter((c) => c.id !== "custom" && c.id !== "heroes"),
    ...NOTES,
];

// Slot kinds: heading (h2), eyebrow, text (paragraphs), button (label) + link (address), media (image or video),
// alt (a picture's description, its alt text). A module may keep a list in its entry (opts.items): its slots are
// then made per item ("<slot>_<itemId>") and its editor's buttons (data-items-action) change the list, one undo step
// each (js/sections.js: itemsEditor for add, move and remove; act for a module's own changes).
// magazine: how the module reads as a spread in the magazine (js/book/layouts.js), like its versions for the page:
//   layout A (picture | text, order per version), B (statement | text), C (picture across), E (cards); unit: the
//   module's own builder
export const MODULES = {
    "content.media-center": {
        category: "content",
        name: L("Bild oder Video in der Mitte", "Central image or video"),
        keywords: "central centre center image video bild video mitte",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            media: { kind: "media", label: L("Bild oder Video", "Image or video"), required: true },
            caption: { kind: "text", label: L("Bildunterschrift", "Caption") },
        },
        // one version: the slot takes an image or a video, at one size. The earlier "image" and "video" versions stay
        // readable (Home's live section sb8z0z is "video"), rendered the same.
        versions: {
            media: { name: L("Zentrales Bild oder Video", "Central image or video"),
                wire: [["heading", 30, 6, 40], ["media", 4, 13, 92, 36], ["line", 30, 53, 40]] },
        },
        aliases: { image: "media", video: "media" },
        magazine: { layout: "C" },
        render: renderMediaCenter,
    },
    ...FINAL, // js/modules/final.js
};

export const moduleVersion = (module, version) => { const def = MODULES[module]; return def?.versions[version] || def?.versions[def?.aliases?.[version]] || null; };

//=================================== Rendering ===================================//
function renderMediaCenter(ctx) {
    const s = section(ctx, "kalq-m-center");
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

// The entry point used by js/layout.js: an element for a registry module, or null for an unknown one
// A module this code does not know (added by a newer version of the site): visitors never see it, editors get a stub
// so they can still move or remove it. Its stored entry and blocks stay untouched either way.
export function renderModule(entry, ctx) {
    const def = MODULES[entry.module];
    if (def?.versions[entry.version] || def?.aliases?.[entry.version]) return def.render({ ...ctx, entry, def, id: entry.id });
    if (!ctx.editor) return null;
    const stub = ctx.doc.createElement("section");
    stub.className = "kalq-m-unknown";
    stub.setAttribute("data-module", `${entry.module}:${entry.version || ""}`);
    const note = ctx.doc.createElement("p");
    note.textContent = `Unknown module: ${entry.module} (${entry.version || "–"}), not shown on the page`; // editors only: in English
    stub.append(note);
    return stub;
}

// Required texts that are still placeholders (a section with any cannot go live). A required picture never holds a
// section back: publishing borrows one of the shown style's pictures for it, or visitors see a plain grey box
export function missingRequired(entry, page, store) {
    const def = MODULES[entry.module];
    if (!def) return [];
    return [...Object.entries(def.slots).filter(([slot, s]) => {
        if (!s.required) return false;
        const e = store(`${page}.${entry.id}.${slot}`);
        if (s.kind === "media") return false;
        return !e || (e.de == null && e.en == null);
    }).map(([slot, s]) => s.label), ...(def.missing ? def.missing(entry, page, store) : [])]; // the module's own checks (e.g. the testimonials' quotes)
}
