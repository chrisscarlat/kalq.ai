// Module picker (editors, edit mode): opened by a plus button between sections. Left the categories and a search,
// in the middle schematic previews of every version, on the right the selected one large with Insert.
// Keyboard: arrows browse the previews, Enter inserts, Esc closes, Tab moves between the three areas.
import { EDITOR_LANG } from "./i18n.js";
import { CATEGORIES, MODULES, renderModule } from "./modules/registry.js";

const TEXT = {
    de: { title: "Modul einfügen", search: "Module suchen", insert: "Einfügen", cancel: "Abbrechen", close: "Schließen",
        none: "Keine Module gefunden.", results: "Suchergebnisse", hint: "Pfeiltasten zum Blättern, Enter fügt ein, Esc schließt.",
        slots: "Enthält", required: "Pflicht", draft: "Wird als Entwurf eingefügt. Platzhalter ausfüllen, dann veröffentlichen.",
        devices: "So passt es sich an", derived: "abgeleitet", viewport: "CSS-Viewport" },
    en: { title: "Insert a module", search: "Search modules", insert: "Insert", cancel: "Cancel", close: "Close",
        none: "No modules found.", results: "Search results", hint: "Arrow keys to browse, Enter inserts, Esc closes.",
        slots: "Contains", required: "required", draft: "Inserted as a draft. Fill in the placeholders, then publish.",
        devices: "How it adapts", derived: "derived", viewport: "CSS viewport" },
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
        { id: "macbook-air-13", w: 1470, h: 956, dpr: 2, kind: "laptop", bezel: [24, 30, 24, 24], radius: 12, de: "MacBook Air 13″", en: "MacBook Air 13″" },
        { id: "studio-display-27", w: 2560, h: 1440, dpr: 2, kind: "display", bezel: [52, 52, 52, 52], radius: 0, de: "Studio Display 27″", en: "Studio Display 27″" },
    ] },
];
const DEVICES = DEVICE_GROUPS.flatMap((g) => g.devices);
const DEVICE_KEY = "kalq-picker-device"; // the last chosen preset, per browser
const savedDevice = () => { try { return localStorage.getItem(DEVICE_KEY); } catch { return null; } };
let deviceId = DEVICES.some((d) => d.id === savedDevice()) ? savedDevice() : "iphone-18-pro";

// Every version of every module, flat
const ALL = Object.entries(MODULES).flatMap(([module, def]) => Object.entries(def.versions).map(([version, v]) => ({ module, version, def, v })));

//=================================== Wireframes ===================================//
// Images and videos as blue rectangles, text as thin blue lines, headings thicker, buttons as small pills
const BLUE = "#3B82F6";
function wireframe(wire, { large = false } = {}) {
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
    return `<svg viewBox="0 0 100 60" ${large ? "" : 'preserveAspectRatio="xMidYMid meet"'} aria-hidden="true" focusable="false"><rect width="100" height="60" fill="#fff"/>${parts}</svg>`;
}

// The one image placeholder, the same everywhere an image can go (also as CSS in collab.scss, .kalq-ph-media):
// a dark blue block, a lighter blue sun behind a single darker blue mountain
export const GLYPH = { block: "#1D4ED8", sun: "#7DB3FF", mountain: "#172E7A" };
function imageGlyph(x, y, w, h) {
    const s = Math.min(w, h * 1.6); // the motif keeps its shape in wide and tall boxes
    const cx = x + w / 2, base = y + h * 0.82, top = base - s * 0.42;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="${GLYPH.block}"/>`
        + `<circle cx="${cx + s * 0.13}" cy="${top + s * 0.06}" r="${s * 0.09}" fill="${GLYPH.sun}"/>`
        + `<path d="M${cx - s * 0.26} ${base}L${cx - s * 0.02} ${top}L${cx + s * 0.24} ${base}Z" fill="${GLYPH.mountain}"/>`;
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
            </div>
            <div class="kalq-picker__main">
                <div class="kalq-picker__browse">
                    <p class="kalq-picker__hint"></p>
                    <h3 class="kalq-picker__heading"></h3>
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
    cats.replaceChildren(...CATEGORIES.map((c) => {
        const count = ALL.filter((x) => x.def.category === c.id).length;
        const b = el("button", { type: "button", className: "kalq-picker__cat" }, el("span", { textContent: c[L] }), el("span", { className: "kalq-picker__count", textContent: count || "–" }));
        b.setAttribute("aria-pressed", !state.query && state.category === c.id);
        b.addEventListener("click", () => { state.category = c.id; state.query = ""; state.index = 0; search.value = ""; draw(); focusGrid(); });
        return b;
    }));

    const list = items();
    const category = CATEGORIES.find((c) => c.id === state.category);
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
            option.innerHTML = wireframe(item.v.wire);
            option.append(el("span", { className: "kalq-picker__name", textContent: item.v.name[L] }), el("span", { className: "kalq-picker__module", textContent: item.def.name[L] }));
            option.addEventListener("click", () => { state.index = i; draw(); focusGrid(); });
            option.addEventListener("dblclick", () => insert(item));
            return option;
        }));
        grid.setAttribute("aria-activedescendant", `kalq-pick-${state.index}`);
    }
    detail(list[state.index]);
}

// The module itself, rendered with empty placeholders (drawn as blue shapes), on the chosen device: the frame centred
// near the top of a black stage, the device list on the right (grouped, scrolls when it overflows)
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

function devices(item) {
    const L = lang();
    const stage = el("div", { className: "kalq-picker__stage" });
    const draw = () => {
        const d = DEVICES.find((x) => x.id === deviceId) || DEVICES[0];
        const g = deviceGeometry(d);
        const body = el("div", { className: `kalq-frame is-${d.kind || (d.segments ? "fold" : "phone")}` });
        body.style.setProperty("--w", `${g.w}px`);
        body.style.setProperty("--h", `${g.h}px`);
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
        // scale the whole device to the stage: near the top, centred, room below
        const fit = () => {
            // the stage is as tall as the picker's visible detail area, so scrolled to it, all of it is in view
            const view = root.querySelector(".kalq-picker__detail")?.clientHeight || 0;
            if (view > 360) { stage.style.height = `${view}px`; list.style.height = `${view}px`; }
            // the device takes at most 78% of that height: near the top, with open space below for the caption and air
            const room = { w: stage.clientWidth - 64, h: Math.max(240, stage.clientHeight * 0.78 - 28) };
            const k = Math.min(room.w / g.w, room.h / g.h, 1);
            body.style.transform = `scale(${k})`;
            holder.style.width = `${Math.round(g.w * k)}px`;
            holder.style.height = `${Math.round(g.h * k)}px`;
        };
        const holder = el("div", { className: "kalq-frame__holder" }, body);
        const caption = el("p", { className: "kalq-picker__device-caption" }, el("span", { className: "kalq-picker__device-name", textContent: d[L] }),
            el("span", { className: "kalq-picker__device-size", textContent: `${d.w} × ${d.h} · ${d.dpr}×${d.derived ? ` · ${t("derived")}` : ""}` }));
        stage.replaceChildren(holder, caption);
        requestAnimationFrame(fit);
        stage._fit = fit;
    };
    // the list: three labelled groups; a radio group with the arrow keys
    const list = el("div", { className: "kalq-picker__device-list", role: "radiogroup" });
    list.setAttribute("aria-label", t("devices"));
    const buttons = [];
    DEVICE_GROUPS.forEach((group) => {
        list.append(el("p", { className: "kalq-picker__device-group", textContent: group[L] }));
        group.devices.forEach((d) => {
            const b = el("button", { type: "button", className: "kalq-picker__device-pick", textContent: d[L] });
            b.setAttribute("role", "radio");
            b.dataset.device = d.id;
            b.addEventListener("click", () => choose(d.id, true));
            buttons.push(b);
            list.append(b);
        });
    });
    const choose = (id, focus) => {
        deviceId = id;
        try { localStorage.setItem(DEVICE_KEY, id); } catch { /* remembered for this visit only */ }
        buttons.forEach((b) => { const on = b.dataset.device === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
        draw();
    };
    list.addEventListener("keydown", (e) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        e.stopPropagation();
        const i = DEVICES.findIndex((d) => d.id === deviceId);
        choose(DEVICES[(i + step + DEVICES.length) % DEVICES.length].id, true);
    });
    const area = el("div", { className: "kalq-picker__adapt" }, stage, list);
    choose(deviceId, false);
    new ResizeObserver(() => stage._fit?.()).observe(stage);
    return area;
}

function detail(item) {
    const box = root.querySelector(".kalq-picker__detail");
    if (!item) return box.replaceChildren();
    const L = lang();
    const preview = el("div", { className: "kalq-picker__preview" });
    preview.innerHTML = wireframe(item.v.wire, { large: true });
    const slots = el("ul", { className: "kalq-picker__slots" }, ...Object.values(item.def.slots)
        .filter((s, i, all) => all.findIndex((x) => x.kind === s.kind && x.label[L].replace(/\d+/, "") === s.label[L].replace(/\d+/, "")) === i)
        .map((s) => el("li", { textContent: s.label[L].replace(/\s*\d+$/, "") + (s.required ? ` · ${t("required")}` : "") })));
    const go = el("button", { type: "button", className: "kalq-btn kalq-btn--primary kalq-picker__insert", textContent: t("insert") });
    go.addEventListener("click", () => insert(item));
    const cancel = el("button", { type: "button", className: "kalq-btn", textContent: t("cancel") });
    cancel.addEventListener("click", close);
    const info = el("div", { className: "kalq-picker__info" }, preview,
        el("div", {}, el("h3", { className: "kalq-picker__detail-name", textContent: item.v.name[L] }),
            el("p", { className: "kalq-picker__detail-module", textContent: item.def.name[L] }),
            el("p", { className: "kalq-picker__label", textContent: t("slots") }), slots),
        el("div", { className: "kalq-picker__side-actions" }, el("p", { className: "kalq-picker__note", textContent: t("draft") }), el("div", { className: "kalq-picker__actions" }, cancel, go)));
    box.replaceChildren(info, el("p", { className: "kalq-picker__label", textContent: t("devices") }), devices(item));
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
    const focusable = [...root.querySelectorAll("button, input, [tabindex='0']")].filter((n) => !n.disabled && n.offsetParent !== null);
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
    document.documentElement.classList.remove("kalq-scroll-lock");
    const back = state.returnFocus;
    state = null;
    back?.focus?.();
}

export function openPicker({ onInsert, category = "content" }) {
    if (!root) build();
    state = { onInsert, category, query: "", index: 0, returnFocus: document.activeElement };
    root.querySelector(".kalq-picker__search").value = "";
    draw();
    root.classList.add("is-open");
    document.documentElement.classList.add("kalq-scroll-lock"); // the page stays put underneath (js/collab.js)
    root.querySelector(".kalq-picker__search").focus();
}
