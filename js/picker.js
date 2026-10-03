// Module picker (editors, edit mode): opened by a plus button between sections. Left the categories and a search,
// in the middle schematic previews of every version, on the right the selected one large with Insert.
// Keyboard: arrows browse the previews, Enter inserts, Esc closes, Tab moves between the three areas.
import { currentLang } from "./i18n.js";
import { CATEGORIES, MODULES } from "./modules/registry.js";

const TEXT = {
    de: { title: "Modul einfügen", search: "Module suchen", insert: "Einfügen", cancel: "Abbrechen", close: "Schließen",
        none: "Keine Module gefunden.", results: "Suchergebnisse", hint: "Pfeiltasten zum Blättern, Enter fügt ein, Esc schließt.",
        slots: "Enthält", required: "Pflicht", draft: "Wird als Entwurf eingefügt. Platzhalter ausfüllen, dann veröffentlichen." },
    en: { title: "Insert a module", search: "Search modules", insert: "Insert", cancel: "Cancel", close: "Close",
        none: "No modules found.", results: "Search results", hint: "Arrow keys to browse, Enter inserts, Esc closes.",
        slots: "Contains", required: "required", draft: "Inserted as a draft. Fill in the placeholders, then publish." },
};
const lang = () => (currentLang() === "en" ? "en" : "de");
const t = (key) => TEXT[lang()][key];

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
            case "media": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${BLUE}" fill-opacity=".18" stroke="${BLUE}" stroke-width=".5"/>`
                + `<path d="M${x} ${y + h}L${x + w * 0.35} ${y + h * 0.55}L${x + w * 0.55} ${y + h * 0.75}L${x + w * 0.75} ${y + h * 0.45}L${x + w} ${y + h * 0.8}" fill="none" stroke="${BLUE}" stroke-width=".5" stroke-opacity=".6"/>`
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
                <p class="kalq-picker__hint"></p>
                <h3 class="kalq-picker__heading"></h3>
                <div class="kalq-picker__grid" role="listbox"></div>
            </div>
            <aside class="kalq-picker__detail" aria-live="polite"></aside>
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
    box.replaceChildren(preview, el("h3", { className: "kalq-picker__detail-name", textContent: item.v.name[L] }),
        el("p", { className: "kalq-picker__detail-module", textContent: item.def.name[L] }),
        el("p", { className: "kalq-picker__label", textContent: t("slots") }), slots,
        el("p", { className: "kalq-picker__note", textContent: t("draft") }), el("div", { className: "kalq-picker__actions" }, cancel, go));
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
