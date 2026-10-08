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
import { L, SAFE_HREF, VIDEO_URL, altField, append, buttonEl, el, keyOf, mediaEl, mediaOf, picture, placeholder, plain, rangeEl, rangeOf, section, slotEl, textOf } from "./kit.js";
import { sanitizeSvg } from "../../lib/svg-sanitize.js";
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
const KIND_NAMES = { image: "Image or video", text: "Text", quote: "Quote", button: "Button", link: "Link" };

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
        body = mediaEl(ctx, `img_${p.id}`, "kalq-f-img", { label: label("Bild oder Video", "Image or video") });
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
// Harbor's stacking cards: the cards centred on the page, piled, the next cards' edges peeking out below in their own
// colours; scrolling flicks the top one away to reveal the next (js/modules/scrollEffects.js). An optional heading
// above; at the cards' mid-height two small side labels. Each card: a big mark top left (the person's initial, a
// brand name or an SVG logo), a small rounded portrait top right, the quote, the name, the role, an optional brand
// logo. Per card the editor sets its colour or a background picture (the text stays readable over a shade).
export const TESTIMONIALS_MIN = 2, TESTIMONIALS_MAX = 8;
// top left: the brand's logo (an uploaded SVG or image) or its name, switched in the editor. Earlier marks map over
const MARKS = ["logo", "name"];
const OLD_MARKS = { initial: "name", brand: "name", svg: "logo", image: "logo" };
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_TESTIMONIALS = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
export const testimonialItems = (entry) => itemsOf(entry, TESTIMONIALS_MAX, DEFAULT_TESTIMONIALS).map((x) => ({
    id: x.id, bg: HEX.test(x.bg || "") ? x.bg.toLowerCase() : "", image: x.image === true, mark: MARKS.includes(x.mark) ? x.mark : OLD_MARKS[x.mark] || "name" }));
const LABELS = { left: L("Stimmen", "Testimonials"), right: L("Sie lieben uns", "They are in love with us") };
// light text on a dark card: by the colour's relative luminance
const isDarkHex = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
};

// An SVG uploaded as a logo: kept as sanitised SVG text in its block (lib/svg-sanitize.js), drawn inline. Editors get
// the keyed box (js/edit.js offers the upload); visitors get it only when there is one.
function svgEl(ctx, slot, cls, { label, name } = {}) {
    const clean = sanitizeSvg(textOf(ctx, slot) || "");
    if (!clean && !ctx.editor) return null;
    const box = el(ctx, "div", cls);
    if (ctx.editor) {
        box.setAttribute("data-kalq-key", keyOf(ctx, slot));
        box.setAttribute("data-kalq-type", "svg");
        if (!clean) { placeholder(box, { label }); box.classList.add("kalq-ph-svg"); }
    }
    if (clean) box.innerHTML = clean;
    if (name) { box.setAttribute("role", "img"); box.setAttribute("aria-label", name); } else box.setAttribute("aria-hidden", "true");
    return box;
}

// The editor's changes: the list (add, move, remove) and each card's colour, background picture and mark
function testimonialsAct(opts, action, id, arg) {
    const items = testimonialItems({ opts });
    const i = items.findIndex((x) => x.id === id);
    let label = null;
    if (action === "add" && items.length < TESTIMONIALS_MAX) { items.push({ id: newId() }); label = "testimonial added"; }
    else if (action === "remove" && i >= 0 && items.length > TESTIMONIALS_MIN) { items.splice(i, 1); label = "testimonial removed"; }
    else if ((action === "up" && i > 0) || (action === "down" && i >= 0 && i < items.length - 1)) {
        const j = action === "up" ? i - 1 : i + 1;
        [items[i], items[j]] = [items[j], items[i]];
        label = `testimonial moved ${action}`;
    } else if (action === "bg" && i >= 0 && (arg === "" || HEX.test(arg || ""))) {
        if (items[i].bg === (arg || "").toLowerCase()) return null;
        items[i].bg = (arg || "").toLowerCase();
        label = arg ? `card colour ${arg}` : "card colour reset";
    } else if (action === "image" && i >= 0) { items[i].image = !items[i].image; label = `background picture ${items[i].image ? "on" : "off"}`; }
    else if (action === "mark" && i >= 0 && MARKS.includes(arg)) { if (items[i].mark === arg) return null; items[i].mark = arg; label = `card mark: ${arg}`; }
    if (!label) return null;
    opts.items = items;
    return label;
}

// The card's one optional link (a profile or a website), drawn as its site's icon: LinkedIn, Wikipedia, else a globe
const SOCIAL = [
    { id: "linkedin", test: /(^|\.)linkedin\.com$/i, label: "LinkedIn",
        svg: '<path d="M4.5 9h3v10.5h-3zM6 4.3a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5ZM10 9h2.9v1.5c.5-.9 1.7-1.8 3.4-1.8 3.2 0 3.8 2 3.8 4.7v6.1h-3v-5.4c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8v5.5h-3z" fill="currentColor"/>' },
    { id: "wikipedia", test: /(^|\.)wikipedia\.org$/i, label: "Wikipedia",
        svg: '<path d="M2.5 6.5h4.2M9.6 6.5h3.8M16.8 6.5h4.7M4.4 6.5l4.3 11 3.1-7.4M10.6 6.5l4.5 11 4.4-11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: "web", test: /./, label: { de: "Website", en: "Website" },
        svg: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.3 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.3-3.4-8.5s1-6.1 3.4-8.5Z" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
];
function socialLink(ctx, slot, who) {
    const raw = plain(textOf(ctx, slot));
    let url = null;
    try { url = /^https?:\/\//i.test(raw) ? new URL(raw) : null; } catch { url = null; }
    if (!url && !ctx.editor) return null;
    const kind = url ? SOCIAL.find((x) => x.test.test(url.hostname)) : SOCIAL[2];
    const name = typeof kind.label === "string" ? kind.label : kind.label[ctx.lang === "en" ? "en" : "de"];
    const icon = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">${kind.svg}</svg>`;
    if (ctx.editor) {
        const wrap = el(ctx, "div", `kalq-f-ts__social is-${kind.id}`);
        wrap.innerHTML = icon;
        wrap.append(slotEl(ctx, slot, "span", { className: "kalq-m-link-field", label: L("Link (optional): LinkedIn, Wikipedia oder eine Website", "Link (optional): LinkedIn, Wikipedia or a website") }));
        return wrap;
    }
    const a = el(ctx, "a", `kalq-f-ts__social is-${kind.id}`);
    a.setAttribute("href", url.href);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
    a.setAttribute("aria-label", who ? `${name}: ${who}` : name);
    a.innerHTML = icon;
    return a;
}

function testimonialCard(ctx, it, k, count, pos) {
    const n = `Card ${k + 1}: `, nd = `Karte ${k + 1}: `;
    const quote = slotEl(ctx, `q_${it.id}`, "blockquote", { className: "kalq-f-ts__quote", format: "paragraphs", label: L(`${nd}Zitat (nur echte Zitate)`, `${n}quote (real quotes only)`) });
    const name = slotEl(ctx, `n_${it.id}`, "span", { className: "kalq-f-ts__name", label: L(`${nd}Name`, `${n}name`) });
    if (!ctx.editor && (!quote || !name)) return null;
    const dark = it.bg ? isDarkHex(it.bg) : pos % 4 === 3;
    const card = el(ctx, "figure", `kalq-f-ts__card tone-${pos % 4}${dark ? " is-dark" : ""}`);
    if (it.bg) card.setAttribute("style", `--ts-bg: ${it.bg}`);
    // the background picture behind a shade, so the text stays readable
    if (it.image) {
        const bg = mediaEl(ctx, `g_${it.id}`, "kalq-f-ts__bg", { alt: "", label: L(`${nd}Hintergrund: Bild oder Video`, `${n}background: image or video`) });
        if (bg) { bg.setAttribute("aria-hidden", "true"); card.append(bg); card.classList.add("has-image"); }
    }
    if (ctx.editor) {
        const t = itemTools(ctx, it.id, k + 1, count, TESTIMONIALS_MIN, "Testimonial");
        const colour = el(ctx, "input", "kalq-f-tool kalq-f-colour");
        colour.setAttribute("type", "color");
        colour.setAttribute("value", it.bg || "#e8ecf6");
        colour.setAttribute("data-items-action", "bg");
        colour.setAttribute("data-items-id", it.id);
        colour.setAttribute("aria-label", "Card colour");
        t.append(group(ctx, "Colour", colour, tool(ctx, "bg", "Default", { id: it.id, arg: "", pressed: !it.bg })),
            tool(ctx, "image", "Background picture", { id: it.id, pressed: it.image }),
            group(ctx, "Top left", ...MARKS.map((m) => tool(ctx, "mark", { logo: "Logo", name: "Brand name" }[m], { id: it.id, arg: m, pressed: it.mark === m }))));
        card.append(t);
    }
    // top left: the brand's logo (an uploaded SVG, else an uploaded image) or the brand name; nothing else there
    const company = plain(textOf(ctx, `b_${it.id}`));
    let mark;
    if (it.mark === "logo") {
        const svg = svgEl(ctx, `k_${it.id}`, "kalq-f-ts__mark is-logo", { label: L(`${nd}Logo als SVG`, `${n}logo as SVG`), name: company || null });
        const hasSvg = !!svg?.querySelector("svg");
        const img = hasSvg ? null : mediaEl(ctx, `m_${it.id}`, "kalq-f-ts__mark is-logo is-image", { alt: company, label: L(`${nd}Logo als Bild`, `${n}logo as image`), identity: true }); // a brand's
        if (!ctx.editor) mark = hasSvg ? svg : img;
        else mark = append(el(ctx, "div", "kalq-f-ts__mark-edit"), hasSvg ? svg : append(el(ctx, "div", "kalq-f-ts__mark-choices"), svg, img),
            slotEl(ctx, `b_${it.id}`, "span", { className: "kalq-m-alt-field", label: L(`${nd}Markenname (Alternativtext des Logos)`, `${n}brand name (the logo's alt text)`) }));
    }
    if (!mark) mark = slotEl(ctx, `b_${it.id}`, "span", { className: "kalq-f-ts__mark is-name", label: L(`${nd}Markenname`, `${n}brand name`) });
    // top right: the portrait
    const portrait = mediaEl(ctx, `p_${it.id}`, "kalq-f-ts__photo", { alt: "", label: L(`${nd}Porträt`, `${n}portrait`), identity: true }); // a person's
    portrait?.setAttribute("aria-hidden", "true"); // decorative: the name says who
    const who = plain(textOf(ctx, `n_${it.id}`));
    append(card, append(el(ctx, "div", "kalq-f-ts__top"), mark, portrait), quote,
        append(el(ctx, "div", "kalq-f-ts__foot"),
            append(el(ctx, "figcaption", "kalq-f-ts__who"), name,
                slotEl(ctx, `r_${it.id}`, "span", { className: "kalq-f-ts__role", label: L(`${nd}Rolle`, `${n}role`) }),
                slotEl(ctx, `co_${it.id}`, "span", { className: "kalq-f-ts__company", label: L(`${nd}Firmenzeile, z. B. „bei Amazon“`, `${n}company line, e.g. "at Amazon"`) })),
            socialLink(ctx, `u_${it.id}`, who)));
    return card;
}

function renderTestimonials(ctx) {
    const items = testimonialItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-ts");
    s.setAttribute("data-scroll-effect", "stack"); // armed outside edit mode only (signed-in editors get this render too)
    const inner = el(ctx, "div", "kalq-f-inner kalq-f-ts__inner");
    const deck = el(ctx, "div", "kalq-f-ts__deck");
    let pos = 0;
    items.forEach((it, k) => { const c = testimonialCard(ctx, it, k, items.length, pos); if (c) { deck.append(c); pos++; } });
    if (!deck.children.length && !ctx.editor) return null;
    // the side labels: the editor's words, else the defaults
    const label = (slot, side) => slotEl(ctx, slot, "h4", { className: `kalq-f-ts__label is-${side}` })
        || el(ctx, "h4", `kalq-f-ts__label is-${side}`, LABELS[side][ctx.lang === "en" ? "en" : "de"]);
    append(inner, slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }),
        append(el(ctx, "div", "kalq-f-ts__stage"), label("label_left", "left"), deck, label("label_right", "right")),
        ctx.editor ? addTool(ctx, "testimonial", items.length, TESTIMONIALS_MAX) : null);
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
        const media = mediaEl(ctx, `p_${it.id}`, "kalq-f-tether__media", { label: L(`${nd}Bild oder Video`, `${n}image or video`) });
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
        const media = mediaEl(ctx, `p_${it.id}`, "kalq-f-hs__media", { label: L(`${nd}Bild oder Video`, `${n}image or video`) });
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

//=================================== 7. Hero card ===================================//
// A large rounded card set in from the page's edges by a small margin, a picture or video behind it that drifts with a
// gentle parallax as the page scrolls (js/modules/scrollEffects.js, off under reduced motion and while editing).
// Centred on it: an optional small label in a glass pill, the big title (a real heading, the style's display size),
// an optional button the editor can switch off. A soft dark shade keeps the light text readable; its strength is set
// in edit mode. The picture is decorative unless the editor describes it.
function heroCardAct(opts, action) {
    if (action !== "button") return null;
    opts.button = opts.button === false; // on unless switched off
    return `button ${opts.button ? "on" : "off"}`;
}

function renderHeroCard(ctx) {
    const withButton = ctx.entry.opts?.button !== false;
    const s = section(ctx, "kalq-f kalq-f-hc");
    s.setAttribute("data-scroll-effect", "parallax"); // armed outside edit mode only
    const card = el(ctx, "div", "kalq-f-hc__card");
    const media = mediaEl(ctx, "media", "kalq-f-hc__media");
    if (media) {
        if (!plain(textOf(ctx, "media_alt"))) media.setAttribute("aria-hidden", "true");
        card.append(media);
    }
    const shade = el(ctx, "div", "kalq-f-hc__shade");
    shade.setAttribute("aria-hidden", "true");
    shade.setAttribute("style", `opacity: ${rangeOf(ctx, "shade") / 100}`);
    card.append(shade);
    const content = append(el(ctx, "div", "kalq-f-hc__content"),
        slotEl(ctx, "label", "p", { className: "kalq-f-hc__pill" }),
        slotEl(ctx, "heading", "h2", { className: "kalq-f-hc__title" }),
        withButton ? linkTo(ctx, "button", "link", "page", "kalq-m-button is-light kalq-f-hc__button") : null);
    if (ctx.editor) {
        content.prepend(tools(ctx, "is-module", tool(ctx, "button", "Button", { pressed: withButton, label: "Button on or off" })));
        content.append(rangeEl(ctx, "shade", ".kalq-f-hc__shade"), altField(ctx, "media"));
    }
    card.append(content);
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, card);
}

//=================================== Heroes ===================================//
// The page's opening, with its h1. A hero goes on top of the page as a draft; publishing it replaces the hero there
// (js/sections.js). Two, from the site's own: Home's (a video or picture behind the title, the slogan lines below,
// a pause for the video) and the secondary pages' (Platform, Company: the title on the left in the middle of the
// screen, a line under it, a picture behind it optional).
function heroMedia(ctx, className) {
    const media = mediaEl(ctx, "media", className);
    if (media && !plain(textOf(ctx, "media_alt"))) media.setAttribute("aria-hidden", "true"); // a backdrop unless described
    return media;
}
function heroShade(ctx, className) {
    const shade = el(ctx, "div", className);
    shade.setAttribute("aria-hidden", "true");
    shade.setAttribute("style", `opacity: ${rangeOf(ctx, "shade") / 100}`);
    return shade;
}

function renderVideoHero(ctx) {
    const s = section(ctx, "kalq-f kalq-f-hero is-video");
    s.setAttribute("data-hero", "video");
    const media = heroMedia(ctx, "kalq-f-hero__media");
    const isVideo = VIDEO_URL.test(mediaOf(ctx, "media") || "");
    const content = append(el(ctx, "div", "kalq-f-hero__content"),
        slotEl(ctx, "heading", "h1", { className: "kalq-f-hero__title" }),
        slotEl(ctx, "slogan", "p", { className: "kalq-f-hero__slogan", format: "lines" }));
    if (ctx.editor) content.append(rangeEl(ctx, "shade", ".kalq-f-hero__shade"), altField(ctx, "media"));
    // a video that plays on its own has a visible pause (js/moduleBehaviour.js); under reduced motion it stays still
    const pause = isVideo ? el(ctx, "button", "kalq-f-hero__pause") : null;
    if (pause) { pause.setAttribute("type", "button"); pause.setAttribute("data-label-pause", ctx.lang === "en" ? "Pause the video" : "Video anhalten"); pause.setAttribute("data-label-play", ctx.lang === "en" ? "Play the video" : "Video abspielen"); pause.setAttribute("aria-label", pause.getAttribute("data-label-pause")); }
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, media, heroShade(ctx, "kalq-f-hero__shade"), content, pause);
}

function renderPageHero(ctx) {
    const s = section(ctx, "kalq-f kalq-f-hero is-page");
    s.setAttribute("data-hero", "page");
    // the picture is optional: without one the hero is the page's own colour (editors see where it would go)
    const withPicture = !!mediaOf(ctx, "media");
    if (withPicture || ctx.editor) {
        s.classList.toggle("has-media", withPicture);
        append(s, heroMedia(ctx, "kalq-f-hero__media"), withPicture ? heroShade(ctx, "kalq-f-hero__shade") : null);
    }
    const content = append(el(ctx, "div", "kalq-f-hero__content"),
        slotEl(ctx, "eyebrow", "p", { className: "kalq-f-hero__eyebrow" }),
        slotEl(ctx, "heading", "h1", { className: "kalq-f-hero__title" }),
        slotEl(ctx, "intro", "p", { className: "kalq-f-hero__intro" }));
    if (ctx.editor) content.append(rangeEl(ctx, "shade", ".kalq-f-hero__shade"), altField(ctx, "media"));
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, content);
}

// Signal's: a huge bold title on the accent colour, three short lines along the bottom (left, middle, right)
function renderStatementHero(ctx) {
    const s = section(ctx, "kalq-f kalq-f-hero is-statement");
    s.setAttribute("data-hero", "statement");
    const title = slotEl(ctx, "heading", "h1", { className: "kalq-f-hero__title" });
    const row = append(el(ctx, "div", "kalq-f-hero__row"),
        slotEl(ctx, "left", "p", { className: "kalq-f-hero__caption is-left" }),
        slotEl(ctx, "middle", "p", { className: "kalq-f-hero__caption is-middle" }),
        slotEl(ctx, "right", "p", { className: "kalq-f-hero__caption is-right" }));
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, append(el(ctx, "div", "kalq-f-hero__content"), title), row.childNodes.length ? row : null);
}

// Tether's: the title centred, a line, two buttons; below, three cards side by side: one with words on a dark ground,
// two pictures
function renderCentredHero(ctx) {
    const s = section(ctx, "kalq-f kalq-f-hero is-centred");
    s.setAttribute("data-hero", "centred");
    const buttons = append(el(ctx, "div", "kalq-f-hero__buttons"),
        linkTo(ctx, "button", "link", "page", "kalq-m-button kalq-f-hero__button is-primary"),
        linkTo(ctx, "button2", "link2", "page", "kalq-m-button kalq-f-hero__button is-secondary", { n: "2. " }));
    const head = append(el(ctx, "div", "kalq-f-hero__content"),
        slotEl(ctx, "heading", "h1", { className: "kalq-f-hero__title" }),
        slotEl(ctx, "intro", "p", { className: "kalq-f-hero__intro" }),
        buttons.childNodes.length ? buttons : null);
    // the cards are optional: visitors get only those filled (no empty boxes), sharing the row
    const show = (has) => ctx.editor || has;
    const cards = append(el(ctx, "div", "kalq-f-hero__cards"),
        show(!!textOf(ctx, "card")) ? append(el(ctx, "div", "kalq-f-hero__card is-words"), slotEl(ctx, "card", "p", { className: "kalq-f-hero__card-text" })) : null,
        show(!!mediaOf(ctx, "media")) ? append(el(ctx, "div", "kalq-f-hero__card is-picture is-accent"), mediaEl(ctx, "media", "kalq-f-hero__card-media"), ctx.editor ? altField(ctx, "media") : null) : null,
        show(!!mediaOf(ctx, "media2")) ? append(el(ctx, "div", "kalq-f-hero__card is-picture"), mediaEl(ctx, "media2", "kalq-f-hero__card-media"), ctx.editor ? altField(ctx, "media2") : null) : null);
    cards.setAttribute("style", `--cards: ${Math.max(1, cards.childNodes.length)}`);
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, head, cards.childNodes.length ? cards : null);
}

// Harbor's: a picture or video behind, the title large and low on the left; along the bottom a glass card (a small
// picture, a line, a button) and a label with a few words
function renderGlassHero(ctx) {
    const s = section(ctx, "kalq-f kalq-f-hero is-glass");
    s.setAttribute("data-hero", "glass");
    const isVideo = VIDEO_URL.test(mediaOf(ctx, "media") || "");
    const card = append(el(ctx, "div", "kalq-f-hero__glass"),
        mediaEl(ctx, "cardMedia", "kalq-f-hero__glass-media"),
        append(el(ctx, "div", "kalq-f-hero__glass-body"),
            slotEl(ctx, "cardText", "p", { className: "kalq-f-hero__glass-text" }),
            linkTo(ctx, "button", "link", "page", "kalq-m-button is-light kalq-f-hero__glass-button")));
    if (ctx.editor) card.append(altField(ctx, "cardMedia"));
    const bottom = append(el(ctx, "div", "kalq-f-hero__bottom"), card,
        append(el(ctx, "div", "kalq-f-hero__note"), slotEl(ctx, "label", "p", { className: "kalq-f-hero__label" }), slotEl(ctx, "text", "p", { className: "kalq-f-hero__text" })));
    const content = append(el(ctx, "div", "kalq-f-hero__content"), slotEl(ctx, "heading", "h1", { className: "kalq-f-hero__title" }));
    if (ctx.editor) content.append(rangeEl(ctx, "shade", ".kalq-f-hero__shade"), altField(ctx, "media"));
    const pause = isVideo ? el(ctx, "button", "kalq-f-hero__pause") : null;
    if (pause) { pause.setAttribute("type", "button"); pause.setAttribute("data-label-pause", ctx.lang === "en" ? "Pause the video" : "Video anhalten"); pause.setAttribute("data-label-play", ctx.lang === "en" ? "Play the video" : "Video abspielen"); pause.setAttribute("aria-label", pause.getAttribute("data-label-pause")); }
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, heroMedia(ctx, "kalq-f-hero__media"), heroShade(ctx, "kalq-f-hero__shade"), content, bottom, pause);
}

const heroUnit = (s, k) => ({ layout: "C", title: s.querySelector(".kalq-f-hero__title"), body: k.parasOf(s.querySelector(".kalq-f-hero__slogan, .kalq-f-hero__intro, .kalq-f-hero__text, .kalq-f-hero__caption.is-middle")).filter(Boolean),
    media: [k.mediaUrl(s.querySelector(".kalq-f-hero__media, .kalq-f-hero__card-media"))] });

//=================================== Statements that light up ===================================//
// Harbor's: one large statement, a picture behind it optional; its words light up one after another as the section
// passes (js/modules/scrollEffects.js "lit"; all lit while editing and under reduced motion). Up to three figures
// along the bottom, each a small label, a value and a line: only those filled are shown (no invented numbers).
const STAT_KEYS = ["1", "2", "3"];
function renderLitStatement(ctx) {
    const s = section(ctx, "kalq-f kalq-f-lit");
    s.setAttribute("data-scroll-effect", "lit");
    const withPicture = !!mediaOf(ctx, "media");
    if (withPicture || ctx.editor) {
        s.classList.toggle("has-media", withPicture);
        append(s, heroMedia(ctx, "kalq-f-lit__media"), withPicture ? heroShade(ctx, "kalq-f-lit__shade") : null);
    }
    const statement = slotEl(ctx, "statement", "h2", { className: "kalq-f-lit__words" });
    const stats = append(el(ctx, "div", "kalq-f-lit__stats"), ...STAT_KEYS.map((k) => {
        const value = slotEl(ctx, `value${k}`, "p", { className: "kalq-f-lit__value", label: L(`Zahl ${k}`, `Figure ${k}`) });
        if (!ctx.editor && !value) return null;
        return append(el(ctx, "div", "kalq-f-lit__stat"),
            slotEl(ctx, `label${k}`, "p", { className: "kalq-f-lit__label", label: L(`Zahl ${k}: Etikett`, `Figure ${k}: label`) }), value,
            slotEl(ctx, `text${k}`, "p", { className: "kalq-f-lit__text", label: L(`Zahl ${k}: eine Zeile`, `Figure ${k}: one line`) }));
    }));
    if (ctx.editor) s.append(append(el(ctx, "div", "kalq-f-inner"), rangeEl(ctx, "shade", ".kalq-f-lit__shade"), altField(ctx, "media")));
    if (!ctx.editor && !textOf(ctx, "statement")) return null;
    return append(s, append(el(ctx, "div", "kalq-f-lit__inner"), statement, stats.childNodes.length ? stats : null));
}

// Signal's: a sentence in large capitals with two small pictures set between its words; it lights up word by word too
function renderPictureSentence(ctx) {
    const s = section(ctx, "kalq-f kalq-f-sentence");
    s.setAttribute("data-scroll-effect", "lit");
    const pic = (slot) => {
        const m = mediaEl(ctx, slot, "kalq-f-sentence__pic");
        if (!m) return null;
        if (!ctx.editor && !mediaOf(ctx, slot)) return null; // no grey box in the middle of a sentence
        m.setAttribute("aria-hidden", plain(textOf(ctx, `${slot}_alt`)) ? "false" : "true");
        return m;
    };
    const words = el(ctx, "h2", "kalq-f-lit__words kalq-f-sentence__words");
    // real spaces between the parts and the pictures: the sentence reads whole
    const space = () => ctx.doc.createTextNode(" ");
    const pieces = [slotEl(ctx, "part1", "span", { className: "kalq-f-sentence__part" }), pic("pic1"),
        slotEl(ctx, "part2", "span", { className: "kalq-f-sentence__part" }), pic("pic2"),
        slotEl(ctx, "part3", "span", { className: "kalq-f-sentence__part" })].filter(Boolean);
    pieces.forEach((p, i) => { if (i) words.append(space()); words.append(p); });
    if (ctx.editor) s.append(append(el(ctx, "div", "kalq-f-inner"), altField(ctx, "pic1"), altField(ctx, "pic2")));
    if (!ctx.editor && !textOf(ctx, "part1")) return null;
    return append(s, append(el(ctx, "div", "kalq-f-lit__inner"), words));
}

//=================================== Video with a play pill ===================================//
// Signal's and Tether's: a large rounded video, still until asked: its first picture (or a picture set for it) and a
// glass pill "Play video" that stays in view while the video passes. Pressed, the video plays with its sound and its
// own controls; pressed again, it pauses (js/moduleBehaviour.js). Nothing plays on its own.
function renderPillVideo(ctx) {
    const s = section(ctx, "kalq-f kalq-f-pv");
    s.setAttribute("data-pill-video", "");
    s.setAttribute("data-scroll-effect", "pill"); // the pill travels down the picture (outside edit mode, with motion)
    const url = mediaOf(ctx, "media");
    const frame = el(ctx, "div", "kalq-f-pv__frame");
    if (url && VIDEO_URL.test(url)) {
        const video = el(ctx, "video", "kalq-f-pv__video");
        video.setAttribute("src", url);
        video.setAttribute("preload", "metadata");
        video.setAttribute("playsinline", "");
        const poster = mediaOf(ctx, "poster");
        if (poster) video.setAttribute("poster", poster);
        frame.append(video);
        const pill = el(ctx, "button", "kalq-f-pv__pill");
        pill.setAttribute("type", "button");
        pill.setAttribute("data-label-play", ctx.lang === "en" ? "Play video" : "Video abspielen");
        pill.setAttribute("data-label-pause", ctx.lang === "en" ? "Pause video" : "Video anhalten");
        const label = el(ctx, "span", "kalq-f-pv__pill-text", pill.getAttribute("data-label-play"));
        pill.append(label);
        frame.append(pill);
    } else if (ctx.editor) {
        frame.append(mediaEl(ctx, "media", "kalq-f-pv__empty")); // the slot to add the video to
    } else return null;
    if (ctx.editor) frame.append(append(el(ctx, "div", "kalq-f-pv__editor"), mediaEl(ctx, "poster", "kalq-f-pv__poster-slot"), url ? mediaEl(ctx, "media", "kalq-f-pv__video-slot") : null));
    const caption = slotEl(ctx, "caption", "p", { className: "kalq-f-pv__caption" });
    return append(s, append(el(ctx, "div", "kalq-f-pv__inner"), frame, caption));
}

//=================================== Cards to swipe ===================================//
// Signal's: a heading with a link on the right; below, a row of tall picture cards that runs off the edge and is
// swiped or dragged sideways (and scrolled with the keyboard: each card can take the focus). Each card: its title on
// the picture, a few tags as small pills along the bottom (written as a list, one per line).
export const SWIPE_MIN = 2, SWIPE_MAX = 12;
const DEFAULT_SWIPE = [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }];
export const swipeItems = (entry) => itemsOf(entry, SWIPE_MAX, DEFAULT_SWIPE);
function renderSwipeCards(ctx) {
    const items = swipeItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-sw");
    s.setAttribute("data-swipe", "");
    const head = append(el(ctx, "div", "kalq-f-inner kalq-f-sw__head"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading kalq-f-sw__heading" }),
        linkTo(ctx, "button", "link", "page", "kalq-link-underline kalq-f-link kalq-f-sw__link"));
    const track = el(ctx, "ul", "kalq-f-sw__track");
    items.forEach((it, k) => {
        const n = `Card ${k + 1}: `, nd = `Karte ${k + 1}: `;
        const title = slotEl(ctx, `t_${it.id}`, "h3", { className: "kalq-f-sw__title", label: L(`${nd}Titel`, `${n}title`) });
        if (!ctx.editor && !title) return;
        const card = el(ctx, "li", "kalq-f-sw__card");
        card.setAttribute("tabindex", "0");
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, SWIPE_MIN, "Card"));
        const tags = textOf(ctx, `g_${it.id}`);
        const pills = el(ctx, "ul", "kalq-f-sw__tags");
        if (!ctx.editor && tags) plain(tags.replace(/<br\s*\/?>/gi, "\n")).split(/\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 8).forEach((x) => pills.append(el(ctx, "li", "kalq-f-sw__tag", x)));
        append(card, mediaEl(ctx, `p_${it.id}`, "kalq-f-sw__media", { label: L(`${nd}Bild`, `${n}picture`) }), title,
            ctx.editor ? slotEl(ctx, `g_${it.id}`, "p", { className: "kalq-f-sw__tags-field", format: "lines", label: L(`${nd}Stichworte, eins pro Zeile`, `${n}tags, one per line`) }) : (pills.childNodes.length ? pills : null),
            ctx.editor ? altField(ctx, `p_${it.id}`, L(`${nd}Bildbeschreibung`, `${n}image description (alt text)`)) : null);
        track.append(card);
    });
    if (!track.children.length && !ctx.editor) return null;
    return append(s, head, track, ctx.editor ? append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "card", items.length, SWIPE_MAX)) : null);
}

//=================================== Questions and answers ===================================//
// Tether's: the heading and an optional button on the left, the questions on the right, each opening its answer
// (a real <details>: works without script, by keyboard and for screen readers; the first open). Editors see all open.
export const FAQ_MIN = 1, FAQ_MAX = 12;
const DEFAULT_FAQ = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
export const faqItems = (entry) => itemsOf(entry, FAQ_MAX, DEFAULT_FAQ);
function renderFaq(ctx) {
    const items = faqItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-faq");
    const side = append(el(ctx, "div", "kalq-f-faq__side"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }),
        linkTo(ctx, "button", "link", "page", "kalq-m-button kalq-f-faq__button"));
    const list = el(ctx, "div", "kalq-f-faq__list");
    let first = true;
    items.forEach((it, k) => {
        const n = `Question ${k + 1}: `, nd = `Frage ${k + 1}: `;
        const q = slotEl(ctx, `q_${it.id}`, "span", { className: "kalq-f-faq__q", label: L(`${nd}die Frage`, `${n}the question`) });
        const a = slotEl(ctx, `a_${it.id}`, "div", { className: "kalq-f-faq__a kalq-f-text", format: "paragraphs", label: L(`${nd}die Antwort`, `${n}the answer`) });
        if (!ctx.editor && (!q || !a)) return;
        if (ctx.editor) { list.append(append(el(ctx, "div", "kalq-f-faq__item is-open"), itemTools(ctx, it.id, k + 1, items.length, FAQ_MIN, "Question"), append(el(ctx, "div", "kalq-f-faq__summary"), q), a)); return; }
        const d = el(ctx, "details", "kalq-f-faq__item");
        if (first) { d.setAttribute("open", ""); first = false; }
        const sum = append(el(ctx, "summary", "kalq-f-faq__summary"), q, el(ctx, "span", "kalq-f-faq__icon"));
        sum.lastChild.setAttribute("aria-hidden", "true");
        list.append(append(d, sum, a));
    });
    if (!list.children.length && !ctx.editor) return null;
    return append(s, append(el(ctx, "div", "kalq-f-inner kalq-f-faq__grid"), side, append(list, ctx.editor ? addTool(ctx, "question", items.length, FAQ_MAX) : null)));
}

//=================================== Logo belt ===================================//
// Tether's and Harbor's: the companies' logos, each an SVG (uploaded, sanitised, its name read out), in a still row or
// a slowly moving belt. The belt runs only with motion allowed and has a pause; its second run is decoration.
export const LOGOS_MIN = 2, LOGOS_MAX = 16;
const DEFAULT_LOGOS = [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }, { id: "g5" }];
export const logoItems = (entry) => itemsOf(entry, LOGOS_MAX, DEFAULT_LOGOS);
function renderLogos(ctx) {
    const items = logoItems(ctx.entry);
    const belt = ctx.entry.version === "belt";
    const s = section(ctx, `kalq-f kalq-f-logos${belt ? " is-belt" : ""}`);
    const list = el(ctx, "ul", "kalq-f-logos__list");
    items.forEach((it, k) => {
        const n = `Logo ${k + 1}: `;
        const name = plain(textOf(ctx, `n_${it.id}`));
        const svg = svgEl(ctx, `k_${it.id}`, "kalq-f-logos__mark", { label: L(`${n}SVG`, `${n}SVG`), name: name || null });
        if (!ctx.editor && (!svg || !name)) return; // a logo needs its SVG and the company's name
        const li = el(ctx, "li", "kalq-f-logos__item");
        if (ctx.editor) li.append(itemTools(ctx, it.id, k + 1, items.length, LOGOS_MIN, "Logo"), slotEl(ctx, `n_${it.id}`, "p", { className: "kalq-f-logos__name", label: L(`${n}Name der Firma`, `${n}the company's name`) }));
        li.prepend(svg);
        list.append(li);
    });
    if (!list.children.length && !ctx.editor) return null;
    const track = append(el(ctx, "div", "kalq-f-logos__track"), list);
    if (belt && !ctx.editor) {
        const copy = list.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.querySelectorAll("[role]").forEach((n) => n.removeAttribute("role"));
        track.append(copy);
    }
    const pause = belt && !ctx.editor ? el(ctx, "button", "kalq-f-logos__pause") : null;
    if (pause) { pause.setAttribute("type", "button"); pause.setAttribute("aria-pressed", "false"); pause.setAttribute("aria-label", ctx.lang === "en" ? "Pause the logos" : "Logos anhalten"); }
    return append(s, append(el(ctx, "div", "kalq-f-inner"), slotEl(ctx, "heading", "h2", { className: "kalq-f-logos__heading" })), track, pause, ctx.editor ? append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "logo", items.length, LOGOS_MAX)) : null);
}

//=================================== Project list ===================================//
// Signal's: a small label, then rows of large titles between thin lines, each a link with an arrow; on a desktop a
// row's picture follows the pointer while it is over it (decoration: the title is the link)
export const PROJECTS_MIN = 1, PROJECTS_MAX = 12;
const DEFAULT_PROJECTS = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
export const projectItems = (entry) => itemsOf(entry, PROJECTS_MAX, DEFAULT_PROJECTS);
function renderProjects(ctx) {
    const items = projectItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-pl");
    s.setAttribute("data-follow", "");
    const list = el(ctx, "ul", "kalq-f-pl__list");
    items.forEach((it, k) => {
        const n = `Row ${k + 1}: `, nd = `Zeile ${k + 1}: `;
        const title = textOf(ctx, `t_${it.id}`);
        if (!ctx.editor && !title) return;
        const li = el(ctx, "li", "kalq-f-pl__row");
        if (ctx.editor) {
            append(li, itemTools(ctx, it.id, k + 1, items.length, PROJECTS_MIN, "Row"), slotEl(ctx, `t_${it.id}`, "p", { className: "kalq-f-pl__title", label: L(`${nd}Titel`, `${n}title`) }),
                slotEl(ctx, `l_${it.id}`, "span", { className: "kalq-m-link-field", label: L(`${nd}Seite oder URL (optional)`, `${n}a page or URL (optional)`) }),
                mediaEl(ctx, `p_${it.id}`, "kalq-f-pl__pic", { label: L(`${nd}Bild, das dem Zeiger folgt (optional)`, `${n}picture following the pointer (optional)`) }));
        } else {
            const raw = plain(textOf(ctx, `l_${it.id}`));
            const href = SAFE_HREF.test(raw) ? raw : null;
            const row = el(ctx, href ? "a" : "div", "kalq-f-pl__link");
            if (href) { row.setAttribute("href", href); if (/^https?:/i.test(href)) { row.setAttribute("target", "_blank"); row.setAttribute("rel", "noopener"); } }
            const t = el(ctx, "span", "kalq-f-pl__title");
            renderBlock(t, title);
            append(row, t, href ? el(ctx, "span", "kalq-f-pl__arrow", "↗") : null);
            row.lastChild?.setAttribute?.("aria-hidden", "true");
            const pic = mediaOf(ctx, `p_${it.id}`);
            if (pic && !VIDEO_URL.test(pic)) li.setAttribute("data-follow-src", pic);
            li.append(row);
        }
        list.append(li);
    });
    if (!list.children.length && !ctx.editor) return null;
    return append(s, append(el(ctx, "div", "kalq-f-inner"), slotEl(ctx, "label", "p", { className: "kalq-f-pl__label" }), list, ctx.editor ? addTool(ctx, "row", items.length, PROJECTS_MAX) : null));
}

//=================================== Testimonial slider ===================================//
// Signal's: one quote at a time, centred: the person's picture, the quote, the name and role; arrows and "1 / 3" to go
// to the others (nothing moves on its own). Without script every quote shows, one under the other.
export const SLIDES_MIN = 1, SLIDES_MAX = 10;
const DEFAULT_SLIDES = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
export const slideItems = (entry) => itemsOf(entry, SLIDES_MAX, DEFAULT_SLIDES);
function renderSlider(ctx) {
    const items = slideItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-sl");
    s.setAttribute("data-slider", "");
    const list = el(ctx, "ul", "kalq-f-sl__list");
    items.forEach((it, k) => {
        const n = `Quote ${k + 1}: `, nd = `Zitat ${k + 1}: `;
        const quote = slotEl(ctx, `q_${it.id}`, "blockquote", { className: "kalq-f-sl__quote", format: "paragraphs", label: L(`${nd}das Zitat`, `${n}the quote`) });
        const name = slotEl(ctx, `n_${it.id}`, "p", { className: "kalq-f-sl__name", label: L(`${nd}Name`, `${n}name`) });
        if (!ctx.editor && (!quote || !name)) return;
        const li = el(ctx, "li", "kalq-f-sl__slide");
        if (ctx.editor) li.append(itemTools(ctx, it.id, k + 1, items.length, SLIDES_MIN, "Quote"));
        append(li, mediaEl(ctx, `p_${it.id}`, "kalq-f-sl__face", { identity: true, label: L(`${nd}Foto der Person (optional)`, `${n}the person's photo (optional)`), alt: "" }), quote,
            append(el(ctx, "div", "kalq-f-sl__who"), name, slotEl(ctx, `r_${it.id}`, "p", { className: "kalq-f-sl__role", label: L(`${nd}Rolle (optional)`, `${n}role (optional)`) })));
        list.append(li);
    });
    if (!list.children.length && !ctx.editor) return null;
    const nav = ctx.editor ? addTool(ctx, "quote", items.length, SLIDES_MAX) : null;
    return append(s, append(el(ctx, "div", "kalq-f-inner kalq-f-sl__inner"), list, nav));
}

//=================================== Results grid ===================================//
// Tether's: a heading and a line centred; below, a grid of up to five tiles: a tall picture, a tile of words, two
// figures (a value and a line), a picture on the accent colour. Only tiles with content show (no invented figures).
function renderResults(ctx) {
    const s = section(ctx, "kalq-f kalq-f-rs");
    const head = append(el(ctx, "div", "kalq-f-inner kalq-f-rs__head"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" }), slotEl(ctx, "intro", "p", { className: "kalq-f-rs__intro" }));
    const tile = (cls, has, ...children) => (ctx.editor || has ? append(el(ctx, "div", `kalq-f-rs__tile ${cls}`), ...children) : null);
    const figure = (k) => tile(`is-figure is-f${k}`, !!textOf(ctx, `value${k}`),
        slotEl(ctx, `value${k}`, "p", { className: "kalq-f-rs__value", label: L(`Zahl ${k}`, `Figure ${k}`) }),
        slotEl(ctx, `line${k}`, "p", { className: "kalq-f-rs__line", label: L(`Zahl ${k}: eine Zeile`, `Figure ${k}: one line`) }));
    const grid = append(el(ctx, "div", "kalq-f-inner kalq-f-rs__grid"),
        tile("is-picture is-tall", !!mediaOf(ctx, "media"), mediaEl(ctx, "media", "kalq-f-rs__media"), ctx.editor ? altField(ctx, "media") : null),
        tile("is-words", !!textOf(ctx, "title"), slotEl(ctx, "title", "h3", { className: "kalq-f-rs__title" }), slotEl(ctx, "text", "p", { className: "kalq-f-rs__text" })),
        figure("1"),
        tile("is-picture is-accent", !!mediaOf(ctx, "media2"), mediaEl(ctx, "media2", "kalq-f-rs__media"), ctx.editor ? altField(ctx, "media2") : null),
        figure("2"));
    if (!ctx.editor && !textOf(ctx, "heading")) return null;
    return append(s, head, grid.childNodes.length ? grid : null);
}

//=================================== Video testimonials ===================================//
// Tether's: a heading centred; a row of person cards to swipe (js/moduleBehaviour.js, as Cards to swipe): a card with a
// quote is a quote card on the accent colour; one with a photo shows the person; a card with a video has a play button
// and plays it in place, with its controls. Nothing plays on its own.
export const VCARDS_MIN = 1, VCARDS_MAX = 12;
const DEFAULT_VCARDS = [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }];
export const vcardItems = (entry) => itemsOf(entry, VCARDS_MAX, DEFAULT_VCARDS);
function renderVideoCards(ctx) {
    const items = vcardItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-vc");
    s.setAttribute("data-swipe", "");
    const track = el(ctx, "ul", "kalq-f-sw__track kalq-f-vc__track");
    items.forEach((it, k) => {
        const n = `Card ${k + 1}: `, nd = `Karte ${k + 1}: `;
        const name = slotEl(ctx, `n_${it.id}`, "p", { className: "kalq-f-vc__name", label: L(`${nd}Name`, `${n}name`) });
        const quote = textOf(ctx, `q_${it.id}`);
        const photo = mediaOf(ctx, `p_${it.id}`);
        const video = mediaOf(ctx, `v_${it.id}`);
        if (!ctx.editor && (!name || (!quote && !photo))) return;
        const card = el(ctx, "li", `kalq-f-vc__card${quote ? " is-quote" : " is-photo"}`);
        card.setAttribute("tabindex", "0");
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, VCARDS_MIN, "Card"));
        if (ctx.editor || (!quote && photo)) card.append(mediaEl(ctx, `p_${it.id}`, "kalq-f-vc__media", { identity: true, label: L(`${nd}Foto der Person`, `${n}the person's photo`), alt: "" }));
        if (ctx.editor || quote) card.append(slotEl(ctx, `q_${it.id}`, "blockquote", { className: "kalq-f-vc__quote", format: "paragraphs", label: L(`${nd}Zitat (optional: macht eine Zitatkarte)`, `${n}quote (optional: makes a quote card)`) }));
        const foot = append(el(ctx, "div", "kalq-f-vc__foot"), append(el(ctx, "div", "kalq-f-vc__who"), name, slotEl(ctx, `r_${it.id}`, "p", { className: "kalq-f-vc__role", label: L(`${nd}Rolle (optional)`, `${n}role (optional)`) })));
        if (video && VIDEO_URL.test(video) && !ctx.editor) {
            const play = el(ctx, "button", "kalq-f-vc__play");
            play.setAttribute("type", "button");
            play.setAttribute("data-video", video);
            play.setAttribute("aria-label", `${ctx.lang === "en" ? "Play the video of" : "Video abspielen von"} ${plain(textOf(ctx, `n_${it.id}`))}`);
            foot.append(play);
        }
        card.append(foot);
        if (ctx.editor) card.append(mediaEl(ctx, `v_${it.id}`, "kalq-f-vc__video-slot", { label: L(`${nd}Video (optional)`, `${n}video (optional)`) }));
        track.append(card);
    });
    if (!track.children.length && !ctx.editor) return null;
    return append(s, append(el(ctx, "div", "kalq-f-inner kalq-f-vc__head"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" })), track,
        ctx.editor ? append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "card", items.length, VCARDS_MAX)) : null);
}

//=================================== Numbered services ===================================//
// Harbor's: a heading, then large cards numbered 01, 02, 03 (their order), each on a colour of the style with its
// title, a few words and a picture; the section pins while they slide sideways (the horizontal effect); stacked under
// reduced motion and while editing
export const SERVICES_MIN = 1, SERVICES_MAX = 8;
const DEFAULT_SERVICES = [{ id: "n1" }, { id: "n2" }, { id: "n3" }];
export const serviceItems = (entry) => itemsOf(entry, SERVICES_MAX, DEFAULT_SERVICES);
function renderServices(ctx) {
    const items = serviceItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-hs kalq-f-sv");
    s.setAttribute("data-scroll-effect", "horizontal");
    const track = el(ctx, "div", "kalq-f-hs__track kalq-f-sv__track");
    let shown = 0;
    items.forEach((it, k) => {
        const n = `Service ${k + 1}: `, nd = `Leistung ${k + 1}: `;
        const title = slotEl(ctx, `t_${it.id}`, "h3", { className: "kalq-f-sv__title", label: L(`${nd}Titel`, `${n}title`) });
        if (!ctx.editor && !title) return;
        shown += 1;
        const card = el(ctx, "article", `kalq-f-sv__card is-c${(shown - 1) % 3}`);
        if (ctx.editor) card.append(itemTools(ctx, it.id, k + 1, items.length, SERVICES_MIN, "Service"));
        const words = append(el(ctx, "div", "kalq-f-sv__words"), el(ctx, "p", "kalq-f-sv__num", String(shown).padStart(2, "0")), title,
            slotEl(ctx, `x_${it.id}`, "p", { className: "kalq-f-sv__text", label: L(`${nd}ein paar Sätze`, `${n}a few sentences`) }));
        words.firstChild.setAttribute("aria-hidden", "true");
        append(card, words, mediaEl(ctx, `p_${it.id}`, "kalq-f-sv__media", { label: L(`${nd}Bild`, `${n}picture`) }), ctx.editor ? altField(ctx, `p_${it.id}`) : null);
        track.append(card);
    });
    if (!track.children.length && !ctx.editor) return null;
    const pin = append(el(ctx, "div", "kalq-f-hs__pin"), append(el(ctx, "div", "kalq-f-inner kalq-f-hs__head"), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" })), track,
        ctx.editor ? append(el(ctx, "div", "kalq-f-inner"), addTool(ctx, "service", items.length, SERVICES_MAX)) : null);
    return append(s, pin);
}

//=================================== Pricing ===================================//
// Harbor's: a small label and a heading centred; the plans side by side in one frame: each its name, an optional
// pill ("Recommended"), a line, the price as written (nothing shown when left empty), a button, and what it includes
export const PLANS_MIN = 1, PLANS_MAX = 4;
const DEFAULT_PLANS = [{ id: "a" }, { id: "b" }, { id: "c" }];
export const planItems = (entry) => itemsOf(entry, PLANS_MAX, DEFAULT_PLANS);
function renderPricing(ctx) {
    const items = planItems(ctx.entry);
    const s = section(ctx, "kalq-f kalq-f-pr");
    const plans = el(ctx, "div", "kalq-f-pr__plans");
    items.forEach((it, k) => {
        const n = `Plan ${k + 1}: `, nd = `Paket ${k + 1}: `;
        const name = slotEl(ctx, `n_${it.id}`, "h3", { className: "kalq-f-pr__name", label: L(`${nd}Name`, `${n}name`) });
        if (!ctx.editor && !name) return;
        const plan = el(ctx, "article", "kalq-f-pr__plan");
        if (ctx.editor) plan.append(itemTools(ctx, it.id, k + 1, items.length, PLANS_MIN, "Plan"));
        const includes = textOf(ctx, `i_${it.id}`);
        const list = el(ctx, "ul", "kalq-f-pr__includes");
        if (!ctx.editor && includes) plain(includes.replace(/<br\s*\/?>/gi, "\n")).split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12).forEach((x) => list.append(el(ctx, "li", "", x)));
        append(plan, append(el(ctx, "div", "kalq-f-pr__top"), name, slotEl(ctx, `b_${it.id}`, "span", { className: "kalq-f-pr__badge", label: L(`${nd}Pille, z. B. Empfohlen (optional)`, `${n}pill, e.g. Recommended (optional)`) })),
            slotEl(ctx, `d_${it.id}`, "p", { className: "kalq-f-pr__desc", label: L(`${nd}eine Zeile`, `${n}one line`) }),
            append(el(ctx, "p", "kalq-f-pr__price"), slotEl(ctx, `p_${it.id}`, "span", { className: "kalq-f-pr__amount", label: L(`${nd}Preis, wie er dastehen soll`, `${n}price, as it should read`) }),
                ctx.doc.createTextNode(" "), slotEl(ctx, `u_${it.id}`, "span", { className: "kalq-f-pr__unit", label: L(`${nd}pro … (optional)`, `${n}per … (optional)`) })),
            linkTo(ctx, `c_${it.id}`, `l_${it.id}`, "page", "kalq-m-button kalq-f-pr__button", { n }),
            ctx.editor ? slotEl(ctx, `i_${it.id}`, "p", { className: "kalq-f-pr__includes-field", format: "lines", label: L(`${nd}Enthalten, eins pro Zeile`, `${n}includes, one per line`) }) : (list.childNodes.length ? list : null));
        plans.append(plan);
    });
    if (!plans.children.length && !ctx.editor) return null;
    plans.setAttribute("style", `--plans: ${Math.max(1, plans.children.length)}`);
    return append(s, append(el(ctx, "div", "kalq-f-inner"), append(el(ctx, "div", "kalq-f-pr__head"), slotEl(ctx, "label", "p", { className: "kalq-f-pr__label" }), slotEl(ctx, "heading", "h2", { className: "kalq-f-heading" })),
        plans, ctx.editor ? addTool(ctx, "plan", items.length, PLANS_MAX) : null));
}

//=================================== The book ===================================//
const cardsUnit = (s, k, sel) => ({ layout: "E", cards: [...s.querySelectorAll(sel)].map((c) => ({ media: k.mediaUrl(c.querySelector(".kalq-m-media")), eyebrow: c.querySelector(".kalq-m-eyebrow"),
    title: c.querySelector(".kalq-f-title"), body: k.parasOf(c.querySelector(".kalq-f-text")) })).filter((c) => c.title) });

//=================================== Definitions ===================================//
export const FINAL_CATEGORIES = [
    { id: "custom", de: "Eigenes Modul", en: "Custom" },
    { id: "heroes", de: "Heros", en: "Heroes" },
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
            // a picture piece counts as filled: publishing borrows one for it (js/sections.js borrowPictures)
            const filled = o.items.some((c) => c.pieces.some((p) => p.kind === "image" || slotsOf(p).some((sl) => has(get, page, entry, sl))));
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
                ...picture(`media${n}`, L(`Reihe ${n}: Bild oder Video`, `Row ${n}: image or video`), { required: true }),
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
    "heroes.video": {
        category: "heroes",
        name: L("Hero mit Video", "Hero with video"),
        keywords: "hero video background hintergrund film start home titel title slogan h1 vollbild full",
        slots: {
            ...Object.fromEntries(picture("media", L("Hintergrund: Video oder Bild", "Background: video or picture"), { required: true })),
            heading: { kind: "heading", label: L("Titel (die Überschrift der Seite)", "Title (the page's heading)"), required: true },
            slogan: { kind: "text", label: L("Slogan, eine Zeile pro Zeile", "Slogan, one line per line") },
            shade: { kind: "range", label: L("Abdunkelung", "Darkening"), min: 0, max: 85, step: 5, initial: 35, unit: "%" },
        },
        versions: {
            video: { name: L("Video hinter dem Titel, Slogan darunter", "Video behind the title, the slogan below"),
                wire: [["media", 0, 0, 100, 60, "play"], ["heading", 22, 24, 56, "light"], ["line", 30, 32, 40, "light"], ["line", 34, 36, 32, "light"]] },
        },
        magazine: { layout: "C", unit: heroUnit },
        render: renderVideoHero,
    },
    "heroes.page": {
        category: "heroes",
        name: L("Seitenkopf", "Page hero"),
        keywords: "hero page seite kopf header titel title intro platform company unterseite secondary h1",
        slots: {
            ...Object.fromEntries(picture("media", L("Bild dahinter (optional)", "Picture behind it (optional)"))),
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift (optional)", "Eyebrow (optional)") },
            heading: { kind: "heading", label: L("Titel (die Überschrift der Seite)", "Title (the page's heading)"), required: true },
            intro: { kind: "text", label: L("Einleitung (optional)", "Introduction (optional)") },
            shade: { kind: "range", label: L("Abdunkelung des Bildes", "Darkening of the picture"), min: 0, max: 85, step: 5, initial: 45, unit: "%" },
        },
        versions: {
            page: { name: L("Großer Titel links, wie Plattform und Unternehmen", "Large title on the left, as on Platform and Company"),
                wire: [["eyebrow", 6, 20, 14], ["heading", 6, 25, 70], ["heading", 6, 31, 52], ["line", 6, 39, 40]] },
        },
        magazine: { layout: "C", unit: heroUnit },
        render: renderPageHero,
    },
    "heroes.statement": {
        category: "heroes",
        name: L("Großer Titel auf Farbe", "Big title on colour"),
        keywords: "hero statement signal big bold title titel farbe colour color captions zeilen h1",
        slots: {
            heading: { kind: "heading", label: L("Titel (die Überschrift der Seite), kurz", "Title (the page's heading), short"), required: true },
            left: { kind: "eyebrow", label: L("Zeile unten links (optional)", "Line at the bottom left (optional)") },
            middle: { kind: "text", label: L("Zeile unten in der Mitte (optional)", "Line at the bottom middle (optional)") },
            right: { kind: "eyebrow", label: L("Zeile unten rechts (optional)", "Line at the bottom right (optional)") },
        },
        versions: {
            statement: { name: L("Riesiger Titel auf der Akzentfarbe, drei Zeilen unten", "A huge title on the accent colour, three lines below"),
                wire: [["band", 0, 0, 100, 60], ["heading", 12, 20, 76, "light"], ["heading", 18, 27, 64, "light"], ["eyebrow", 5, 54, 14, "light"], ["line", 38, 54, 24, "light"], ["eyebrow", 81, 54, 14, "light"]] },
        },
        magazine: { layout: "C", unit: heroUnit },
        render: renderStatementHero,
    },
    "heroes.centred": {
        category: "heroes",
        name: L("Titel mit drei Karten", "Title with three cards"),
        keywords: "hero tether centred centered mitte titel title buttons karten cards bilder pictures h1",
        slots: {
            heading: { kind: "heading", label: L("Titel (die Überschrift der Seite)", "Title (the page's heading)"), required: true },
            intro: { kind: "text", label: L("Eine Zeile darunter (optional)", "A line below (optional)") },
            button: { kind: "button", label: L("Erster Button: Text", "First button: label") },
            link: { kind: "link", label: L("Erster Button: Seite oder URL", "First button: a page or URL") },
            button2: { kind: "button", label: L("Zweiter Button: Text (optional)", "Second button: label (optional)") },
            link2: { kind: "link", label: L("Zweiter Button: Seite oder URL", "Second button: a page or URL") },
            card: { kind: "text", label: L("Erste Karte: ein paar Worte", "First card: a few words") },
            ...Object.fromEntries(picture("media", L("Zweite Karte: Bild", "Second card: picture"))),
            ...Object.fromEntries(picture("media2", L("Dritte Karte: Bild", "Third card: picture"))),
        },
        versions: {
            centred: { name: L("Titel in der Mitte, zwei Buttons, drei Karten", "The title centred, two buttons, three cards"),
                wire: [["heading", 26, 8, 48], ["heading", 32, 13, 36], ["line", 36, 19, 28], ["button", 38, 24, 11], ["button", 51, 24, 11], ["band", 4, 33, 29, 25], ["media", 35.5, 33, 29, 25], ["media", 67, 33, 29, 25]] },
        },
        magazine: { layout: "C", unit: heroUnit },
        render: renderCentredHero,
    },
    "heroes.glass": {
        category: "heroes",
        name: L("Bild mit Glaskarte", "Picture with a glass card"),
        keywords: "hero harbor bild picture video glass glas karte card titel title unten bottom h1",
        slots: {
            ...Object.fromEntries(picture("media", L("Hintergrund: Bild oder Video", "Background: picture or video"), { required: true })),
            heading: { kind: "heading", label: L("Titel (die Überschrift der Seite), kurz", "Title (the page's heading), short"), required: true },
            ...Object.fromEntries(picture("cardMedia", L("Glaskarte: kleines Bild", "Glass card: small picture"))),
            cardText: { kind: "text", label: L("Glaskarte: eine Zeile", "Glass card: one line") },
            button: { kind: "button", label: L("Glaskarte: Button-Text", "Glass card: button label") },
            link: { kind: "link", label: L("Glaskarte: Seite oder URL", "Glass card: a page or URL") },
            label: { kind: "eyebrow", label: L("Kleines Etikett (optional)", "Small label (optional)") },
            text: { kind: "text", label: L("Ein, zwei Sätze daneben (optional)", "A sentence or two beside it (optional)") },
            shade: { kind: "range", label: L("Abdunkelung", "Darkening"), min: 0, max: 85, step: 5, initial: 35, unit: "%" },
        },
        versions: {
            glass: { name: L("Großer Titel unten links, Glaskarte darunter", "A large title low on the left, a glass card below"),
                wire: [["media", 0, 0, 100, 60], ["heading", 5, 30, 60, "light"], ["band", 5, 44, 26, 11], ["line", 44, 46, 30, "light"], ["line", 44, 50, 24, "light"]] },
        },
        magazine: { layout: "C", unit: heroUnit },
        render: renderGlassHero,
    },
    "content.hero-card": {
        category: "content",
        name: L("Hero-Karte", "Hero card"),
        keywords: "hero card karte titel title image video bild parallax glass pill button tether",
        slots: {
            ...Object.fromEntries(picture("media", L("Hintergrund: Bild oder Video", "Background: image or video"), { required: true })),
            label: { kind: "eyebrow", label: L("Kleines Etikett in der Glas-Pille (optional)", "Small label in the glass pill (optional)") },
            heading: { kind: "heading", label: L("Titel", "Title"), required: true },
            button: { kind: "button", label: L("Button-Text", "Button label") },
            link: { kind: "link", label: L("Button-Link: eine Seite oder URL", "Button link: a page or URL") },
            shade: { kind: "range", label: L("Abdunkelung", "Darkening"), min: 0, max: 85, step: 5, initial: 40, unit: "%" },
        },
        versions: {
            card: { name: L("Große Karte mit Bild, Titel in der Mitte", "Large card over a picture, the title centred"),
                wire: [["band", 3, 3, 94, 54], ["button", 42, 18, 16, "light"], ["heading", 22, 25, 56, "light"], ["heading", 30, 31, 40, "light"], ["button", 42, 40, 16, "light"]] },
        },
        initialOpts: () => ({ button: true }),
        act: heroCardAct,
        magazine: { layout: "C" },
        render: renderHeroCard,
    },
    "testimonials.stack": {
        category: "testimonials",
        name: L("Stimmen im Stapel", "Testimonials"),
        keywords: "testimonials stimmen zitate quotes kunden clients stack stapel cards karten harbor",
        slots: {
            heading: { kind: "heading", label: L("Überschrift über den Karten (optional)", "Heading above the cards (optional)") },
            label_left: { kind: "eyebrow", label: L("Links neben den Karten (Standard: Stimmen)", "Left of the cards (default: Testimonials)") },
            label_right: { kind: "eyebrow", label: L("Rechts neben den Karten (Standard: Sie lieben uns)", "Right of the cards (default: They are in love with us)") },
        },
        versions: {
            stack: { name: L("Karten im Stapel, die oberste fliegt beim Scrollen weg", "Stacked cards, the top one flicks away on scroll"),
                wire: [["heading", 35, 5, 30], ["line", 4, 31, 14], ["line", 82, 31, 14]], motion: "stack" },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        act: testimonialsAct,
        missing: (entry, page, get) => (testimonialItems(entry).filter((it) => has(get, page, entry, `q_${it.id}`) && has(get, page, entry, `n_${it.id}`)).length >= TESTIMONIALS_MIN
            ? [] : [L(`mindestens ${TESTIMONIALS_MIN} Zitate mit Namen`, `at least ${TESTIMONIALS_MIN} quotes with a name`)]),
        magazine: {
            layout: "B",
            // both side labels and the heading: the left label above, the heading (or the right label) as the title, the right label under it
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-f-ts__label.is-left"), title: s.querySelector(".kalq-f-heading") || s.querySelector(".kalq-f-ts__label.is-right"),
                lead: s.querySelector(".kalq-f-heading") ? s.querySelector(".kalq-f-ts__label.is-right") : null,
                body: [...s.querySelectorAll(".kalq-f-ts__card")].flatMap((c) => [k.textOf(c.querySelector(".kalq-f-ts__who"), "p", "bk-eyebrow"), ...k.parasOf(c.querySelector(".kalq-f-ts__quote"))]) /* who, then the quote: a page never ends on a name */.filter(Boolean) }),
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
                wire: [], motion: "tether" },
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
                wire: [["heading", 6, 8, 30], ["line", 6, 14, 22]], motion: "slide" },
        },
        initialOpts: () => ({ items: Array.from({ length: 4 }, () => ({ id: newId() })) }),
        itemsEditor: { min: HCARDS_MIN, max: HCARDS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (hcardItems(entry).filter((it) => has(get, page, entry, `t_${it.id}`)).length >= HCARDS_MIN
            ? [] : [L(`mindestens ${HCARDS_MIN} Karten mit Titel`, `at least ${HCARDS_MIN} cards with a title`)]),
        magazine: { layout: "E", unit: (s, k) => cardsUnit(s, k, ".kalq-f-hs__card") },
        render: renderHorizontal,
    },
    "content.faq": {
        category: "content",
        name: L("Fragen und Antworten", "Questions and answers"),
        keywords: "faq fragen antworten questions answers accordion akkordeon tether help hilfe",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            button: { kind: "button", label: L("Button: Text (optional)", "Button: label (optional)") },
            link: { kind: "link", label: L("Button: Seite oder URL", "Button: a page or URL") },
        },
        versions: {
            split: { name: L("Überschrift links, Fragen rechts", "The heading on the left, the questions on the right"),
                wire: [["heading", 5, 10, 26], ["button", 5, 18, 10], ["band", 40, 8, 55, 14], ["line", 42, 12, 40, "light"], ["line", 42, 15, 48, "light"], ["rule", 40, 27, 55], ["line", 42, 30, 40], ["rule", 40, 35, 55], ["line", 42, 38, 36], ["rule", 40, 43, 55]] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: FAQ_MIN, max: FAQ_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (faqItems(entry).some((it) => has(get, page, entry, `q_${it.id}`) && has(get, page, entry, `a_${it.id}`)) ? [] : [L("mindestens eine Frage mit Antwort", "at least one question with its answer")]),
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: s.querySelector(".kalq-f-heading"), body: [...s.querySelectorAll(".kalq-f-faq__item")].flatMap((d) => [k.textOf(d.querySelector(".kalq-f-faq__q"), "h3", "bk-subtitle"), ...k.parasOf(d.querySelector(".kalq-f-faq__a"))]).filter(Boolean) }) },
        render: renderFaq,
    },
    "content.logos": {
        category: "content",
        name: L("Logo-Band", "Logo belt"),
        keywords: "logos logo belt band marquee laufband partner kunden clients brands marken svg trusted",
        slots: { heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") } },
        versions: {
            row: { name: L("Logos in einer Reihe", "The logos in a row"),
                wire: [["heading", 30, 16, 40], ...[8, 25, 42, 59, 76].map((x) => ["band", x, 30, 13, 6])] },
            belt: { name: L("Logos als langsames Laufband, mit Pause", "The logos as a slow moving belt, with a pause"),
                wire: [["heading", 30, 16, 40], ...[-6, 11, 28, 45, 62, 79, 96].map((x) => ["band", x, 30, 13, 6])], motion: "slide" },
        },
        initialOpts: () => ({ items: Array.from({ length: 5 }, () => ({ id: newId() })) }),
        itemsEditor: { min: LOGOS_MIN, max: LOGOS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (logoItems(entry).filter((it) => has(get, page, entry, `k_${it.id}`) && has(get, page, entry, `n_${it.id}`)).length >= LOGOS_MIN ? [] : [L(`mindestens ${LOGOS_MIN} Logos mit Namen`, `at least ${LOGOS_MIN} logos with their names`)]),
        magazine: { layout: "B", unit: (s) => ({ layout: "B", title: s.querySelector(".kalq-f-logos__heading"), body: [] }) },
        render: renderLogos,
    },
    "content.projects": {
        category: "content",
        name: L("Projektliste", "Project list"),
        keywords: "projects projekte work arbeiten list liste rows zeilen arrow pfeil signal featured links",
        slots: { label: { kind: "eyebrow", label: L("Kleines Etikett (optional)", "Small label (optional)") } },
        versions: {
            list: { name: L("Große Titel in Zeilen, je ein Pfeil", "Large titles in rows, each with an arrow"),
                wire: [["eyebrow", 5, 8, 14], ["rule", 5, 12, 90], ["heading", 5, 16, 34], ["line", 91, 17, 3], ["rule", 5, 24, 90], ["heading", 5, 28, 28], ["line", 91, 29, 3], ["rule", 5, 36, 90], ["heading", 5, 40, 22], ["line", 91, 41, 3], ["rule", 5, 48, 90]] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: PROJECTS_MIN, max: PROJECTS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (projectItems(entry).some((it) => has(get, page, entry, `t_${it.id}`)) ? [] : [L("mindestens eine Zeile mit Titel", "at least one row with a title")]),
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: s.querySelector(".kalq-f-pl__label"), body: [...s.querySelectorAll(".kalq-f-pl__title")].map((t) => k.textOf(t, "h3", "bk-subtitle")).filter(Boolean) }) },
        render: renderProjects,
    },
    "testimonials.paging": {
        category: "testimonials",
        name: L("Zitate zum Blättern", "Quotes to page through"),
        keywords: "testimonials stimmen zitate quotes slider blättern arrows pfeile signal one at a time",
        slots: {},
        versions: {
            slider: { name: L("Ein Zitat in der Mitte, Pfeile und Zähler", "One quote centred, arrows and a counter"),
                wire: [["media", 46, 8, 8, 8], ["line", 22, 22, 56, "bold"], ["line", 26, 26, 48, "bold"], ["line", 30, 30, 40, "bold"], ["line", 42, 37, 16], ["plus", 8, 24], ["plus", 89, 24], ["line", 46, 44, 8]] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: SLIDES_MIN, max: SLIDES_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (slideItems(entry).some((it) => has(get, page, entry, `q_${it.id}`) && has(get, page, entry, `n_${it.id}`)) ? [] : [L("mindestens ein Zitat mit Namen", "at least one quote with a name")]),
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: null, body: [...s.querySelectorAll(".kalq-f-sl__slide")].flatMap((li) => [...k.parasOf(li.querySelector(".kalq-f-sl__quote")), k.textOf(li.querySelector(".kalq-f-sl__name"), "p", "bk-small")]).filter(Boolean) }) },
        render: renderSlider,
    },
    "content.results": {
        category: "content",
        name: L("Ergebnis-Raster", "Results grid"),
        keywords: "results ergebnisse bento grid raster tiles kacheln figures zahlen pictures bilder tether",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            intro: { kind: "text", label: L("Eine Zeile darunter (optional)", "A line below (optional)") },
            ...Object.fromEntries(picture("media", L("Hohes Bild links", "Tall picture on the left"))),
            title: { kind: "heading", label: L("Kachel mit Worten: Titel", "Tile of words: title") },
            text: { kind: "text", label: L("Kachel mit Worten: Text", "Tile of words: text") },
            value1: { kind: "heading", label: L("Zahl 1", "Figure 1") }, line1: { kind: "text", label: L("Zahl 1: eine Zeile", "Figure 1: one line") },
            ...Object.fromEntries(picture("media2", L("Bild auf der Akzentfarbe", "Picture on the accent colour"))),
            value2: { kind: "heading", label: L("Zahl 2", "Figure 2") }, line2: { kind: "text", label: L("Zahl 2: eine Zeile", "Figure 2: one line") },
        },
        versions: {
            grid: { name: L("Überschrift, darunter fünf Kacheln", "A heading, five tiles below"),
                wire: [["heading", 30, 6, 40], ["line", 34, 12, 32], ["media", 4, 18, 44, 38], ["band", 50, 18, 22, 18], ["line", 76, 22, 16], ["heading", 76, 30, 10], ["media", 50, 38, 22, 18], ["heading", 76, 44, 10], ["line", 76, 50, 16]] },
        },
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: s.querySelector(".kalq-f-heading"), body: [...s.querySelectorAll(".kalq-f-rs__title, .kalq-f-rs__text, .kalq-f-rs__value, .kalq-f-rs__line")].map((x) => k.textOf(x, "p", "bk-body")).filter(Boolean) }) },
        render: renderResults,
    },
    "testimonials.video": {
        category: "testimonials",
        name: L("Personenkarten mit Video", "Person cards with video"),
        keywords: "testimonials stimmen video cards karten people personen swipe wischen quote zitat play tether",
        slots: { heading: { kind: "heading", label: L("Überschrift", "Heading") } },
        versions: {
            row: { name: L("Personen und Zitate in einer Reihe zum Wischen", "People and quotes in a row to swipe"),
                wire: [["heading", 26, 6, 48], ["media", 0, 20, 20, 32], ["band", 22, 20, 26, 32], ["line", 24, 24, 20, "light"], ["media", 50, 20, 20, 32, "play"], ["band", 72, 20, 26, 32]], motion: "slide" },
        },
        initialOpts: () => ({ items: Array.from({ length: 4 }, () => ({ id: newId() })) }),
        itemsEditor: { min: VCARDS_MIN, max: VCARDS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (vcardItems(entry).some((it) => has(get, page, entry, `n_${it.id}`) && (has(get, page, entry, `q_${it.id}`) || has(get, page, entry, `p_${it.id}`))) ? [] : [L("mindestens eine Karte mit Namen und Zitat oder Foto", "at least one card with a name and a quote or a photo")]),
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: s.querySelector(".kalq-f-heading"), body: [...s.querySelectorAll(".kalq-f-vc__card.is-quote")].flatMap((c) => [...k.parasOf(c.querySelector(".kalq-f-vc__quote")), k.textOf(c.querySelector(".kalq-f-vc__name"), "p", "bk-small")]).filter(Boolean) }) },
        render: renderVideoCards,
    },
    "scroll.services": {
        category: "scroll",
        name: L("Nummerierte Leistungen", "Numbered services"),
        keywords: "services leistungen numbered nummeriert 01 02 03 cards karten colour farbe harbor sideways seitwärts",
        slots: { heading: { kind: "heading", label: L("Überschrift", "Heading") } },
        versions: {
            numbered: { name: L("Große farbige Karten 01, 02, 03, seitwärts", "Large coloured cards 01, 02, 03, sideways"),
                wire: [["heading", 5, 6, 30], ["band", 4, 14, 60, 42], ["heading", 7, 18, 10, "light"], ["line", 7, 44, 24, "light"], ["media", 40, 17, 20, 36], ["band", 67, 14, 33, 42]], motion: "slide" },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: SERVICES_MIN, max: SERVICES_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (serviceItems(entry).some((it) => has(get, page, entry, `t_${it.id}`)) ? [] : [L("mindestens eine Leistung mit Titel", "at least one service with a title")]),
        magazine: { layout: "E", unit: (s, k) => ({ layout: "E", cards: [...s.querySelectorAll(".kalq-f-sv__card")].map((c) => ({ media: k.mediaUrl(c.querySelector(".kalq-m-media")), title: c.querySelector(".kalq-f-sv__title"), body: k.parasOf(c.querySelector(".kalq-f-sv__text")) })).filter((c) => c.title) }) },
        render: renderServices,
    },
    "content.pricing": {
        category: "content",
        name: L("Preise", "Pricing"),
        keywords: "pricing preise plans pakete tarife price preis recommended empfohlen includes enthalten harbor",
        slots: {
            label: { kind: "eyebrow", label: L("Kleines Etikett (optional)", "Small label (optional)") },
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
        },
        versions: {
            plans: { name: L("Pakete nebeneinander, Preis und Enthaltenes", "Plans side by side, price and what is included"),
                wire: [["eyebrow", 45, 6, 10], ["heading", 22, 10, 56], ...[4, 36, 68].flatMap((x) => [["rule", x, 20, 28], ["line", x + 2, 23, 12, "bold"], ["line", x + 2, 27, 22], ["heading", x + 2, 33, 10], ["button", x + 2, 39, 22], ["line", x + 2, 46, 18], ["line", x + 2, 49, 16]])] },
        },
        initialOpts: () => ({ items: Array.from({ length: 3 }, () => ({ id: newId() })) }),
        itemsEditor: { min: PLANS_MIN, max: PLANS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (planItems(entry).some((it) => has(get, page, entry, `n_${it.id}`)) ? [] : [L("mindestens ein Paket mit Namen", "at least one plan with a name")]),
        magazine: { layout: "E", unit: (s, k) => ({ layout: "E", cards: [...s.querySelectorAll(".kalq-f-pr__plan")].map((c) => ({ title: c.querySelector(".kalq-f-pr__name"), body: [k.textOf(c.querySelector(".kalq-f-pr__price"), "p", "bk-body"), ...k.parasOf(c.querySelector(".kalq-f-pr__desc"))].filter(Boolean) })).filter((c) => c.title) }) },
        render: renderPricing,
    },
    "content.lit": {
        category: "content",
        name: L("Aussage, die aufleuchtet", "Statement that lights up"),
        keywords: "statement aussage lit leuchten scroll words wörter harbor background hintergrund stats zahlen figures",
        slots: {
            statement: { kind: "heading", label: L("Die Aussage", "The statement"), required: true },
            ...Object.fromEntries(picture("media", L("Bild dahinter (optional)", "Picture behind it (optional)"))),
            ...Object.fromEntries(STAT_KEYS.flatMap((k) => [[`label${k}`, { kind: "eyebrow", label: L(`Zahl ${k}: Etikett`, `Figure ${k}: label`) }], [`value${k}`, { kind: "heading", label: L(`Zahl ${k}`, `Figure ${k}`) }], [`text${k}`, { kind: "text", label: L(`Zahl ${k}: eine Zeile`, `Figure ${k}: one line`) }]])),
            shade: { kind: "range", label: L("Abdunkelung des Bildes", "Darkening of the picture"), min: 0, max: 85, step: 5, initial: 30, unit: "%" },
        },
        versions: {
            lit: { name: L("Große Aussage, Wort für Wort beim Scrollen", "A large statement, lit word by word as you scroll"),
                wire: [["media", 0, 0, 100, 60], ["heading", 5, 12, 86, "light"], ["heading", 5, 19, 70, "light"], ["line", 5, 46, 18, "light"], ["line", 38, 46, 18, "light"], ["line", 71, 46, 18, "light"]] },
        },
        magazine: { layout: "B", unit: (s, k) => ({ layout: "B", title: s.querySelector(".kalq-f-lit__words"), body: [...s.querySelectorAll(".kalq-f-lit__stat")].map((x) => k.textOf(x, "p", "bk-body")).filter(Boolean) }) },
        render: renderLitStatement,
    },
    "content.sentence": {
        category: "content",
        name: L("Satz mit Bildern", "Sentence with pictures"),
        keywords: "sentence satz bilder pictures inline signal big capitals großbuchstaben lit leuchten scroll",
        slots: {
            part1: { kind: "heading", label: L("Satz: erster Teil", "Sentence: first part"), required: true },
            ...Object.fromEntries(picture("pic1", L("Erstes kleines Bild", "First small picture"))),
            part2: { kind: "heading", label: L("Satz: zweiter Teil", "Sentence: second part") },
            ...Object.fromEntries(picture("pic2", L("Zweites kleines Bild", "Second small picture"))),
            part3: { kind: "heading", label: L("Satz: dritter Teil", "Sentence: third part") },
        },
        versions: {
            sentence: { name: L("Großer Satz, kleine Bilder zwischen den Wörtern", "A large sentence, small pictures between its words"),
                wire: [["heading", 12, 14, 20], ["media", 35, 12, 14, 7], ["heading", 52, 14, 36], ["heading", 14, 24, 72], ["heading", 12, 34, 30], ["media", 45, 32, 14, 7], ["heading", 62, 34, 26]] },
        },
        magazine: { layout: "B", unit: (s) => ({ layout: "B", title: s.querySelector(".kalq-f-sentence__words"), body: [] }) },
        render: renderPictureSentence,
    },
    "content.pill-video": {
        category: "content",
        name: L("Video mit Abspiel-Pille", "Video with a play pill"),
        keywords: "video play abspielen pill pille glass glas signal tether film large groß rounded",
        slots: {
            media: { kind: "media", label: L("Das Video", "The video"), required: true },
            poster: { kind: "media", label: L("Standbild davor (optional)", "Still picture before it (optional)") },
            caption: { kind: "text", label: L("Bildunterschrift (optional)", "Caption (optional)") },
        },
        versions: {
            pill: { name: L("Großes Video, Glas-Pille „Video abspielen“", "A large video, a glass pill \u201cPlay video\u201d"),
                wire: [["media", 4, 6, 92, 48, "play"], ["button", 7, 9, 14, "light"]] },
        },
        magazine: { layout: "C" },
        render: renderPillVideo,
    },
    "scroll.swipe": {
        category: "scroll",
        name: L("Karten zum Wischen", "Cards to swipe"),
        keywords: "cards karten swipe wischen drag ziehen scroll sideways seitwärts tags stichworte pills signal services",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            button: { kind: "button", label: L("Link rechts: Text (optional)", "Link on the right: label (optional)") },
            link: { kind: "link", label: L("Link rechts: Seite oder URL", "Link on the right: a page or URL") },
        },
        versions: {
            swipe: { name: L("Hohe Bildkarten, seitwärts wischen", "Tall picture cards, swiped sideways"),
                wire: [["heading", 5, 8, 40], ["heading", 5, 14, 30], ["line", 80, 16, 14], ["media", 0, 22, 22, 34], ["media", 24, 22, 22, 34], ["media", 48, 22, 22, 34], ["media", 72, 22, 22, 34]], motion: "slide" },
        },
        initialOpts: () => ({ items: Array.from({ length: 4 }, () => ({ id: newId() })) }),
        itemsEditor: { min: SWIPE_MIN, max: SWIPE_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => (swipeItems(entry).filter((it) => has(get, page, entry, `t_${it.id}`)).length >= SWIPE_MIN
            ? [] : [L(`mindestens ${SWIPE_MIN} Karten mit Titel`, `at least ${SWIPE_MIN} cards with a title`)]),
        magazine: { layout: "E", unit: (s, k) => ({ layout: "E", cards: [...s.querySelectorAll(".kalq-f-sw__card")].map((c) => ({ media: k.mediaUrl(c.querySelector(".kalq-m-media")), title: c.querySelector(".kalq-f-sw__title"), body: [] })).filter((c) => c.title) }) },
        render: renderSwipeCards,
    },
};
