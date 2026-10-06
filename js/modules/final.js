// The builder's module set (besides the central image or video in js/modules/registry.js): the custom module, image and
// text, alternating rows, the stacking testimonials, the stacking pinned cards (Tether) and the horizontal scroll
// cards. Templates only: shared by the server render (linkedom) and the browser, so no browser globals at the top
// level. The scroll effects are in js/modules/scrollEffects.js (browser only), the styles in
// css/components/_final.scss (shared type tokens only).
//
// Every heading is a real one by its role: the module's title an h2, a card's or row's title an h3. Everything a
// visitor reads is in the HTML in reading order; the scroll effects only move it. Without JavaScript, under reduced
// motion and in edit mode, each scroll module is a plain stacked list. Signed-in editors get the editor render with
// edit mode on or off: its controls show only in edit mode (css), its effects run only outside it.
import { renderBlock } from "../blocks.js";
import { L, SAFE_HREF, altField, append, buttonEl, el, mediaEl, mediaOf, picture, plain, section, slotEl, textOf } from "./kit.js";
import { SEND_DESTS, destOf } from "./destinations.js";

const ID = /^[a-z0-9]{1,12}$/;
const newId = () => Math.random().toString(36).slice(2, 8);
const clampInt = (v, min, max, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const has = (get, page, entry, slot) => { const e = get(`${page}.${entry.id}.${slot}`); return !!(e && (e.de || e.en || e.media)); };

// The list of items a module keeps in its entry (opts.items): known ids only, at most max
const itemsOf = (entry, max, fallback) => {
    const list = Array.isArray(entry?.opts?.items) ? entry.opts.items.filter((x) => x && ID.test(x.id)).slice(0, max) : null;
    return list && list.length ? list : fallback;
};

//=================================== Editor controls ===================================//
// A button of the editor (English, the editor's language): js/sections.js turns its data-items-* into one undo step
function tool(ctx, action, text, { id, arg, label, pressed, off, cls = "" } = {}) {
    const b = el(ctx, "button", `kalq-f-tool ${cls}`.trim(), text);
    b.setAttribute("type", "button");
    b.setAttribute("data-items-action", action);
    if (id) b.setAttribute("data-items-id", id);
    if (arg != null) b.setAttribute("data-items-arg", String(arg));
    if (label) b.setAttribute("aria-label", label);
    if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
    if (off) b.setAttribute("disabled", "");
    return b;
}
const tools = (ctx, cls, ...children) => append(el(ctx, "div", `kalq-f-tools ${cls || ""}`.trim()), ...children);
const group = (ctx, name, ...buttons) => append(el(ctx, "span", "kalq-f-group"), el(ctx, "span", "kalq-f-group__name", name), ...buttons);

// The tools of one item in a list (a testimonial, a card): its number, move, remove
const itemTools = (ctx, id, n, count, min, word) => tools(ctx, "",
    el(ctx, "span", "kalq-f-tools__num", `${word} ${n}`),
    tool(ctx, "up", "↑", { id, label: "Move up", off: n === 1 }),
    tool(ctx, "down", "↓", { id, label: "Move down", off: n === count }),
    tool(ctx, "remove", "×", { id, label: `Remove ${word.toLowerCase()}`, off: count <= min }));
const addTool = (ctx, word, count, max) => tools(ctx, "is-add", tool(ctx, "add", `+ Add ${word.toLowerCase()}`, { off: count >= max }));

//=================================== Links ===================================//
// A link to a page (an address on the site or elsewhere) or to a send destination (the visitor's messaging app or
// mail, js/modules/destinations.js). Visitors get a real link when it has a label and a valid address; editors get
// both fields. Returns null for visitors otherwise.
function linkTo(ctx, labelSlot, addrSlot, to, cls, { n = "" } = {}) {
    const dest = to && to !== "page" ? destOf(to) : null;
    if (!ctx.editor) {
        const label = textOf(ctx, labelSlot);
        const raw = plain(textOf(ctx, addrSlot));
        const href = dest ? (raw ? dest.href(raw) : null) : SAFE_HREF.test(raw) ? raw : null;
        if (!label || !href) return null;
        const a = el(ctx, "a", cls);
        a.setAttribute("href", href);
        if (dest?.blank || (!dest && /^https?:/i.test(href))) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        if (dest) a.setAttribute("data-dest", dest.id);
        const text = el(ctx, "span", "kalq-f-link__text");
        renderBlock(text, label);
        a.append(text);
        return a;
    }
    const wrap = el(ctx, "span", "kalq-f-edit-link");
    append(wrap, slotEl(ctx, labelSlot, "span", { className: cls, label: L(`${n}Linktext`, `${n}Link label`) }),
        slotEl(ctx, addrSlot, "span", { className: "kalq-m-link-field", label: dest ? L(`${n}${dest.label}: ${dest.hint}`, `${n}${dest.label}: ${dest.hint}`) : L(`${n}Adresse, z. B. platform.html`, `${n}Address, e.g. platform.html`) }));
    return wrap;
}

//=================================== 1. Custom module ===================================//
// opts: { cols 1–6, row (a scrollable card row instead of columns), narrow (columns kept on narrow screens, 1–3),
//   items: columns or cards [{ id, over (text over the column's first picture), align "start" (bottom left) |
//   "center", pieces: [{ id, kind image|text|quote|button|link, bleed (image), as title|body (text), to page|dest }] }] }
// Each piece's content is its own blocks: img_<id> (+ img_<id>_alt), t_<id>, q_<id> + qa_<id>, b_<id> + h_<id>.
export const CUSTOM_MAX_ITEMS = 12;
export const CUSTOM_MAX_PIECES = 10;
const KINDS = ["image", "text", "quote", "button", "link"];
const KIND_NAMES = { image: "Image", text: "Text", quote: "Quote", button: "Button", link: "Link" };

const makeColumn = (id = newId) => ({ id: id(), over: false, align: "start",
    pieces: [{ id: id(), kind: "image", bleed: false }, { id: id(), kind: "text", as: "title" }, { id: id(), kind: "text", as: "body" }, { id: id(), kind: "link", to: "page" }] });
const makePiece = (kind) => ({ id: newId(), kind, ...(kind === "image" ? { bleed: false } : kind === "text" ? { as: "body" } : kind === "button" || kind === "link" ? { to: "page" } : {}) });
// the picker's preview and an entry without options: three columns, fixed ids (keys are per section anyway)
let seq = 0;
const DEFAULT_CUSTOM = { cols: 3, row: false, narrow: 1, items: Array.from({ length: 3 }, () => makeColumn(() => `d${(seq++).toString(36)}`)) };

export function customOf(entry) {
    const o = entry?.opts && Array.isArray(entry.opts.items) && entry.opts.items.length ? entry.opts : DEFAULT_CUSTOM;
    const cols = clampInt(o.cols, 1, 6, 3);
    const items = o.items.filter((c) => c && ID.test(c.id)).slice(0, CUSTOM_MAX_ITEMS).map((c) => ({
        id: c.id, over: c.over === true, align: c.align === "center" ? "center" : "start",
        pieces: (Array.isArray(c.pieces) ? c.pieces : []).filter((p) => p && ID.test(p.id) && KINDS.includes(p.kind)).slice(0, CUSTOM_MAX_PIECES).map((p) => ({
            id: p.id, kind: p.kind, bleed: p.bleed === true, as: p.as === "title" ? "title" : "body", to: p.to && p.to !== "page" && destOf(p.to) ? p.to : "page" })),
    }));
    return { cols, row: o.row === true, narrow: clampInt(o.narrow, 1, Math.min(3, cols), 1), items };
}

// The editor's changes to the custom module (js/sections.js): returns the history label, or null for nothing to do
function customAct(opts, action, id, arg) {
    const o = customOf({ opts });
    Object.assign(opts, o);
    const items = opts.items;
    const ci = items.findIndex((c) => c.id === id);
    const at = (pid) => { for (const c of items) { const k = c.pieces.findIndex((p) => p.id === pid); if (k >= 0) return [c, k]; } return [null, -1]; };
    const [pc, pk] = at(id);
    const swap = (list, i, j) => { [list[i], list[j]] = [list[j], list[i]]; };
    if (action === "cols") {
        const n = clampInt(arg, 1, 6, 3);
        if (!opts.row && opts.cols === n) return null;
        opts.cols = n; opts.row = false;
        while (items.length < n) items.push(makeColumn());
        opts.narrow = Math.min(opts.narrow, Math.min(3, n));
        return `${n} column${n > 1 ? "s" : ""}`;
    }
    if (action === "row") { if (opts.row) return null; opts.row = true; return "card row"; }
    if (action === "narrow") { const n = clampInt(arg, 1, Math.min(3, opts.cols), 1); if (n === opts.narrow) return null; opts.narrow = n; return `${n} column${n > 1 ? "s" : ""} on narrow screens`; }
    if (action === "add") { if (items.length >= CUSTOM_MAX_ITEMS) return null; items.push(makeColumn()); return opts.row ? "card added" : "column added"; }
    if (action === "remove" && ci >= 0 && items.length > 1) { items.splice(ci, 1); return opts.row ? "card removed" : "column removed"; }
    if ((action === "up" && ci > 0) || (action === "down" && ci >= 0 && ci < items.length - 1)) { swap(items, ci, action === "up" ? ci - 1 : ci + 1); return `${opts.row ? "card" : "column"} moved`; }
    if (action === "piece-add" && ci >= 0 && KINDS.includes(arg)) {
        if (items[ci].pieces.length >= CUSTOM_MAX_PIECES) return null;
        items[ci].pieces.push(makePiece(arg));
        return `${arg} added`;
    }
    if (action === "textpos" && ci >= 0 && ["above", "below", "over"].includes(arg)) {
        const c = items[ci];
        c.over = arg === "over";
        if (arg !== "over") { // above or below: the column's first picture moves after or before its other pieces
            const k = c.pieces.findIndex((p) => p.kind === "image");
            if (k >= 0) { const [img] = c.pieces.splice(k, 1); if (arg === "above") c.pieces.push(img); else c.pieces.unshift(img); }
        }
        return `text ${arg} the image`;
    }
    if (action === "align" && ci >= 0 && ["start", "center"].includes(arg)) { if (items[ci].align === arg) return null; items[ci].align = arg; return `text ${arg === "center" ? "centred" : "bottom left"}`; }
    if (!pc) return null;
    const p = pc.pieces[pk];
    if (action === "piece-remove") { pc.pieces.splice(pk, 1); return `${p.kind} removed`; }
    if (action === "piece-up" && pk > 0) { swap(pc.pieces, pk, pk - 1); return `${p.kind} moved up`; }
    if (action === "piece-down" && pk < pc.pieces.length - 1) { swap(pc.pieces, pk, pk + 1); return `${p.kind} moved down`; }
    if (action === "bleed" && p.kind === "image") { p.bleed = !p.bleed; return `image ${p.bleed ? "to the edge" : "inset"}`; }
    if (action === "as" && p.kind === "text" && ["title", "body"].includes(arg)) { if (p.as === arg) return null; p.as = arg; return `text as ${arg}`; }
    if (action === "to" && (p.kind === "button" || p.kind === "link") && (arg === "page" || destOf(arg))) { if (p.to === arg) return null; p.to = arg; return `${p.kind} to ${arg}`; }
    return null;
}

// Where a column touches the module's edge: wide (its columns side by side) and narrow (the columns kept there).
// Pictures set to bleed run out to the edges a column touches.
function edges(i, count, cols) {
    const n = Math.max(1, Math.min(cols, count));
    const rows = Math.ceil(count / n);
    const c = i % n, r = Math.floor(i / n);
    return [c === 0 && "l", c === n - 1 && "r", r === 0 && "t", r === rows - 1 && "b"].filter(Boolean);
}

function renderPiece(ctx, p, k, count) {
    const box = el(ctx, "div", `kalq-f-piece is-${p.kind}`);
    const label = L;
    let body = null;
    if (p.kind === "image") {
        if (p.bleed) box.classList.add("is-bleed");
        body = mediaEl(ctx, `img_${p.id}`, "kalq-f-img", { label: label("Bild", "Image") });
        if (body) body.classList.toggle("is-bleed", p.bleed);
        if (body && ctx.editor) body = append(el(ctx, "div", "kalq-f-img-edit"), body, altField(ctx, `img_${p.id}`, label("Bildbeschreibung (Alternativtext)", "Image description (alt text)")));
    } else if (p.kind === "text") {
        box.classList.add(`as-${p.as}`);
        body = p.as === "title"
            ? slotEl(ctx, `t_${p.id}`, "h3", { className: "kalq-f-title", label: label("Titel", "Title") })
            : slotEl(ctx, `t_${p.id}`, "div", { className: "kalq-f-text", format: "paragraphs", label: label("Text", "Text") });
    } else if (p.kind === "quote") {
        const q = slotEl(ctx, `q_${p.id}`, "blockquote", { className: "kalq-f-quote__text", format: "paragraphs", label: label("Zitat (nur echte Zitate)", "Quote (real quotes only)") });
        const who = slotEl(ctx, `qa_${p.id}`, "figcaption", { className: "kalq-f-quote__who", label: label("Wer es sagt", "Who says it") });
        if (q) body = append(el(ctx, "figure", "kalq-f-quote"), q, who);
    } else {
        body = linkTo(ctx, `b_${p.id}`, `h_${p.id}`, p.to, p.kind === "button" ? "kalq-m-button kalq-f-button" : "kalq-link-underline kalq-f-link");
    }
    if (!body && !ctx.editor) return null;
    if (body) box.append(body);
    if (ctx.editor) {
        const t = tools(ctx, "is-piece",
            el(ctx, "span", "kalq-f-tools__num", KIND_NAMES[p.kind]),
            tool(ctx, "piece-up", "↑", { id: p.id, label: "Move up", off: k === 0 }),
            tool(ctx, "piece-down", "↓", { id: p.id, label: "Move down", off: k === count - 1 }),
            tool(ctx, "piece-remove", "×", { id: p.id, label: `Remove ${p.kind}` }));
        if (p.kind === "image") t.append(tool(ctx, "bleed", "Edge to edge", { id: p.id, pressed: p.bleed }));
        if (p.kind === "text") t.append(tool(ctx, "as", "Title", { id: p.id, arg: "title", pressed: p.as === "title" }), tool(ctx, "as", "Paragraph", { id: p.id, arg: "body", pressed: p.as === "body" }));
        if (p.kind === "button" || p.kind === "link") {
            t.append(group(ctx, "To", tool(ctx, "to", "Page", { id: p.id, arg: "page", pressed: p.to === "page" }),
                ...SEND_DESTS.map((d) => tool(ctx, "to", d.label, { id: p.id, arg: d.id, pressed: p.to === d.id }))));
        }
        box.prepend(t);
    }
    return box;
}

function renderCustom(ctx) {
    const o = customOf(ctx.entry);
    const count = o.items.length;
    const cols = Math.min(o.cols, count);
    const head = slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" });
    const s = section(ctx, `kalq-f kalq-f-custom ${o.row ? "is-row" : `is-cols has-cols-${cols} keep-${Math.min(o.narrow, count)}`}${head ? " has-head" : ""}`);
    const inner = el(ctx, "div", "kalq-f-inner");
    if (ctx.editor) {
        inner.append(tools(ctx, "is-module",
            group(ctx, "Layout", ...[1, 2, 3, 4, 5, 6].map((n) => tool(ctx, "cols", String(n), { arg: n, label: `${n} column${n > 1 ? "s" : ""}`, pressed: !o.row && o.cols === n })),
                tool(ctx, "row", "Card row", { pressed: o.row })),
            o.row ? null : group(ctx, "Narrow screens", ...Array.from({ length: Math.min(3, o.cols) }, (_, k) => tool(ctx, "narrow", k ? `Keep ${k + 1}` : "Stack", { arg: k + 1, pressed: o.narrow === k + 1 })))));
    }
    if (head) inner.append(head);
    const track = el(ctx, "div", "kalq-f-track");
    if (o.row && !ctx.editor) {
        track.setAttribute("tabindex", "0"); // a keyboard can scroll the row
        track.setAttribute("role", "region");
        track.setAttribute("aria-label", plain(textOf(ctx, "heading")) || (ctx.lang === "en" ? "Cards" : "Karten"));
    }
    o.items.forEach((c, i) => {
        const pieces = c.pieces.map((p, k) => renderPiece(ctx, p, k, c.pieces.length)).filter(Boolean);
        if (!pieces.length && !ctx.editor) return;
        const col = el(ctx, "div", `kalq-f-col is-${c.align}`);
        if (!o.row) {
            edges(i, count, o.cols).forEach((e) => col.classList.add(`w-${e}`));
            edges(i, count, Math.min(o.narrow, count)).forEach((e) => col.classList.add(`n-${e}`));
        }
        const backdrop = c.over ? pieces.find((n) => n.classList.contains("is-image")) : null;
        if (backdrop) {
            col.classList.add("is-over");
            backdrop.classList.add("is-backdrop");
        }
        if (ctx.editor) {
            const word = o.row ? "Card" : "Column";
            col.append(tools(ctx, "is-col",
                el(ctx, "span", "kalq-f-tools__num", `${word} ${i + 1}`),
                tool(ctx, "up", "←", { id: c.id, label: "Move back", off: i === 0 }),
                tool(ctx, "down", "→", { id: c.id, label: "Move forward", off: i === count - 1 }),
                tool(ctx, "remove", "×", { id: c.id, label: `Remove ${word.toLowerCase()}`, off: count <= 1 }),
                group(ctx, "Text", ...["above", "below", "over"].map((pos) => tool(ctx, "textpos", pos[0].toUpperCase() + pos.slice(1), { id: c.id, arg: pos,
                    pressed: pos === "over" ? c.over : !c.over && (pos === "below") === (c.pieces.findIndex((p) => p.kind === "image") <= 0) }))),
                group(ctx, "Align", tool(ctx, "align", "Bottom left", { id: c.id, arg: "start", pressed: c.align === "start" }), tool(ctx, "align", "Centre", { id: c.id, arg: "center", pressed: c.align === "center" }))));
        }
        const body = el(ctx, "div", "kalq-f-col__body");
        if (backdrop) col.append(backdrop);
        append(body, ...pieces.filter((n) => n !== backdrop));
        col.append(body);
        if (ctx.editor) col.append(tools(ctx, "is-add", el(ctx, "span", "kalq-f-tools__num", "Add"),
            ...KINDS.map((k) => tool(ctx, "piece-add", `+ ${KIND_NAMES[k]}`, { id: c.id, arg: k, off: c.pieces.length >= CUSTOM_MAX_PIECES }))));
        track.append(col);
    });
    if (!track.children.length && !ctx.editor) return null;
    inner.append(track);
    if (ctx.editor) inner.append(tools(ctx, "is-add", tool(ctx, "add", o.row ? "+ Add card" : "+ Add column", { off: count >= CUSTOM_MAX_ITEMS })));
    return append(s, inner);
}

//=================================== 2. Image and text ===================================//
// The picture bleeds to the module's edges on all sides; the text beside it, vertically centred, left-aligned.
function renderImageText(ctx) {
    const right = ctx.entry.version === "image-right";
    const s = section(ctx, `kalq-f kalq-f-it is-image-${right ? "right" : "left"}`);
    const media = mediaEl(ctx, "media", "kalq-f-it__media");
    const text = append(el(ctx, "div", "kalq-f-it__text"), slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }),
        slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }), slotEl(ctx, "text", "div", { className: "kalq-f-text", format: "paragraphs" }), buttonEl(ctx),
        altField(ctx, "media")); // editors: the picture's description
    return append(s, append(el(ctx, "div", "kalq-f-it__grid"), media, text));
}

//=================================== 3. Alternating rows ===================================//
// Three picture and text pairs in a zigzag (left, right, left; or the mirror), the rows close together. Each
// picture runs out to its side's edge.
const ROWS = 3;
function renderAlternating(ctx) {
    const s = section(ctx, `kalq-f kalq-f-alt is-${ctx.entry.version === "right-first" ? "right-first" : "left-first"}`);
    const head = slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" });
    if (head) s.append(append(el(ctx, "div", "kalq-f-inner kalq-f-alt__head"), head));
    const list = el(ctx, "div", "kalq-f-alt__rows");
    for (let n = 1; n <= ROWS; n++) {
        const title = slotEl(ctx, `title${n}`, "h3", { className: "kalq-f-title" });
        const media = mediaEl(ctx, `media${n}`, "kalq-f-alt__media");
        if (!ctx.editor && !title && !media) continue;
        const text = append(el(ctx, "div", "kalq-f-alt__text"), title, slotEl(ctx, `text${n}`, "div", { className: "kalq-f-text", format: "paragraphs" }),
            linkTo(ctx, `link_label${n}`, `link${n}`, "page", "kalq-link-underline kalq-f-link"), altField(ctx, `media${n}`));
        list.append(append(el(ctx, "div", "kalq-f-alt__row"), media, text));
    }
    if (!list.children.length && !ctx.editor) return null;
    return append(s, list);
}

//=================================== 4. Testimonials (stacking) ===================================//
// The cards lie on a pile; scrolling flicks the top one away to reveal the next (js/modules/scrollEffects.js).
export const TESTIMONIALS_MIN = 2, TESTIMONIALS_MAX = 8;
const DEFAULT_TESTIMONIALS = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
export const testimonialItems = (entry) => itemsOf(entry, TESTIMONIALS_MAX, DEFAULT_TESTIMONIALS);

function renderTestimonials(ctx) {
    const items = testimonialItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-ts");
    s.setAttribute("data-scroll-effect", "stack"); // armed outside edit mode only (signed-in editors get this render too)
    const inner = el(ctx, "div", "kalq-f-inner kalq-f-ts__inner");
    const head = append(el(ctx, "div", "kalq-f-ts__head"), slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }));
    const deck = el(ctx, "div", "kalq-f-ts__deck");
    items.forEach((it, k) => {
        const quote = slotEl(ctx, `q_${it.id}`, "blockquote", { className: "kalq-f-ts__quote", format: "paragraphs", label: L(`Zitat ${k + 1} (nur echte Zitate)`, `Quote ${k + 1} (real quotes only)`) });
        const name = slotEl(ctx, `n_${it.id}`, "span", { className: "kalq-f-ts__name", label: L(`Name ${k + 1}`, `Name ${k + 1}`) });
        if (!ctx.editor && (!quote || !name)) return;
        const photo = mediaEl(ctx, `p_${it.id}`, "kalq-f-ts__photo", { alt: "", label: L(`Foto ${k + 1} (optional)`, `Photo ${k + 1} (optional)`) }); // decorative: the name says who
        const card = el(ctx, "figure", "kalq-f-ts__card");
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, TESTIMONIALS_MIN, "Testimonial"));
        append(card, quote, append(el(ctx, "figcaption", "kalq-f-ts__who"), photo,
            append(el(ctx, "span", "kalq-f-ts__id"), name, slotEl(ctx, `r_${it.id}`, "span", { className: "kalq-f-ts__role", label: L(`Rolle und Firma ${k + 1}`, `Role and company ${k + 1}`) }))));
        deck.append(card);
    });
    if (!deck.children.length && !ctx.editor) return null;
    append(inner, head, deck, ctx.editor ? addTool(ctx, "testimonial", items.length, TESTIMONIALS_MAX) : null);
    return append(s, inner);
}

//=================================== 5. Stacking pinned cards (Tether) ===================================//
// Each card pins at the top and the next slides up over it, about 20px lower, so an edge of each stays in view.
export const TETHER_MIN = 2, TETHER_MAX = 6;
const DEFAULT_TETHER = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
export const tetherItems = (entry) => itemsOf(entry, TETHER_MAX, DEFAULT_TETHER);

function renderTether(ctx) {
    const items = tetherItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-tether");
    s.setAttribute("data-scroll-effect", "tether"); // armed outside edit mode only (signed-in editors get this render too)
    const head = slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" });
    if (head) s.append(append(el(ctx, "div", "kalq-f-inner kalq-f-tether__head"), head));
    const list = el(ctx, "div", "kalq-f-tether__list");
    items.forEach((it, k) => {
        const n = `Card ${k + 1}: `, nd = `Karte ${k + 1}: `;
        const title = slotEl(ctx, `t_${it.id}`, "h3", { className: "kalq-f-title", label: L(`${nd}Titel`, `${n}title`) });
        if (!ctx.editor && !title) return;
        const media = mediaEl(ctx, `p_${it.id}`, "kalq-f-tether__media", { label: L(`${nd}Bild`, `${n}image`) });
        const card = el(ctx, "article", "kalq-f-tether__card");
        card.setAttribute("style", `--i: ${k}`); // its place in the pile: each one about 20px lower
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, TETHER_MIN, "Card"));
        const text = append(el(ctx, "div", "kalq-f-tether__text"), slotEl(ctx, `e_${it.id}`, "p", { className: "kalq-m-eyebrow", label: L(`${nd}kleine Überschrift`, `${n}eyebrow`) }), title,
            slotEl(ctx, `x_${it.id}`, "div", { className: "kalq-f-text", format: "paragraphs", label: L(`${nd}Text`, `${n}text`) }),
            linkTo(ctx, `b_${it.id}`, `l_${it.id}`, "page", "kalq-m-button kalq-f-button", { n }),
            altField(ctx, `p_${it.id}`, L(`${nd}Bildbeschreibung`, `${n}image description (alt text)`)));
        list.append(append(card, text, media));
    });
    if (!list.children.length && !ctx.editor) return null;
    s.append(list);
    if (ctx.editor) s.append(append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "card", items.length, TETHER_MAX)));
    return s;
}

//=================================== 6. Horizontal scroll cards ===================================//
// The section pins while its row of cards slides sideways until the last is in view, then the page goes on.
export const HCARDS_MIN = 2, HCARDS_MAX = 12;
const DEFAULT_HCARDS = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }];
export const hcardItems = (entry) => itemsOf(entry, HCARDS_MAX, DEFAULT_HCARDS);

function renderHorizontal(ctx) {
    const items = hcardItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-hs");
    s.setAttribute("data-scroll-effect", "horizontal"); // armed outside edit mode only (signed-in editors get this render too)
    const inner = el(ctx, "div", "kalq-f-hs__pin");
    const head = append(el(ctx, "div", "kalq-f-inner kalq-f-hs__head"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }),
        slotEl(ctx, "intro", "div", { className: "kalq-f-text", format: "paragraphs" }));
    const track = el(ctx, "div", "kalq-f-hs__track");
    items.forEach((it, k) => {
        const n = `Card ${k + 1}: `, nd = `Karte ${k + 1}: `;
        const title = slotEl(ctx, `t_${it.id}`, "h3", { className: "kalq-f-title", label: L(`${nd}Titel`, `${n}title`) });
        if (!ctx.editor && !title) return;
        const media = mediaEl(ctx, `p_${it.id}`, "kalq-f-hs__media", { label: L(`${nd}Bild`, `${n}image`) });
        const card = el(ctx, "article", "kalq-f-hs__card");
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, HCARDS_MIN, "Card"));
        append(card, media, altField(ctx, `p_${it.id}`, L(`${nd}Bildbeschreibung`, `${n}image description (alt text)`)), title, slotEl(ctx, `x_${it.id}`, "div", { className: "kalq-f-text", format: "paragraphs", label: L(`${nd}kurzer Text`, `${n}short text`) }),
            linkTo(ctx, `b_${it.id}`, `l_${it.id}`, "page", "kalq-link-underline kalq-f-link", { n }));
        track.append(card);
    });
    if (!track.children.length && !ctx.editor) return null;
    append(inner, head, track, ctx.editor ? append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "card", items.length, HCARDS_MAX)) : null);
    return append(s, inner);
}

//=================================== The book ===================================//
const cardsUnit = (s, k, sel) => ({ layout: "E", cards: [...s.querySelectorAll(sel)].map((c) => ({ media: k.mediaUrl(c.querySelector(".kalq-m-media")), eyebrow: c.querySelector(".kalq-m-eyebrow"),
    title: c.querySelector(".kalq-f-title"), body: k.parasOf(c.querySelector(".kalq-f-text")) })).filter((c) => c.title) });

//=================================== Definitions ===================================//
export const FINAL_CATEGORIES = [
    { id: "custom", de: "Eigenes Modul", en: "Custom" },
    { id: "testimonials", de: "Stimmen", en: "Testimonials" },
    { id: "scroll", de: "Scroll-Effekte", en: "Scroll effects" },
];

export const FINAL = {
    "custom.columns": {
        category: "custom",
        name: L("Eigenes Modul", "Custom module"),
        keywords: "custom eigenes columns spalten cards karten row reihe image text quote button link frei",
        slots: { heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") } },
        versions: {
            custom: { name: L("Spalten oder Kartenreihe, frei gefüllt", "Columns or a card row, filled freely"),
                wire: [4, 36, 68].flatMap((x) => [["media", x, 8, 28, 22], ["line", x, 34, 18, "bold"], ["line", x, 39, 26], ["line", x, 43, 22], ["line", x, 49, 10, "bold"]]) },
        },
        initialOpts: () => ({ cols: 3, row: false, narrow: 1, items: Array.from({ length: 3 }, () => makeColumn()) }),
        act: customAct,
        missing: (entry, page, get) => {
            const o = customOf(entry);
            const slotsOf = (p) => (p.kind === "image" ? [`img_${p.id}`] : p.kind === "text" ? [`t_${p.id}`] : p.kind === "quote" ? [`q_${p.id}`] : [`b_${p.id}`]);
            const filled = o.items.some((c) => c.pieces.some((p) => slotsOf(p).some((sl) => has(get, page, entry, sl))));
            return filled ? [] : [L("mindestens ein gefülltes Element", "at least one filled piece")];
        },
        magazine: {
            layout: "A",
            unit: (s, k) => ({ layout: "A", order: "media-text", title: s.querySelector(".kalq-f-heading"),
                body: [...s.querySelectorAll(".kalq-f-piece:not(.is-image)")].flatMap((p) => (p.classList.contains("as-title")
                    ? [k.textOf(p.querySelector(".kalq-f-title"), "h3", "bk-subtitle")] : k.parasOf(p.querySelector(".kalq-f-text, .kalq-f-quote__text")))).filter(Boolean),
                actions: [...s.querySelectorAll("a.kalq-f-button, a.kalq-f-link")], media: [k.mediaUrl(s.querySelector(".kalq-f-img"))] }),
        },
        render: renderCustom,
    },
    "content.image-text": {
        category: "content",
        name: L("Bild und Text", "Image and text"),
        keywords: "image text bild text split side by side nebeneinander bleed randlos mirror",
        slots: {
            ...Object.fromEntries(picture("media", L("Bild oder Video", "Image or video"), { required: true })),
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift (optional)", "Eyebrow (optional)") },
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            text: { kind: "text", label: L("Text", "Text") },
            button: { kind: "button", label: L("Button-Text (optional)", "Button label (optional)") },
            link: { kind: "link", label: L("Button-Link", "Button link") },
        },
        versions: {
            "image-left": { name: L("Bild links, Text rechts", "Image left, text right"),
                wire: [["media", 0, 0, 50, 60], ["eyebrow", 56, 20, 12], ["heading", 56, 25, 34], ["line", 56, 32, 36], ["line", 56, 36, 30], ["button", 56, 42, 14]] },
            "image-right": { name: L("Text links, Bild rechts", "Text left, image right"),
                wire: [["eyebrow", 6, 20, 12], ["heading", 6, 25, 34], ["line", 6, 32, 36], ["line", 6, 36, 30], ["button", 6, 42, 14], ["media", 50, 0, 50, 60]] },
        },
        magazine: { layout: "A", order: { "image-left": "media-text", "image-right": "text-media" } },
        render: renderImageText,
    },
    "content.alternating": {
        category: "content",
        name: L("Abwechselnde Reihen", "Alternating rows"),
        keywords: "alternating zigzag rows reihen abwechselnd image text bild text three drei",
        slots: {
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...Object.fromEntries(Array.from({ length: ROWS }, (_, i) => i + 1).flatMap((n) => [
                ...picture(`media${n}`, L(`Reihe ${n}: Bild`, `Row ${n}: image`), { required: true }),
                [`title${n}`, { kind: "heading", label: L(`Reihe ${n}: Titel`, `Row ${n}: title`), required: true }],
                [`text${n}`, { kind: "text", label: L(`Reihe ${n}: Text`, `Row ${n}: text`) }],
                [`link_label${n}`, { kind: "button", label: L(`Reihe ${n}: Linktext (optional)`, `Row ${n}: link label (optional)`) }],
                [`link${n}`, { kind: "link", label: L(`Reihe ${n}: Link-Adresse`, `Row ${n}: link address`) }],
            ])),
        },
        versions: {
            "left-first": { name: L("Bild links, rechts, links", "Image left, right, left"),
                wire: [[0, 2, "l"], [20, 22, "r"], [40, 42, "l"]].flatMap(([y, ty, side]) => side === "l"
                    ? [["media", 0, y + 1, 48, 18], ["line", 54, ty + 4, 22, "bold"], ["line", 54, ty + 9, 32]] : [["line", 6, ty + 4, 22, "bold"], ["line", 6, ty + 9, 32], ["media", 52, y + 1, 48, 18]]) },
            "right-first": { name: L("Bild rechts, links, rechts", "Image right, left, right"),
                wire: [[0, 2, "r"], [20, 22, "l"], [40, 42, "r"]].flatMap(([y, ty, side]) => side === "l"
                    ? [["media", 0, y + 1, 48, 18], ["line", 54, ty + 4, 22, "bold"], ["line", 54, ty + 9, 32]] : [["line", 6, ty + 4, 22, "bold"], ["line", 6, ty + 9, 32], ["media", 52, y + 1, 48, 18]]) },
        },
        magazine: { layout: "E", unit: (s, k) => cardsUnit(s, k, ".kalq-f-alt__row") },
        render: renderAlternating,
    },
    "testimonials.stack": {
        category: "testimonials",
        name: L("Stimmen im Stapel", "Testimonials"),
        keywords: "testimonials stimmen zitate quotes kunden clients stack stapel cards karten",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift (optional)", "Eyebrow (optional)") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
        },
        versions: {
            stack: { name: L("Karten im Stapel, die oberste fliegt beim Scrollen weg", "Stacked cards, the top one flicks away on scroll"),
                wire: [["heading", 6, 10, 30], ["line", 6, 16, 22], ["band", 50, 18, 40, 30], ["band", 47, 14, 46, 30], ["rule", 44, 10, 52], ["line", 48, 20, 36, "bold"], ["line", 48, 25, 32], ["line", 48, 36, 14]] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: TESTIMONIALS_MIN, max: TESTIMONIALS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (testimonialItems(entry).filter((it) => has(get, page, entry, `q_${it.id}`) && has(get, page, entry, `n_${it.id}`)).length >= TESTIMONIALS_MIN
            ? [] : [L(`mindestens ${TESTIMONIALS_MIN} Zitate mit Namen`, `at least ${TESTIMONIALS_MIN} quotes with a name`)]),
        magazine: {
            layout: "B",
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-f-heading") || s.querySelector(".kalq-f-ts__name"),
                body: [...s.querySelectorAll(".kalq-f-ts__card")].flatMap((c) => [k.textOf(c.querySelector(".kalq-f-ts__id"), "p", "bk-eyebrow"), ...k.parasOf(c.querySelector(".kalq-f-ts__quote"))]) /* who, then the quote: a page never ends on a name */.filter(Boolean) }),
        },
        render: renderTestimonials,
    },
    "scroll.tether": {
        category: "scroll",
        name: L("Gestapelte Karten", "Stacking pinned cards"),
        keywords: "tether stacking stack pinned pin cards karten stapel scroll overlap",
        slots: { heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") } },
        versions: {
            tether: { name: L("Jede Karte bleibt stehen, die nächste schiebt sich darüber", "Each card pins, the next slides up over it"),
                wire: [["band", 4, 6, 92, 44], ["band", 4, 10, 92, 44], ["band", 4, 14, 92, 44], ["line", 8, 22, 26, "light"], ["line", 8, 28, 34, "light"], ["media", 54, 18, 38, 30]] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: TETHER_MIN, max: TETHER_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (tetherItems(entry).filter((it) => has(get, page, entry, `t_${it.id}`)).length >= TETHER_MIN
            ? [] : [L(`mindestens ${TETHER_MIN} Karten mit Titel`, `at least ${TETHER_MIN} cards with a title`)]),
        magazine: { layout: "E", unit: (s, k) => cardsUnit(s, k, ".kalq-f-tether__card") },
        render: renderTether,
    },
    "scroll.horizontal": {
        category: "scroll",
        name: L("Karten quer scrollen", "Horizontal scroll cards"),
        keywords: "horizontal scroll sideways quer seitlich cards karten pinned pin row reihe",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            intro: { kind: "text", label: L("Einleitung (optional)", "Intro (optional)") },
        },
        versions: {
            horizontal: { name: L("Die Seite steht, die Karten gleiten seitwärts", "The page pins while the cards slide sideways"),
                wire: [["heading", 6, 8, 30], ["line", 6, 14, 22], ...[6, 34, 62, 90].flatMap((x) => [["media", x, 22, 24, 22], ["line", x, 47, 14, "bold"], ["line", x, 51, 20]])] },
        },
        initialOpts: () => ({ items: Array.from({ length: 4 }, () => ({ id: newId() })) }),
        itemsEditor: { min: HCARDS_MIN, max: HCARDS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (hcardItems(entry).filter((it) => has(get, page, entry, `t_${it.id}`)).length >= HCARDS_MIN
            ? [] : [L(`mindestens ${HCARDS_MIN} Karten mit Titel`, `at least ${HCARDS_MIN} cards with a title`)]),
        magazine: { layout: "E", unit: (s, k) => cardsUnit(s, k, ".kalq-f-hs__card") },
        render: renderHorizontal,
    },
};
