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

// The preview devices at their real physical sizes next to each other: each frame renders the device's CSS viewport
// (w × h) and is shrunk to the size of its actual screen (device pixels ÷ pixel density, from the maker's specs),
// times one common factor. So a phone is as small next to a laptop as it is on a desk. Each frame is a fixed window
// of the device's screen; a taller section scrolls inside it.
// Device pixels and ppi: apple.com/iphone-18-pro/specs, apple.com/iphone-duo/specs, Apple's tech specs of iPhone 13
// mini, iPad Air 11", MacBook Air 13" (M1) and Studio Display, Microsoft's Surface Duo specs. The CSS viewports of the
// iPhone Duo and 18 Pro / Pro Max are their device pixels ÷ 3; Apple has not published them yet (derived).
const DEVICES = [
    { id: "iphone-13-mini", w: 375, h: 812, px: [1080, 2340], ppi: 476, phone: true, de: "iPhone 13 mini", en: "iPhone 13 mini" },
    { id: "iphone-duo-folded", w: 466, h: 678, px: [1398, 2034], ppi: 460, phone: true, derived: true, de: "iPhone Duo, zugeklappt", en: "iPhone Duo, folded" },
    { id: "iphone-duo-unfolded", w: 626, h: 890, px: [1878, 2670], ppi: 430, phone: true, derived: true, de: "iPhone Duo, aufgeklappt", en: "iPhone Duo, unfolded" },
    { id: "iphone-18-pro", w: 402, h: 874, px: [1206, 2622], ppi: 460, phone: true, derived: true, de: "iPhone 18 Pro", en: "iPhone 18 Pro" },
    { id: "iphone-18-pro-max", w: 440, h: 956, px: [1320, 2868], ppi: 460, phone: true, derived: true, de: "iPhone 18 Pro Max", en: "iPhone 18 Pro Max" },
    { id: "spanned", w: 1114, h: 705, hinge: 28, px: [2700, 1800], ppi: 401, cls: "is-span-h", de: "Surface Duo, aufgeklappt", en: "Surface Duo, spanned" },
    { id: "tablet-p", w: 820, h: 1180, px: [1640, 2360], ppi: 264, de: "iPad Air 11″, hochkant", en: "iPad Air 11″, portrait" },
    { id: "tablet-l", w: 1180, h: 820, px: [2360, 1640], ppi: 264, de: "iPad Air 11″, quer", en: "iPad Air 11″, landscape" },
    { id: "laptop", w: 1440, h: 900, px: [2560, 1600], ppi: 227, de: "MacBook Air 13″", en: "MacBook Air 13″" },
    { id: "large", w: 2560, h: 1440, px: [5120, 2880], ppi: 218, de: "Studio Display 27″", en: "Studio Display 27″" },
];
const PX_PER_INCH = 18; // the common factor: one inch of real screen is 18 pixels here
const scaleOf = (d) => (d.px[0] / d.ppi) * PX_PER_INCH / d.w;

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

// The module itself, rendered with empty placeholders (drawn as blue shapes), in a frame of each device's width
function devices(item) {
    const L = lang();
    const row = el("div", { className: "kalq-picker__devices" }, ...DEVICES.map((d) => {
        const scale = scaleOf(d);
        const frame = el("div", { className: `kalq-device ${d.cls || ""}` });
        frame.style.width = `${d.w}px`;
        frame.style.height = `${d.h}px`;
        frame.style.transform = `scale(${scale})`;
        if (d.hinge) { // two screens: the same variables css/utilities/_dual.scss reads from a real device
            const screen = (d.w - d.hinge) / 2;
            frame.style.setProperty("--seg-l", `${screen}px`);
            frame.style.setProperty("--seg-r", `${screen}px`);
            frame.style.setProperty("--seg-hinge", `${d.hinge}px`);
            frame.style.setProperty("--seg-h", `${d.h}px`);
        }
        frame.setAttribute("aria-hidden", "true");
        // A picture to scroll through, nothing to click
        frame.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
        const node = renderModule({ id: "preview", module: item.module, version: item.version, state: "draft" },
            { doc: document, page: "preview", store: new Map(), lang: L, editor: true });
        if (node) {
            // A picture of the module, not a section: nothing in it may look like page content to the rest of the code
            [node, ...node.querySelectorAll("[data-kalq-key], [data-kalq-type], [data-module], [id]")].forEach((n) =>
                ["data-kalq-key", "data-kalq-type", "data-module", "id"].forEach((a) => n.removeAttribute(a)));
            frame.append(node);
        }
        const box = el("div", { className: "kalq-picker__device" });
        box.style.width = `${Math.round(d.w * scale)}px`;
        box.style.height = `${Math.round(d.h * scale)}px`;
        box.append(frame);
        if (d.phone) { // rounded like the real screen's corners, at this device's scale
            box.classList.add("is-phone");
            box.style.borderRadius = `${Math.round(d.w * 0.13 * scale)}px`;
        }
        // the model, and below it small its resolution in device pixels; the CSS viewport on hover
        const size = el("span", { className: "kalq-picker__device-size", textContent: `${d.px[0]} × ${d.px[1]} px` });
        size.title = `${t("viewport")}: ${d.w} × ${d.h}` + (d.derived ? ` (${t("derived")})` : "");
        return el("figure", { className: "kalq-picker__device-wrap" }, box,
            el("figcaption", {}, el("span", { className: "kalq-picker__device-name", textContent: d[L] }), size));
    }));
    // The row scrolls by itself while the pointer is near either end (hovering or dragging), and by dragging it with a
    // mouse; touch, trackpad and the arrow keys scroll it as usual. No visible scrollbar.
    row.tabIndex = 0;
    row.setAttribute("aria-label", t("devices"));
    let speed = 0, raf = 0, drag = null;
    const EDGE = 72;
    const tick = () => { raf = 0; if (!speed) return; row.scrollLeft += speed; raf = requestAnimationFrame(tick); };
    const steer = (x) => {
        const r = row.getBoundingClientRect();
        const left = x - r.left, right = r.right - x;
        speed = left < EDGE ? -Math.ceil((EDGE - left) / 6) : right < EDGE ? Math.ceil((EDGE - right) / 6) : 0;
        if (speed && !raf) raf = requestAnimationFrame(tick);
    };
    row.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return; // fingers scroll it natively
        if (drag) { row.scrollLeft = drag.left - (e.clientX - drag.x); }
        steer(e.clientX);
    });
    row.addEventListener("pointerleave", () => { speed = 0; });
    row.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { drag = { x: e.clientX, left: row.scrollLeft }; row.setPointerCapture(e.pointerId); } });
    const end = () => { drag = null; speed = 0; };
    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", end);
    row.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 160, ArrowLeft: -160, End: Infinity, Home: -Infinity }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        row.scrollLeft = Number.isFinite(step) ? row.scrollLeft + step : step > 0 ? row.scrollWidth : 0;
    });
    return row;
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
