// Page builder (editors only, in edit mode). Every section gets one move control (a map of the page in a pill: arrows
// nudge, dragging moves many steps), copy, remove and, for copies and new sections, draft/live. A plus on every seam
// between sections opens the module picker. Select a section to use Delete, Cmd/Ctrl+C, Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z.
// Each action writes one new revision of the page's layout block (plus the copied blocks for a copy) in one page
// batch, so it shows in Versions and can be restored. Undo and redo are such entries too: they write back the layout
// before (or after) an action of this session; nothing is ever deleted. A removed section leaves the layout, its
// blocks stay, so undo or a restore brings it back with them.
import { applyStoredLayout, setLocalContent, storedEntry, storedKeys } from "./content.js";
import { currentLang } from "./i18n.js";
import { collectTemplates, copyKey, layoutKey, newSectionId, parseLayout, resolveLayout, sectionPrefix } from "./layout.js";
import { MODULES, missingRequired } from "./modules/registry.js";

const TEXT = {
    de: {
        theme: "Darstellung", themePage: "Wie die Seite", themeLight: "Immer hell", themeDark: "Immer dunkel",
        move: "Verschieben", up: "Nach oben", down: "Nach unten", copy: "Kopieren (⌘C)", remove: "Entfernen (Entf)", draft: "Entwurf",
        publish: "Veröffentlichen", toDraft: "Zum Entwurf", undo: "Rückgängig (⌘Z)", redo: "Wiederholen (⇧⌘Z)",
        removed: (n) => `${n} entfernt. ⌘Z macht es rückgängig.`, nothing: "Nichts rückgängig zu machen.", nothingRedo: "Nichts zu wiederholen.",
        changed: "Die Seite wurde inzwischen geändert. In den Versionen wiederherstellen.", map: "Seitenaufbau", mapHint: "Ziehen oder Pfeiltasten",
        failed: "Das hat nicht geklappt.", relogin: "Bitte melden Sie sich erneut an.", copyOf: "Kopie", section: "Abschnitt",
        insert: "Modul hier einfügen", missing: (list) => `Erst ausfüllen: ${list}`,
        names: { header: "Hero", about: "Über Kalq", expertise: "Plattform-Liste", belief: "Haltung", social: "Social", "expertise-header": "Kopf",
            "expertise-header-img": "Bild", "expertise-container": "Karten", "about-header": "Kopf", "about-header-img": "Bild", "about-goals": "Ziele",
            "about-wedo": "Was wir tun", "about-awwards": "Logos", legal: "Text" },
    },
    en: {
        theme: "Appearance", themePage: "Follow page", themeLight: "Force light", themeDark: "Force dark",
        move: "Move", up: "Move up", down: "Move down", copy: "Copy (⌘C)", remove: "Remove (Delete)", draft: "Draft",
        publish: "Publish", toDraft: "Back to draft", undo: "Undo (⌘Z)", redo: "Redo (⇧⌘Z)",
        removed: (n) => `${n} removed. ⌘Z undoes it.`, nothing: "Nothing to undo.", nothingRedo: "Nothing to redo.",
        changed: "The page has changed since. Restore it from Versions.", map: "Page outline", mapHint: "Drag or arrow keys",
        failed: "That did not work.", relogin: "Please log in again.", copyOf: "copy", section: "Section",
        insert: "Insert a module here", missing: (list) => `Fill in first: ${list}`,
        names: { header: "Hero", about: "About Kalq", expertise: "Platform list", belief: "Belief", social: "Social", "expertise-header": "Header",
            "expertise-header-img": "Image", "expertise-container": "Cards", "about-header": "Header", "about-header-img": "Image", "about-goals": "Goals",
            "about-wedo": "What we do", "about-awwards": "Logos", legal: "Text" },
    },
};
const lang = () => (currentLang() === "en" ? "en" : "de");
const t = (key) => TEXT[lang()][key];

let collab;
let busy = false;
let selected = null; // id of the selected section
const undoStack = []; // { page, before, after, label }: this session's layout actions
const redoStack = [];

const container = () => { const all = document.querySelectorAll('[data-barba="container"]'); return all[all.length - 1] || null; };
const pageName = () => container()?.dataset.page;
const sectionNode = (id) => container()?.querySelector(`:scope > section[data-section="${CSS.escape(id)}"]`);
const editing = () => document.body.classList.contains("kalq-edit");

// The layout as it stands, drafts included (editors get them from /api/content)
function currentLayout() {
    const page = pageName();
    return resolveLayout(parseLayout(storedEntry(layoutKey(page))?.media), collectTemplates(container()));
}
const serialize = (layout) => JSON.stringify({ v: 1, sections: layout.sections, removed: layout.removed });

function sectionName(entry) {
    const names = t("names");
    if (entry.module === "legacy" && !entry.source) return names[entry.id] || entry.id;
    if (entry.module === "legacy") return `${names[entry.source] || entry.source} (${t("copyOf")})`;
    const def = MODULES[entry.module];
    if (!def) return entry.module;
    return `${def.name[lang()]} · ${def.versions[entry.version]?.name[lang()] || entry.version}`;
}

async function editorSession() {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    return session && session.user?.app_metadata?.role === "editor" ? session : null;
}

// One batch: the new layout, plus any copied blocks. Remembered for undo unless it is an undo or redo itself.
async function write(layout, label, extra = [], { record = true } = {}) {
    const session = await editorSession();
    if (!session) throw new Error("relogin");
    const page = pageName();
    const key = layoutKey(page);
    const before = serialize(currentLayout());
    const blocks = [{ key, page, type: "layout" }, ...extra.map((r) => ({ key: r.key, page: r.page, type: r.type }))];
    const { error: blockError } = await collab.sb.from("blocks").upsert(blocks, { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const content = serialize(layout);
    const rows = [{ block_key: key, page, lang: null, content }, ...extra.map((r) => ({ block_key: r.key, page: r.page, lang: r.lang, content: r.content }))]
        .map((r) => ({ ...r, author_id: session.user.id, batch_id: batch, batch_scope: "page", batch_label: label }));
    const { error } = await collab.sb.from("revisions").insert(rows);
    if (error) throw error;
    setLocalContent(key, null, content, "layout");
    extra.forEach((r) => setLocalContent(r.key, r.lang, r.content, r.type));
    applyStoredLayout();
    collab.broadcast("content", { keys: [key], color: collab.me.color });
    if (record) { undoStack.push({ page, before, after: content, label }); redoStack.length = 0; }
    updateUndoButtons();
}

async function run(action) {
    if (busy) return;
    busy = true;
    try { await action(); }
    catch (error) {
        console.error("section", error);
        collab.toast(error?.message === "relogin" ? t("relogin") : t("failed"), "error");
    } finally {
        busy = false;
        render();
    }
}

// Move to a position (one step from the arrows, many from a drag): one history entry
const moveTo = (id, target) => run(async () => {
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    const j = Math.max(0, Math.min(layout.sections.length - 1, target));
    if (i < 0 || i === j) return;
    const [entry] = layout.sections.splice(i, 1);
    layout.sections.splice(j, 0, entry);
    const label = j === i - 1 ? "moved up" : j === i + 1 ? "moved down" : "moved";
    await write(layout, `Section ${label}: ${sectionName(entry)}`);
    reveal(id);
});

const remove = (id) => run(async () => {
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    if (!entry) return;
    layout.sections = layout.sections.filter((s) => s.id !== id);
    if (entry.module === "legacy" && !entry.source && !layout.removed.includes(id)) layout.removed.push(id);
    await write(layout, `Section removed: ${sectionName(entry)}`);
    if (selected === id) selected = null;
    collab.toast(t("removed")(sectionName(entry)));
});

const setState = (id, state) => run(async () => {
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    if (!entry || entry.state === state) return;
    // A section with required placeholders still empty cannot go live
    if (state === "live") {
        const missing = missingRequired(entry, pageName(), storedEntry);
        if (missing.length) return collab.toast(t("missing")(missing.map((l) => l[lang()]).join(", ")), "error");
    }
    entry.state = state;
    await write(layout, `Section ${state === "live" ? "published" : "to draft"}: ${sectionName(entry)}`);
});

// Light, dark or following the site toggle: one history entry
const setTheme = (id, theme) => run(async () => {
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    const next = theme === "light" || theme === "dark" ? theme : null;
    if (!entry || (entry.theme || null) === next) return;
    if (next) entry.theme = next; else delete entry.theme;
    await write(layout, `Section theme ${next || "page"}: ${sectionName(entry)}`);
});

// A copy goes directly beneath as a draft, with its own copies of every stored block of the section
const duplicate = (id) => run(async () => {
    const page = pageName();
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const entry = layout.sections[i];
    const copyId = newSectionId();
    const copy = entry.module === "legacy"
        ? { id: copyId, module: "legacy", source: entry.source || entry.id, state: "draft" }
        : { id: copyId, module: entry.module, version: entry.version, state: "draft" };
    if (entry.theme) copy.theme = entry.theme; // the copy looks like its original
    const own = sectionPrefix(page, entry.id);
    const newKey = (key) => (key.startsWith(own) ? sectionPrefix(page, copyId) + key.slice(own.length) : copyKey(page, copyId, key));
    // The blocks of the section: its own prefixed keys, or for a built-in section the keys found in its HTML
    const keys = new Set(storedKeys().filter((k) => k.startsWith(own)));
    sectionNode(id)?.querySelectorAll("[data-kalq-key]").forEach((el) => keys.add(el.dataset.kalqKey));
    const extra = [];
    keys.forEach((key) => {
        const stored = storedEntry(key);
        if (!stored) return; // never edited: the copy shows the same built-in text
        const target = newKey(key);
        if (stored.type === "text") ["de", "en"].forEach((l) => { if (stored[l] != null) extra.push({ key: target, page, type: "text", lang: l, content: stored[l] }); });
        else if (stored.media != null) extra.push({ key: target, page, type: stored.type, lang: null, content: stored.media });
    });
    layout.sections.splice(i + 1, 0, copy);
    await write(layout, `Section duplicated: ${sectionName(entry)}`, extra);
    selected = copyId;
    reveal(copyId);
});

// Undo and redo: a new history entry that writes back the layout before (or after) the action. Only while the page
// is still as that action left it; otherwise Versions is the way back.
const undo = () => run(async () => {
    const page = pageName();
    const last = [...undoStack].reverse().find((a) => a.page === page);
    if (!last) return collab.toast(t("nothing"));
    if (serialize(currentLayout()) !== last.after) return collab.toast(t("changed"), "error");
    await write(parseLayout(last.before), `Section undo: ${last.label.replace(/^Section /, "")}`, [], { record: false });
    undoStack.splice(undoStack.lastIndexOf(last), 1);
    redoStack.push(last);
    updateUndoButtons();
});

const redo = () => run(async () => {
    const page = pageName();
    const next = [...redoStack].reverse().find((a) => a.page === page);
    if (!next) return collab.toast(t("nothingRedo"));
    if (serialize(currentLayout()) !== next.before) return collab.toast(t("changed"), "error");
    await write(parseLayout(next.after), `Section redo: ${next.label.replace(/^Section /, "")}`, [], { record: false });
    redoStack.splice(redoStack.lastIndexOf(next), 1);
    undoStack.push(next);
    updateUndoButtons();
});

// A new module from the picker, as a draft at that position, all slots placeholders
export const insertModule = (index, module, version) => run(async () => {
    if (!MODULES[module]?.versions[version]) return;
    const layout = currentLayout();
    const entry = { id: newSectionId(), module, version, state: "draft" };
    layout.sections.splice(Math.max(0, Math.min(index, layout.sections.length)), 0, entry);
    await write(layout, `Section inserted: ${sectionName(entry)}`);
    selected = entry.id;
    reveal(entry.id);
});

async function openPicker(index) {
    const { openPicker: open } = await import("./picker.js");
    open({ onInsert: (module, version) => insertModule(index, module, version) });
}

// Scroll the page so a section is in view
function reveal(id) {
    const node = sectionNode(id);
    if (!node) return;
    const scroller = document.querySelector(".scrollbar-container");
    const bar = scroller && window.Scrollbar ? Scrollbar.get(scroller) : null;
    if (bar) bar.scrollIntoView(node, { offsetTop: 90, onlyScrollIfNeeded: true });
    else node.scrollIntoView({ block: "nearest" });
}

//=================================== Controls ===================================//
const icon = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
    move: icon("M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"), up: icon("M12 19V5M6 11l6-6 6 6"), down: icon("M12 5v14M6 13l6 6 6-6"),
    duplicate: icon("M8 8h11v11H8zM5 16V5h11"),
    "theme-page": '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor"/></svg>',
    "theme-light": icon("M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"),
    "theme-dark": icon("M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"), remove: icon("M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"),
    undo: icon("M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"), redo: icon("M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"),
};

function toolButton(kind, label, fn, { text } = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `kalq-section-tools__btn is-${kind}`;
    b.title = label;
    b.setAttribute("aria-label", label);
    if (text) b.textContent = text; else b.innerHTML = ICONS[kind] || "";
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(b); });
    return b;
}

function tools(entry) {
    const box = document.createElement("div");
    box.className = "kalq-section-tools";
    box.setAttribute("role", "toolbar");
    box.setAttribute("aria-label", `${t("section")}: ${sectionName(entry)}`);
    const name = document.createElement("button");
    name.type = "button";
    name.className = "kalq-section-tools__name";
    name.textContent = sectionName(entry);
    name.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); select(entry.id); });
    // Appearance: follow the page, always light, always dark
    const theme = document.createElement("span");
    theme.className = "kalq-section-tools__theme";
    theme.setAttribute("role", "group");
    theme.setAttribute("aria-label", t("theme"));
    [["page", t("themePage")], ["light", t("themeLight")], ["dark", t("themeDark")]].forEach(([value, label]) => {
        const b = toolButton(`theme-${value}`, `${t("theme")}: ${label}`, () => setTheme(entry.id, value));
        b.setAttribute("aria-pressed", (entry.theme || "page") === value);
        theme.append(b);
    });
    box.append(name,
        toolButton("move", `${t("move")}: ${sectionName(entry)}`, (b) => openMap(entry.id, b)),
        toolButton("duplicate", t("copy"), () => duplicate(entry.id)),
        toolButton("remove", t("remove"), () => remove(entry.id)), theme);
    // Copies and new sections: draft or live; built-in sections are always live
    if (!(entry.module === "legacy" && !entry.source)) {
        if (entry.state === "draft") {
            const tag = document.createElement("span");
            tag.className = "kalq-section-tools__draft";
            tag.textContent = t("draft");
            box.append(tag, toolButton("publish", t("publish"), () => setState(entry.id, "live"), { text: t("publish") }));
        } else {
            box.append(toolButton("todraft", t("toDraft"), () => setState(entry.id, "draft"), { text: t("toDraft") }));
        }
    }
    box.addEventListener("pointerdown", () => select(entry.id));
    return box;
}

//=================================== Clear of the site chrome ===================================//
// The fixed header (logo, version dots, mode, language, menu) is never covered: the controls of the first section and
// the plus above it start below the header band, and any control that scrolls under the band is hidden until clear.
let chromeBottom = 0;

function measureChrome() {
    const parts = [...document.querySelectorAll(".site-header > *, .kalq-switcher:not([hidden])")];
    chromeBottom = Math.max(0, ...parts.map((n) => n.getBoundingClientRect().bottom).filter((b) => b > 0 && b < window.innerHeight / 2));
    document.documentElement.style.setProperty("--kalq-chrome", `${Math.round(chromeBottom)}px`);
}

function clearChrome() {
    if (!editing()) return;
    // the editor's own toolbar at the bottom counts too
    const bar = document.querySelector(".kalq-toolbar")?.getBoundingClientRect();
    document.querySelectorAll(".kalq-section-tools, .kalq-insert-zone").forEach((n) => {
        const r = n.getBoundingClientRect();
        const underHeader = r.bottom > 0 && r.top < chromeBottom + 6;
        const underToolbar = bar && r.bottom > bar.top - 6 && r.top < bar.bottom && r.right > bar.left && r.left < bar.right;
        n.classList.toggle("is-under-chrome", underHeader || !!underToolbar);
    });
}

//=================================== Insert plus on every seam ===================================//
// One layer over the page: a short blue line with a plus, centred on each boundary between two sections (and above
// the first, below the last), straddling both. Revealed on hover with a pointer, always shown on touch.
let insertLayer = null;
let layerObserver = null;

function placeInserts() {
    const c = container();
    if (!insertLayer || !c) return;
    const sections = [...c.querySelectorAll(":scope > section[data-section]")];
    const seams = sections.map((s) => s.offsetTop);
    if (sections.length) seams.push(sections.at(-1).offsetTop + sections.at(-1).offsetHeight);
    const zones = [...insertLayer.children];
    // the first one, "before the first section", sits just below the header band
    seams.forEach((y, i) => { if (zones[i]) zones[i].style.top = `${Math.max(i === 0 ? chromeBottom + 26 : 0, y)}px`; });
    clearChrome();
}

function renderInserts() {
    insertLayer?.remove();
    layerObserver?.disconnect();
    const c = container();
    if (!editing() || !c) return;
    const count = c.querySelectorAll(":scope > section[data-section]").length;
    insertLayer = document.createElement("div");
    insertLayer.className = "kalq-inserts";
    for (let i = 0; i <= count; i++) {
        const zone = document.createElement("div");
        zone.className = "kalq-insert-zone";
        const line = document.createElement("span");
        line.className = "kalq-insert-line";
        line.setAttribute("aria-hidden", "true");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kalq-insert";
        b.title = t("insert");
        b.setAttribute("aria-label", t("insert"));
        b.innerHTML = '<span aria-hidden="true">+</span>';
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openPicker(i); });
        zone.append(line, b);
        insertLayer.append(zone);
    }
    c.append(insertLayer);
    placeInserts();
    // Sections change height (images load, text is edited): the seams follow
    layerObserver = new ResizeObserver(placeInserts);
    layerObserver.observe(c);
}

//=================================== Page map (one move control) ===================================//
// A pill below the move button: every section of the page as a small labelled block in order, heights in proportion,
// the one being moved in blue. Arrows nudge it a step, dragging the blue block moves it many steps at once.
let map = null;

function closeMap(returnFocus = true) {
    if (!map) return;
    const back = map.anchor;
    map.node.remove();
    map = null;
    if (returnFocus && back?.isConnected) back.focus();
}

function openMap(id, anchor) {
    closeMap(false);
    select(id);
    const layout = currentLayout();
    const node = document.createElement("div");
    node.className = "kalq-map-pill";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", t("map"));
    const head = document.createElement("div");
    head.className = "kalq-map-pill__head";
    head.append(Object.assign(document.createElement("span"), { textContent: t("map") }),
        toolButton("up", t("up"), () => nudge(-1)), toolButton("down", t("down"), () => nudge(1)));
    const list = document.createElement("div");
    list.className = "kalq-map-pill__list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", t("map"));
    const heights = layout.sections.map((s) => sectionNode(s.id)?.offsetHeight || 400);
    const total = heights.reduce((a, b) => a + b, 0) || 1;
    layout.sections.forEach((s, i) => {
        const block = document.createElement("div");
        block.className = "kalq-map-pill__block";
        block.dataset.id = s.id;
        block.style.height = `${Math.max(20, Math.round((heights[i] / total) * 360))}px`;
        block.textContent = sectionName(s);
        block.setAttribute("role", "option");
        if (s.state === "draft") block.classList.add("is-draft");
        if (s.id === id) {
            block.classList.add("is-current");
            block.setAttribute("aria-selected", "true");
            block.tabIndex = 0;
            block.setAttribute("aria-label", `${sectionName(s)}: ${t("mapHint")}`);
        }
        list.append(block);
    });
    node.append(head, list, Object.assign(document.createElement("p"), { className: "kalq-map-pill__hint", textContent: t("mapHint") }));
    document.body.append(node);
    map = { node, anchor, id };
    position();
    node.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); closeMap(); }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); nudge(e.key === "ArrowUp" ? -1 : 1); }
        else if (e.key === "Tab") { // stay inside the pill
            const f = [...node.querySelectorAll("button, [tabindex='0']")];
            const i = f.indexOf(document.activeElement);
            e.preventDefault();
            f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
    });
    list.querySelector(".is-current").addEventListener("pointerdown", startDrag);
    list.querySelector(".is-current").focus();
}

function position() {
    if (!map) return;
    const r = map.anchor.getBoundingClientRect();
    const w = map.node.offsetWidth;
    map.node.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    map.node.style.top = `${Math.min(r.bottom + 10, window.innerHeight - map.node.offsetHeight - 8)}px`;
}

// Arrows: one step, one history entry; the pill stays open on the moved section
async function nudge(delta) {
    if (!map) return;
    const { id, anchor } = map;
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    await moveTo(id, i + delta);
    const button = sectionNode(id)?.querySelector(".kalq-section-tools .is-move") || anchor;
    openMap(id, button);
}

// Drag the blue block along the map; dropping it moves the real section there (one history entry)
function startDrag(e) {
    if (!map) return;
    e.preventDefault();
    const block = e.currentTarget;
    const list = block.parentElement;
    const others = [...list.children].filter((b) => b !== block);
    block.setPointerCapture(e.pointerId);
    block.classList.add("is-dragging");
    const startY = e.clientY;
    let target = [...list.children].indexOf(block);
    const marker = document.createElement("div");
    marker.className = "kalq-map-pill__marker";
    const move = (ev) => {
        block.style.transform = `translateY(${ev.clientY - startY}px)`;
        // the gap the pointer is in, among the other blocks
        target = others.findIndex((b) => { const r = b.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
        if (target < 0) target = others.length;
        const ref = others[target] || null;
        list.insertBefore(marker, ref);
    };
    const up = () => {
        block.removeEventListener("pointermove", move);
        block.removeEventListener("pointerup", up);
        block.removeEventListener("pointercancel", up);
        marker.remove();
        block.style.transform = "";
        block.classList.remove("is-dragging");
        const { id } = map;
        moveTo(id, target).then(() => openMap(id, sectionNode(id)?.querySelector(".kalq-section-tools .is-move") || map?.anchor));
    };
    block.addEventListener("pointermove", move);
    block.addEventListener("pointerup", up);
    block.addEventListener("pointercancel", up);
}

//=================================== Selection and keys ===================================//
function select(id) {
    selected = id;
    container()?.querySelectorAll(":scope > section[data-section]").forEach((s) => s.classList.toggle("kalq-section-selected", s.dataset.section === id));
}

// Clicking a section's background (not its text, links or controls) in edit mode selects it
function onPointerDown(e) {
    if (!editing() || e.target.closest(".kalq-map-pill, .kalq-picker, .kalq-toolbar, .kalq-panel, .kalq-styles")) return;
    if (map && !e.target.closest(".kalq-map-pill")) closeMap(false);
    const section = e.target.closest?.('[data-barba="container"] > section[data-section]');
    // Clicking into a text, link or control works on that, not on the section: the selection ends
    if (!section || e.target.closest("[data-kalq-key], a, button, input, textarea, [contenteditable='true'], .kalq-media-tools")) {
        if (!e.target.closest(".kalq-section-tools, .kalq-inserts")) select(null);
        return;
    }
    select(section.dataset.section);
}

const typing = (target) => !!target.closest?.("input, textarea, select, [contenteditable='true']");

function onKey(e) {
    if (!editing() || typing(e.target) || e.target.closest?.(".kalq-picker, .kalq-map-pill")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopImmediatePropagation(); return e.shiftKey ? redo() : undo(); }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); e.stopImmediatePropagation(); return redo(); }
    if (!selected || !sectionNode(selected)) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); select(null); return; } // before Esc leaves edit mode
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); return remove(selected); }
    if (mod && e.key.toLowerCase() === "c" && !String(window.getSelection())) { e.preventDefault(); e.stopImmediatePropagation(); return duplicate(selected); }
}

//=================================== Undo and redo in the toolbar ===================================//
let undoButton = null, redoButton = null;

function updateUndoButtons() {
    const page = pageName();
    if (undoButton) undoButton.disabled = !undoStack.some((a) => a.page === page);
    if (redoButton) redoButton.disabled = !redoStack.some((a) => a.page === page);
}

function addUndoButtons() {
    const make = (kind, fn, order) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `kalq-toolbar__btn kalq-undo-btn is-${kind}`;
        b.innerHTML = ICONS[kind].replace('width="16" height="16"', 'width="18" height="18"');
        const label = () => { b.title = t(kind); b.setAttribute("aria-label", t(kind)); };
        label();
        document.addEventListener("kalq:language", label);
        b.addEventListener("click", fn);
        collab.addTool(b, order);
        return b;
    };
    undoButton = make("undo", undo, 11);
    redoButton = make("redo", redo, 12);
    updateUndoButtons();
}

//=================================== Render ===================================//
export function render() {
    document.querySelectorAll(".kalq-section-tools").forEach((n) => n.remove());
    if (!editing() || !container()) { insertLayer?.remove(); closeMap(false); return; }
    const layout = currentLayout();
    measureChrome();
    container().querySelectorAll(":scope > section[data-section]").forEach((node, i) => {
        const entry = layout.sections.find((s) => s.id === node.dataset.section);
        if (!entry) return;
        const bar = tools(entry);
        if (i === 0) bar.classList.add("is-first"); // below the header band and the plus before it
        node.prepend(bar);
    });
    renderInserts();
    if (selected) select(selected);
    updateUndoButtons();
}

export function initSections(api) {
    collab = api;
    addUndoButtons();
    // Edit mode on or off, a page change, a layout change (own, someone else's, a restore), a language switch
    let wasEditing = editing();
    new MutationObserver(() => { if (editing() !== wasEditing) { wasEditing = editing(); render(); } }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("kalq:layout", render);
    document.addEventListener("kalq:language", render);
    collab.on("page", () => { selected = null; closeMap(false); render(); });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", () => { measureChrome(); placeInserts(); position(); });
    const scroller = document.querySelector(".scrollbar-container");
    const bar = scroller && window.Scrollbar ? Scrollbar.get(scroller) : null;
    bar?.addListener(() => { position(); clearChrome(); });
    if (!bar) window.addEventListener("scroll", clearChrome, { passive: true });
    render();
}
