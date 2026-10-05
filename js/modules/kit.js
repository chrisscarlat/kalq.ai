// The page builder's toolkit: what every module's render uses (js/modules/registry.js and the library files). Shared by
// the server render (linkedom) and the browser, so no browser globals at the top level.
// ctx: { doc, page, id, entry, def (the module's definition), store, lang, editor }
import { renderBlock } from "../blocks.js";

export const SAFE_HREF = /^(https?:|mailto:|\/|#|[\w-]+\.html(#.*)?$)/i;
export const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
export const L = (de, en) => ({ de, en });

export const keyOf = (ctx, slot) => `${ctx.page}.${ctx.id}.${slot}`;

export function textOf(ctx, slot) {
    const e = ctx.store.get(keyOf(ctx, slot));
    if (!e) return null;
    return e[ctx.lang] ?? e.de ?? e.en ?? null;
}

export const mediaOf = (ctx, slot) => ctx.store.get(keyOf(ctx, slot))?.media || null;

// A slot's element: filled from its block, or for editors an empty placeholder with its label; for the public page
// an empty slot is left out (null)
export function slotEl(ctx, slot, tag, { className = "", format, label } = {}) {
    const def = ctx.def.slots[slot] || { label: label || { de: slot, en: slot } }; // a slot made per item (a chat's question) brings its label
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

// A number setting (kind "range", e.g. the hero's darkening): stored as text in both languages, read when the module
// renders. Editors get a slider in edit mode (js/edit.js saves it on release; while dragging, data-kalq-target shows it)
export function rangeOf(ctx, slot) {
    const def = ctx.def.slots[slot];
    const n = parseFloat(plain(textOf(ctx, slot)));
    return Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, n)) : def.initial;
}

export function rangeEl(ctx, slot, target) {
    const def = ctx.def.slots[slot];
    const wrap = ctx.doc.createElement("label");
    wrap.className = "kalq-m-range";
    const name = ctx.doc.createElement("span");
    name.className = "kalq-m-range__label";
    name.textContent = def.label.en; // an editor control: the editor is in English
    const input = ctx.doc.createElement("input");
    input.setAttribute("type", "range");
    ["min", "max", "step"].forEach((a) => input.setAttribute(a, String(def[a])));
    input.setAttribute("value", String(rangeOf(ctx, slot)));
    input.setAttribute("data-kalq-setting", keyOf(ctx, slot));
    if (target) input.setAttribute("data-kalq-target", target); // shown live while dragging (an opacity)
    input.setAttribute("data-kalq-unit", def.unit || "");
    const out = ctx.doc.createElement("output");
    out.className = "kalq-m-range__value";
    out.textContent = `${rangeOf(ctx, slot)}${def.unit || ""}`;
    wrap.append(name, input, out);
    return wrap;
}

export function placeholder(el, def) {
    el.classList.add("kalq-ph");
    el.setAttribute("data-ph-de", def.label.de);
    el.setAttribute("data-ph-en", def.label.en);
}

// A media slot's box: the image or video, or for editors the placeholder glyph. Content images name what they show
// (alt): from { alt } (e.g. a person's name) or the slot's own description block "<slot>_alt"; otherwise decorative
export function mediaEl(ctx, slot, className, { alt } = {}) {
    const url = mediaOf(ctx, slot);
    const def = ctx.def.slots[slot];
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
        el.setAttribute("alt", alt ?? (ctx.def.slots[`${slot}_alt`] ? plain(textOf(ctx, `${slot}_alt`)) : ""));
        el.setAttribute("loading", "lazy");
    }
    el.setAttribute("data-kalq-key", keyOf(ctx, slot));
    el.setAttribute("data-kalq-type", "image");
    box.append(el);
    return box;
}

// A button: a real link when it has a label and a safe address. Editors get the address as an editable field.
export function buttonEl(ctx, className = "kalq-m-button") {
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
    if (label != null) renderBlock(a, label); else placeholder(a, ctx.def.slots.button);
    wrap.append(a);
    const link = slotEl(ctx, "link", "span", { className: "kalq-m-link-field" });
    if (link) wrap.append(link);
    return wrap;
}

export function section(ctx, className) {
    const s = ctx.doc.createElement("section");
    s.className = `kalq-m ${className}`;
    s.setAttribute("data-module", `${ctx.entry.module}:${ctx.entry.version || ""}`);
    return s;
}

export const append = (parent, ...nodes) => { nodes.forEach((n) => n && parent.append(n)); return parent; };


export const plain = (html) => (html || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
export const hrefOf = (ctx, slot) => { const h = plain(textOf(ctx, slot)); return SAFE_HREF.test(h) ? h : null; };


export function linkButton(ctx, labelSlot, linkSlot, className) {
    const label = textOf(ctx, labelSlot);
    const href = hrefOf(ctx, linkSlot);
    if (!ctx.editor) {
        if (!label || !href) return null;
        const a = ctx.doc.createElement("a");
        a.className = className;
        a.setAttribute("href", href);
        const text = ctx.doc.createElement("span");
        text.className = "kalq-btn-round__text";
        renderBlock(text, label);
        a.append(text);
        if (className.includes("kalq-btn-round")) a.append(roundArrow(ctx));
        return a;
    }
    const wrap = ctx.doc.createElement("span");
    wrap.className = "kalq-m-hero__edit-button";
    append(wrap, slotEl(ctx, labelSlot, "span", { className }), slotEl(ctx, linkSlot, "span", { className: "kalq-m-link-field" }));
    return wrap;
}

export function roundArrow(ctx) {
    const c = ctx.doc.createElement("span");
    c.className = "kalq-btn-round__circle";
    c.setAttribute("aria-hidden", "true");
    const arrow = '<svg viewBox="0 0 16 16" focusable="false"><path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    c.innerHTML = `<span class="kalq-btn-round__arrow">${arrow}</span><span class="kalq-btn-round__arrow is-next">${arrow}</span>`;
    return c;
}


// A picture slot with its description: [media slot, its "<slot>_alt" text slot], to spread into a module's slots
export const picture = (slot, label, { required = false, alt = true } = {}) => [
    [slot, { kind: "media", label, required }],
    ...(alt ? [[`${slot}_alt`, { kind: "alt", label: L(`${label.de}: Bildbeschreibung (Alternativtext)`, `${label.en}: description (alt text)`) }]] : []),
];

// The description field under a picture, for editors (visitors get it as the image's alt)
export const altField = (ctx, slot) => (ctx.editor && ctx.def.slots[`${slot}_alt`] ? slotEl(ctx, `${slot}_alt`, "p", { className: "kalq-m-alt-field" }) : null);

// An editor-only field (a link address, a description): null for visitors
export const editorField = (ctx, slot, tag = "span", className = "kalq-m-link-field") => (ctx.editor ? slotEl(ctx, slot, tag, { className }) : null);

export const el = (ctx, tag, className, ...children) => {
    const node = ctx.doc.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((c) => c != null && (typeof c === "string" ? node.append(ctx.doc.createTextNode(c)) : node.append(c)));
    return node;
};
