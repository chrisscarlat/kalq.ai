// Module picker (editors, edit mode): opened by a plus button between sections. Left the categories ("All" first) and
// a search; on top schematic cards of every version, the selected card with its Insert button; below, on a dark grey
// stage, the selected version on all eight devices in one row at their real sizes relative to each other.
// Keyboard: arrows browse the cards, Enter inserts, Esc closes, Tab moves between the areas.
import { EDITOR_LANG } from "./i18n.js";
import { CATEGORIES, MODULES, renderModule } from "./modules/registry.js";
import { chatPanel, cookiePanel } from "./siteSettings.js";

const TEXT = {
    de: { title: "Modul einfügen", search: "Module suchen", insert: "Einfügen", cancel: "Abbrechen", close: "Schließen",
        none: "Keine Module gefunden.", results: "Suchergebnisse", hint: "Pfeiltasten zum Blättern, Enter fügt ein, Esc schließt.",
        all: "Alle", devices: "So passt es sich an", site: "Für die ganze Website",
        chat: "Chat", dontpanic: "Cookie-Leiste", style: "Stil der Seite", navigation: "Navigation", footers: "Footer",
        styleHint: "Öffnet die Stile", noteOnly: "Wird im Stil gewählt; Stile bearbeiten nur Admins." },
    en: { title: "Insert a module", search: "Search modules", insert: "Insert", cancel: "Cancel", close: "Close",
        none: "No modules found.", results: "Search results", hint: "Arrow keys to browse, Enter inserts, Esc closes.",
        all: "All", devices: "How it adapts", site: "For the whole site",
        chat: "Chat", dontpanic: "Cookie bar", style: "Page style", navigation: "Navigation", footers: "Footers",
        styleHint: "Opens Styles", noteOnly: "Chosen in the style; only admins edit styles." },
};
const lang = () => EDITOR_LANG;
const t = (key) => TEXT[lang()][key];

// The preview devices: three groups, in this order. Each renders the device's CSS viewport (w × h) inside a frame drawn
// from the real product: body, bezel, the screen's corner radius, the camera cut-out, and for the laptop and the
// display their base and stand. Measurements in CSS px (points) of the screen, from the makers' dimensions: phones
// at a device pixel ratio of 3; iPhone 18 Pro / Pro Max and the iPhone Duo are derived from Apple's published
// device pixels ÷ 3 (marked "derived").
// Two screens: a preset only says where its viewport segments are (segments: side by side or stacked, and the gap).
// The frame sets the same variables a real two-screen browser reports (--seg-l, --seg-r, --seg-hinge, --seg-h, or the
// stacked --seg-t, --seg-b), and the page's CSS reads only those, never a brand: a Surface Duo, a Samsung or a
// Huawei foldable lays out the same way as the iPhone Duo here.
export const DEVICE_GROUPS = [
    { id: "phones", de: "Telefone", en: "Phones", devices: [
        { id: "iphone-13-mini", w: 375, h: 812, dpr: 3, body: [418, 856], radius: 44, island: "notch", de: "iPhone 13 mini", en: "iPhone 13 mini" },
        { id: "iphone-18-pro", w: 402, h: 874, dpr: 3, body: [434, 906], radius: 62, island: "pill", derived: true, de: "iPhone 18 Pro", en: "iPhone 18 Pro" },
        { id: "iphone-18-pro-max", w: 440, h: 956, dpr: 3, body: [471, 987], radius: 62, island: "pill", derived: true, de: "iPhone 18 Pro Max", en: "iPhone 18 Pro Max" },
    ] },
    { id: "fold", de: "Faltbar", en: "Fold", devices: [
        { id: "iphone-duo-folded", w: 466, h: 678, dpr: 3, body: [494, 706], radius: 46, island: "pill", derived: true, de: "iPhone Duo, zugeklappt", en: "iPhone Duo folded" },
        { id: "iphone-duo-vertical", w: 626, h: 890, dpr: 3, body: [650, 914], radius: 40, segments: "side", gap: 0, derived: true, de: "iPhone Duo, senkrecht", en: "iPhone Duo vertical" },
        { id: "iphone-duo-horizontal", w: 890, h: 626, dpr: 3, body: [914, 650], radius: 40, segments: "stacked", gap: 0, derived: true, de: "iPhone Duo, waagerecht", en: "iPhone Duo horizontal" },
    ] },
    { id: "desktop", de: "Desktop", en: "Desktop", devices: [
        { id: "macbook-pro-14", w: 1512, h: 982, dpr: 2, kind: "laptop", bezel: [24, 30, 24, 24], radius: 12, de: "MacBook Pro 14″", en: "MacBook Pro 14″" },
        { id: "studio-display-27", w: 2560, h: 1440, dpr: 2, kind: "display", bezel: [52, 52, 52, 52], radius: 0, de: "Studio Display 27″", en: "Studio Display 27″" },
    ] },
];
const DEVICES = DEVICE_GROUPS.flatMap((g) => g.devices);

// Every version of every module the picker offers (retired modules still render where a page has one); the "All"
// category lists them in one view
const ALL_CATEGORY = { id: "all", de: TEXT.de.all, en: TEXT.en.all };
const ALL = Object.entries(MODULES).filter(([, def]) => !def.retired).flatMap(([module, def]) => Object.entries(def.versions).map(([version, v]) => ({ module, version, def, v })));

// The bottom of the left menu: what is set for the whole site, each with its icon. Chat is the floating inquiry
// chat's settings (on or off, the name it greets with, where it sends); Cookie bar is its settings; Style, Navigation and Footers open the Styles panel at
// their tab (admins; for other editors Navigation and Footers say where they are set).
const ICON = (d) => `<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SITE_ITEMS = [
    { id: "chat", icon: ICON("M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14H9l-4 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z") },
    { id: "dontpanic", icon: ICON("M10 2.8a7.2 7.2 0 1 0 7.2 7.6 2.6 2.6 0 0 1-3.2-2.6 2.6 2.6 0 0 1-3.4-3.3A2.4 2.4 0 0 1 10 2.8ZM7 8.2v.1M6.8 12.4v.1M10.5 12.8v.1M13.4 12.2v.1") },
    { id: "style", admin: true, tab: "look", icon: ICON("M10 2.8a7.2 7.2 0 1 0 0 14.4c1 0 1.5-.7 1.5-1.5 0-1.1-.9-1.4-.9-2.3 0-.8.7-1.4 1.5-1.4h1.8a3.3 3.3 0 0 0 3.3-3.3C17.2 5.4 14 2.8 10 2.8ZM6.4 9.2v.1M8.8 6.2v.1M12.6 6.4v.1") },
    { id: "navigation", tab: "menu", note: true, icon: ICON("M3.5 5.5h13M3.5 10h13M3.5 14.5h8") },
    { id: "footers", tab: "navigation", note: true, icon: ICON("M3 3.5h14v13H3zM3 12.5h14M6 14.5h4") },
];
const SITE_IDS = new Set(SITE_ITEMS.map((x) => x.id));

//=================================== Wireframes ===================================//
// Images and videos as blue rectangles, text as thin blue lines, headings thicker, buttons as small pills
const BLUE = "#3B82F6";
// A scroll module's card shows its motion in a loop (collab.scss .kalq-wf-*, still under reduced motion)
const MOTION = {
    // three cards on a pile, the top one flicks away
    stack: () => [3, 2, 1].map((k) => `<g class="kalq-wf-card is-${k}"><rect x="${32 - k * 1.5}" y="${14 + k * 3}" width="${36 + k * 3}" height="30" rx="2.5" fill="${BLUE}" fill-opacity="${0.35 + 0.2 * (3 - k)}"/><rect x="${36}" y="${20 + k * 3}" width="22" height="1.6" rx=".8" fill="#fff"/><rect x="${36}" y="${24 + k * 3}" width="18" height="1.2" rx=".6" fill="#fff" fill-opacity=".8"/></g>`).join(""),
    // cards slide up one over the other, each a little lower
    tether: () => [0, 1, 2].map((k) => `<g class="kalq-wf-band is-${k}"><rect x="6" y="${8 + k * 4}" width="88" height="46" rx="3" fill="${BLUE}" fill-opacity="${0.45 + k * 0.2}"/><rect x="10" y="${15 + k * 4}" width="26" height="2" rx="1" fill="#fff"/><rect x="58" y="${13 + k * 4}" width="30" height="20" rx="1.5" fill="#fff" fill-opacity=".35"/></g>`).join(""),
    // a row of cards slides sideways
    slide: () => `<g class="kalq-wf-row">${[6, 34, 62, 90, 118, 146].map((x) => `<rect x="${x}" y="22" width="24" height="22" rx="1.5" fill="${BLUE}" fill-opacity=".25"/><rect x="${x}" y="47" width="14" height="2" rx="1" fill="${BLUE}"/><rect x="${x}" y="51" width="20" height="1.2" rx=".6" fill="${BLUE}" fill-opacity=".55"/>`).join("")}</g>`,
};
function wireframe(wire, { large = false, motion = null } = {}) {
    const parts = wire.map(([kind, x, y, w, h, opt]) => {
        const light = [h, opt].includes("light");
        const fill = light ? "#fff" : BLUE;
        switch (kind) {
            case "media": return imageGlyph(x, y, w, h)
                + (opt === "play" ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="4" fill="${BLUE}"/><path d="M${x + w / 2 - 1.2} ${y + h / 2 - 2}l3.2 2-3.2 2z" fill="#fff"/>` : "");
            case "band": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BLUE}"/>`;
            case "heading": return `<rect x="${x}" y="${y}" width="${w}" height="3.2" rx="1" fill="${fill}"/>`;
            case "eyebrow": return `<rect x="${x}" y="${y}" width="${w}" height="1.4" rx=".7" fill="${fill}" fill-opacity=".7"/>`;
            case "line": return `<rect x="${x}" y="${y}" width="${w}" height="${opt === "bold" || h === "bold" ? 2 : 1.2}" rx=".6" fill="${fill}" fill-opacity="${opt === "bold" || h === "bold" ? 1 : 0.55}"/>`;
            case "button": return `<rect x="${x}" y="${y}" width="${w}" height="4.4" rx="2.2" fill="${fill}"/>`;
            case "plus": return `<path d="M${x} ${y + 1}h2.4M${x + 1.2} ${y - 0.2}v2.4" stroke="${BLUE}" stroke-width=".6"/>`;
            case "rule": return `<rect x="${x}" y="${y}" width="${w}" height=".3" fill="${BLUE}" fill-opacity=".35"/>`;
            default: return "";
        }
    }).join("");
    const moving = motion && MOTION[motion] ? MOTION[motion]() : "";
    return `<svg viewBox="0 0 100 60" ${large ? "" : 'preserveAspectRatio="xMidYMid meet"'} aria-hidden="true" focusable="false"><rect width="100" height="60" fill="#fff"/>${parts}${moving}</svg>`;
}

// The one image placeholder, the same motif everywhere an image can go (js/modules/kit.js PLACEHOLDER_ART): here in the
// wireframes' blue, a pale block with a delicate mountain under a larger sun
function imageGlyph(x, y, w, h) {
    const s = Math.min(w, h * 1.6); // the motif keeps its shape in wide and tall boxes
    const cx = x + w / 2, cy = y + h / 2, u = s / 160; // the drawing's own units (viewBox 160 × 100), centred
    const pt = (px, py) => `${cx + (px - 80) * u} ${cy + (py - 57) * u}`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="${BLUE}" fill-opacity=".12"/>`
        + `<circle cx="${cx + 24 * u}" cy="${cy - 21 * u}" r="${17 * u}" fill="${BLUE}" fill-opacity=".22"/>`
        + `<path d="M${pt(30, 78)}L${pt(62, 46)}L${pt(76, 60)}L${pt(88, 50)}L${pt(120, 78)}" fill="none" stroke="${BLUE}" stroke-opacity=".7" stroke-width=".5" stroke-linejoin="round"/>`;
}

//=================================== Dialog ===================================//
let root = null, state = null;

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};

function build() {
    root = el("div", { className: "kalq-picker" });
    root.innerHTML = `
        <div class="kalq-picker__backdrop" data-close></div>
        <div class="kalq-picker__window" role="dialog" aria-modal="true" aria-labelledby="kalq-picker-title">
            <div class="kalq-picker__side">
                <h2 id="kalq-picker-title" class="kalq-picker__title"></h2>
                <input class="kalq-picker__search" type="search" autocomplete="off">
                <nav class="kalq-picker__cats"></nav>
                <nav class="kalq-picker__site"></nav>
            </div>
            <div class="kalq-picker__main">
                <div class="kalq-picker__browse">
                    <div class="kalq-picker__headrow"><h3 class="kalq-picker__heading"></h3><p class="kalq-picker__hint"></p></div>
                    <div class="kalq-picker__grid" role="listbox"></div>
                </div>
                <section class="kalq-picker__detail" aria-live="polite"></section>
            </div>
            <button type="button" class="kalq-picker__close" data-close></button>
        </div>`;
    document.body.append(root);
    root.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    root.addEventListener("keydown", onKey);
    root.querySelector(".kalq-picker__search").addEventListener("input", (e) => { state.query = e.target.value.trim(); state.index = 0; draw(); });
}

function items() {
    const q = state.query.toLowerCase();
    if (q) return ALL.filter(({ def, v }) => `${def.name.de} ${def.name.en} ${v.name.de} ${v.name.en} ${def.keywords}`.toLowerCase().includes(q));
    if (state.category === ALL_CATEGORY.id) return ALL;
    return ALL.filter(({ def }) => def.category === state.category);
}

function draw() {
    const L = lang();
    root.querySelector(".kalq-picker__title").textContent = t("title");
    const search = root.querySelector(".kalq-picker__search");
    search.placeholder = t("search");
    search.setAttribute("aria-label", t("search"));
    const closeBtn = root.querySelector(".kalq-picker__close");
    closeBtn.setAttribute("aria-label", t("close"));
    closeBtn.textContent = "×";
    root.querySelector(".kalq-picker__hint").textContent = t("hint");

    // Categories with how many versions each has
    const cats = root.querySelector(".kalq-picker__cats");
    cats.setAttribute("aria-label", t("title"));
    // a category with nothing to insert and no note of its own (Navigation and Footers explain where they are set) is not shown
    cats.replaceChildren(...[ALL_CATEGORY, ...CATEGORIES.filter((c) => !SITE_IDS.has(c.id) && (c.note || ALL.some((x) => x.def.category === c.id)))].map((c) => {
        const count = c === ALL_CATEGORY ? ALL.length : ALL.filter((x) => x.def.category === c.id).length;
        const b = el("button", { type: "button", className: "kalq-picker__cat" }, el("span", { textContent: c[L] }), el("span", { className: "kalq-picker__count", textContent: count || "–" }));
        b.setAttribute("aria-pressed", !state.query && state.category === c.id);
        b.addEventListener("click", () => { state.category = c.id; state.query = ""; state.index = 0; search.value = ""; draw(); focusGrid(); });
        return b;
    }));

    // the bottom group: for the whole site
    const admin = !!state.collab?.me?.is_admin;
    const site = root.querySelector(".kalq-picker__site");
    site.setAttribute("aria-label", t("site"));
    site.replaceChildren(el("p", { className: "kalq-picker__site-label", textContent: t("site") }), ...SITE_ITEMS.filter((x) => !x.admin || admin).map((x) => {
        const opens = x.tab && admin; // opens the Styles panel
        const b = el("button", { type: "button", className: `kalq-picker__cat is-site${opens ? " is-link" : ""}` }, el("span", { className: "kalq-picker__icon", innerHTML: x.icon }), el("span", { textContent: t(x.id) }));
        if (opens) { b.title = t("styleHint"); b.append(el("span", { className: "kalq-picker__count", textContent: "↗" })); }
        else b.setAttribute("aria-pressed", !state.query && state.category === x.id);
        b.addEventListener("click", () => {
            if (opens) { close(); document.dispatchEvent(new CustomEvent("kalq:open-styles", { detail: { tab: x.tab } })); return; }
            state.category = x.id; state.query = ""; state.index = 0; search.value = ""; draw(); focusGrid();
        });
        return b;
    }));

    const browse = root.querySelector(".kalq-picker__browse");
    browse.querySelector(".kalq-picker__settings")?.remove();
    const siteItem = !state.query && SITE_ITEMS.find((x) => x.id === state.category);
    const settingsOnly = !!siteItem && ["dontpanic", "chat"].includes(state.category); // the cookie bar, the chat: settings, no cards
    root.classList.toggle("is-settings", settingsOnly);
    if (settingsOnly) {
        root.querySelector(".kalq-picker__heading").textContent = t(state.category);
        root.querySelector(".kalq-picker__grid").replaceChildren();
        const panel = !state.collab ? null : state.category === "chat" ? chatPanel(state.collab) : cookiePanel(state.collab, { onPreview: close });
        browse.append(el("div", { className: "kalq-picker__settings" }, panel));
        detail(null);
        return;
    }
    const list = items();
    const category = state.category === ALL_CATEGORY.id ? ALL_CATEGORY : CATEGORIES.find((c) => c.id === state.category)
        || { id: state.category, de: t(state.category), en: t(state.category), note: siteItem?.note ? { de: t("noteOnly"), en: t("noteOnly") } : null };
    root.querySelector(".kalq-picker__heading").textContent = state.query ? t("results") : category[L];
    const grid = root.querySelector(".kalq-picker__grid");
    grid.setAttribute("aria-label", state.query ? t("results") : category[L]);
    state.index = Math.min(state.index, Math.max(0, list.length - 1));
    if (!list.length) {
        grid.replaceChildren(el("p", { className: "kalq-picker__empty", textContent: state.query ? t("none") : category.note?.[L] || t("none") }));
    } else {
        grid.replaceChildren(...list.map((item, i) => {
            const option = el("div", { className: "kalq-picker__item", id: `kalq-pick-${i}` });
            option.setAttribute("role", "option");
            option.setAttribute("aria-selected", i === state.index);
            option.tabIndex = i === state.index ? 0 : -1;
            option.innerHTML = wireframe(item.v.wire, { motion: item.v.motion });
            option.append(el("span", { className: "kalq-picker__name", textContent: item.v.name[L] }), el("span", { className: "kalq-picker__module", textContent: item.def.name[L] }));
            if (i === state.index) { // the selected card carries its Insert (out of the tab order: Enter inserts it)
                const go = el("button", { type: "button", className: "kalq-picker__insert", tabIndex: -1, title: t("insert"),
                    innerHTML: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M10 3.5v11M5 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
                go.setAttribute("aria-label", `${t("insert")}: ${item.v.name[L]}`);
                go.addEventListener("click", (e) => { e.stopPropagation(); insert(item); });
                option.append(go);
            }
            option.addEventListener("click", () => { if (state.index === i) return; state.index = i; draw(); focusGrid(); });
            option.addEventListener("dblclick", () => insert(item));
            return option;
        }));
        grid.setAttribute("aria-activedescendant", `kalq-pick-${state.index}`);
        grid.style.setProperty("--cols", String(Math.min(5, Math.max(1, Math.ceil(list.length / 2))))); // the cards in two rows
    }
    detail(list[state.index]);
}

// The module itself, rendered with empty placeholders (drawn as blue shapes), on one device's screen (its CSS
// viewport)
function deviceScreen(item, d) {
    const L = lang();
    const screen = el("div", { className: `kalq-device${d.segments === "side" ? " is-span-h" : d.segments === "stacked" ? " is-span-v" : ""}` });
    screen.style.width = `${d.w}px`;
    screen.style.height = `${d.h}px`;
    if (d.segments === "side") { // two screens side by side: the variables css/utilities/_dual.scss reads from a real device
        const one = (d.w - d.gap) / 2;
        Object.entries({ "--seg-l": one, "--seg-r": one, "--seg-hinge": d.gap, "--seg-h": d.h }).forEach(([k, v]) => screen.style.setProperty(k, `${v}px`));
    } else if (d.segments === "stacked") { // two screens stacked: a top and a bottom segment, the gap between them
        const one = (d.h - d.gap) / 2;
        Object.entries({ "--seg-t": one, "--seg-b": one, "--seg-hinge": d.gap, "--seg-w": d.w }).forEach(([k, v]) => screen.style.setProperty(k, `${v}px`));
    }
    screen.setAttribute("aria-hidden", "true");
    screen.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, true); // a picture, nothing to click
    const node = renderModule({ id: "preview", module: item.module, version: item.version, state: "draft" },
        { doc: document, page: "preview", store: new Map(), lang: L, editor: true });
    if (node) {
        // A picture of the module, not a section: nothing in it may look like page content to the rest of the code
        [node, ...node.querySelectorAll("[data-kalq-key], [data-kalq-type], [data-module], [id]")].forEach((n) =>
            ["data-kalq-key", "data-kalq-type", "data-module", "id"].forEach((a) => n.removeAttribute(a)));
        screen.append(node);
    }
    return screen;
}

// The device as drawn: its outer size in screen points, and where the screen sits in it
function deviceGeometry(d) {
    if (d.kind === "laptop" || d.kind === "display") {
        const [top, right, bottom, left] = d.bezel;
        const lid = { w: d.w + left + right, h: d.h + top + bottom };
        const base = d.kind === "laptop" ? { w: Math.round(lid.w * 1.1), h: Math.round(lid.w * 0.03) } : { w: Math.round(lid.w * 0.42), h: Math.round(lid.w * 0.24) }; // the display: its stand, one bent aluminium plate
        return { w: Math.max(lid.w, base.w), h: lid.h + base.h, lid, base, inset: { top, left } };
    }
    const [bw, bh] = d.body;
    return { w: bw, h: bh, inset: { top: (bh - d.h) / 2, left: (bw - d.w) / 2 } };
}

// One device drawn at its own size in screen points (frame, black screen, the module on it); scaled by the row
function deviceFrame(item, d) {
    const g = deviceGeometry(d);
    const body = el("div", { className: `kalq-frame is-${d.kind || (d.segments ? "fold" : "phone")}` });
    const screenBox = el("div", { className: "kalq-frame__screen" }, deviceScreen(item, d));
    Object.assign(screenBox.style, { width: `${d.w}px`, height: `${d.h}px`, borderRadius: `${d.radius}px` });
    if (d.kind) {
        const lid = el("div", { className: "kalq-frame__lid" }, screenBox);
        Object.assign(lid.style, { width: `${g.lid.w}px`, height: `${g.lid.h}px`, paddingTop: `${g.inset.top}px`, paddingLeft: `${g.inset.left}px`, borderRadius: d.kind === "laptop" ? "34px 34px 10px 10px" : "18px" });
        if (d.kind === "laptop") lid.append(el("span", { className: "kalq-frame__notch" }));
        const base = el("div", { className: "kalq-frame__base" });
        Object.assign(base.style, { width: `${g.base.w}px`, height: `${g.base.h}px` });
        body.append(lid, base);
    } else {
        Object.assign(body.style, { width: `${g.w}px`, height: `${g.h}px`, borderRadius: `${d.radius + Math.round((g.w - d.w) / 2)}px` });
        screenBox.style.position = "absolute";
        screenBox.style.top = `${g.inset.top}px`;
        screenBox.style.left = `${g.inset.left}px`;
        body.append(screenBox);
        if (d.island) screenBox.append(el("span", { className: `kalq-frame__cam is-${d.island}` }));
        if (d.segments) screenBox.append(el("span", { className: `kalq-frame__crease is-${d.segments}` }));
    }
    const holder = el("div", { className: "kalq-frame__holder" }, body);
    holder.dataset.device = d.id;
    return { holder, body, g };
}

let stageObserver = null;

// How it adapts: all eight devices in one row, centred at the top of a dark grey stage, one scale for all so each
// keeps its real size relative to the others
function stage(item) {
    const L = lang();
    const box = el("div", { className: "kalq-picker__stage" });
    const row = el("div", { className: "kalq-picker__row" });
    const frames = DEVICES.map((d) => {
        const f = deviceFrame(item, d);
        const fig = el("figure", { className: "kalq-picker__dev", title: d[L] }, f.holder, el("figcaption", { className: "kalq-picker__device-name", textContent: d[L] }));
        row.append(fig);
        return f;
    });
    const GAP = 16, ROW_H = 130; // the devices large enough to see the module on each screen
    const fit = () => {
        const room = row.clientWidth; // beside the label
        if (room <= 0) return;
        const sumW = frames.reduce((a, f) => a + f.g.w, 0), maxH = Math.max(...frames.map((f) => f.g.h));
        const k = Math.min((room - GAP * (frames.length - 1)) / sumW, ROW_H / maxH);
        frames.forEach(({ holder, body, g }) => {
            body.style.transform = `scale(${k})`;
            holder.style.width = `${g.w * k}px`; // not rounded: at this size a pixel is a model's difference
            holder.style.height = `${g.h * k}px`;
        });
    };
    box.append(el("p", { className: "kalq-picker__label", textContent: t("devices") }), row);
    requestAnimationFrame(fit);
    stageObserver?.disconnect(); // the previous selection's stage is gone
    stageObserver = new ResizeObserver(fit);
    stageObserver.observe(box);
    return box;
}

function detail(item) {
    const box = root.querySelector(".kalq-picker__detail");
    if (!item) return box.replaceChildren();
    box.replaceChildren(stage(item));
}

const focusGrid = () => root.querySelector(".kalq-picker__item[tabindex='0']")?.focus();

function columns() {
    const grid = root.querySelector(".kalq-picker__grid");
    const first = grid.querySelector(".kalq-picker__item");
    if (!first) return 1;
    return Math.max(1, Math.round(grid.clientWidth / (first.offsetWidth + 12)));
}

function onKey(e) {
    e.stopPropagation(); // keep the site's single-letter shortcuts out
    if (e.key === "Escape") { e.preventDefault(); return close(); }
    if (e.key === "Tab") return trap(e);
    const inGrid = e.target.closest?.(".kalq-picker__grid");
    const inSearch = e.target.classList?.contains("kalq-picker__search");
    const list = items();
    if (e.key === "Enter" && (inGrid || inSearch) && list[state.index]) { e.preventDefault(); return insert(list[state.index]); }
    if (!inGrid && !(inSearch && ["ArrowDown"].includes(e.key))) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns(), ArrowUp: -columns(), Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    if (inSearch) { focusGrid(); return; }
    state.index = Math.max(0, Math.min(list.length - 1, state.index + step));
    draw();
    focusGrid();
}

// Focus stays inside the dialog
function trap(e) {
    const focusable = [...root.querySelectorAll("button, input, textarea, [tabindex='0']")].filter((n) => !n.disabled && n.offsetParent !== null);
    const i = focusable.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? focusable.length - 1 : i - 1) : (i === focusable.length - 1 ? 0 : i + 1);
    e.preventDefault();
    focusable[next]?.focus();
}

function insert(item) {
    const done = state.onInsert;
    close();
    done(item.module, item.version);
}

function close() {
    if (!state) return;
    root.classList.remove("is-open");
    root.querySelector(".kalq-picker__detail").replaceChildren(); // no previews left in the page
    root.querySelector(".kalq-picker__settings")?.remove(); // nor the chat's preview (a second .kalq-chat)
    stageObserver?.disconnect();
    document.documentElement.classList.remove("kalq-scroll-lock");
    const back = state.returnFocus;
    state = null;
    back?.focus?.();
}

// focus "chat-destinations": open on Chat, its send destinations in view with the first field focused (a publish
// blocked for want of one links here)
export function openPicker({ onInsert, collab = null, category = ALL_CATEGORY.id, focus = null }) {
    if (!root) build();
    if (focus === "chat-destinations") category = "chat";
    state = { onInsert, collab, category, query: "", index: 0, returnFocus: document.activeElement };
    root.querySelector(".kalq-picker__search").value = "";
    draw();
    root.classList.add("is-open");
    document.documentElement.classList.add("kalq-scroll-lock"); // the page stays put underneath (js/collab.js)
    if (focus === "chat-destinations") {
        const panel = root.querySelector(".kalq-site--chat");
        panel?.scrollIntoView({ block: "start" });
        (panel?.querySelector("input") || root.querySelector(".kalq-picker__search")).focus({ preventScroll: true });
        return;
    }
    root.querySelector(".kalq-picker__search").focus();
}
