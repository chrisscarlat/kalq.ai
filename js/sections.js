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
        focal: "Motiv auf zwei Bildschirmen", focalLeft: "Motiv links", focalRight: "Motiv rechts",
        move: "Verschieben", up: "Nach oben", down: "Nach unten", copy: "Kopieren (⌘C)", remove: "Entfernen (Entf)", draft: "Entwurf",
        publish: "Veröffentlichen", toDraft: "Zum Entwurf", undo: "Rückgängig (⌘Z)", redo: "Wiederholen (⇧⌘Z)",
        removed: (n) => `${n} entfernt. ⌘Z macht es rückgängig.`, nothing: "Nichts rückgängig zu machen.", nothingRedo: "Nichts zu wiederholen.",
        changed: "Die Seite wurde inzwischen geändert. In den Versionen wiederherstellen.", map: "Seitenaufbau", fixed: "Fixiert", footer: "Footer",
        themeChoose: "Darstellung wählen",
        failed: "Das hat nicht geklappt.", relogin: "Bitte melden Sie sich erneut an.", copyOf: "Kopie", section: "Abschnitt",
        insert: "Modul hier einfügen", insertAfter: "Modul darunter einfügen", missing: (list) => `Erst ausfüllen: ${list}`,
        names: { header: "Hero", about: "Über Kalq", expertise: "Plattform-Liste", belief: "Haltung", social: "Social", "expertise-header": "Kopf",
            "expertise-header-img": "Bild", "expertise-container": "Karten", "about-header": "Kopf", "about-header-img": "Bild", "about-goals": "Ziele",
            "about-wedo": "Was wir tun", "about-awwards": "Logos", legal: "Text" },
    },
    en: {
        theme: "Appearance", themePage: "Follow page", themeLight: "Force light", themeDark: "Force dark",
        focal: "Subject on two screens", focalLeft: "Subject left", focalRight: "Subject right",
        move: "Move", up: "Move up", down: "Move down", copy: "Copy (⌘C)", remove: "Remove (Delete)", draft: "Draft",
        publish: "Publish", toDraft: "Back to draft", undo: "Undo (⌘Z)", redo: "Redo (⇧⌘Z)",
        removed: (n) => `${n} removed. ⌘Z undoes it.`, nothing: "Nothing to undo.", nothingRedo: "Nothing to redo.",
        changed: "The page has changed since. Restore it from Versions.", map: "Page outline", fixed: "Fixed", footer: "Footer",
        themeChoose: "Choose appearance",
        failed: "That did not work.", relogin: "Please log in again.", copyOf: "copy", section: "Section",
        insert: "Insert a module here", insertAfter: "Insert a module below", missing: (list) => `Fill in first: ${list}`,
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

// The top hero is fixed: first on the page, never moved, nothing goes above it. Only the built-in hero at the top
// counts; a copy of it placed lower is a normal section. The footer is not a section: it always closes the page.
const HERO_IDS = new Set(["header", "expertise-header", "about-header"]);
const isTopHero = (layout, id) => {
    const first = layout.sections[0];
    return !!first && first.id === id && first.module === "legacy" && !first.source && HERO_IDS.has(first.id);
};
const firstMovable = (layout) => (layout.sections[0] && isTopHero(layout, layout.sections[0].id) ? 1 : 0);

// Move to a position (one step from the arrows, many from a drag): one history entry
const moveTo = (id, target) => run(async () => {
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    if (isTopHero(layout, id)) return;
    const j = Math.max(firstMovable(layout), Math.min(layout.sections.length - 1, target));
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

// Where the subject of a full-width picture sits on two screens: right (default) or left. One history entry.
const FULL_WIDTH = new Set(["header", "expertise-header", "about-header", "expertise-header-img", "about-header-img"]);
const hasFullWidthMedia = (entry) => FULL_WIDTH.has(entry.source || entry.id) || entry.module === "content.media-center";

const setFocal = (id, side) => run(async () => {
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    const next = side === "left" ? "left" : null;
    if (!entry || (entry.focal || null) === next) return;
    if (next) entry.focal = next; else delete entry.focal;
    await write(layout, `Section focal ${next || "right"}: ${sectionName(entry)}`);
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
    if (entry.focal) copy.focal = entry.focal;
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
    layout.sections.splice(Math.max(firstMovable(layout), Math.min(index, layout.sections.length)), 0, entry);
    await write(layout, `Section inserted: ${sectionName(entry)}`);
    selected = entry.id;
    reveal(entry.id);
});

async function openPicker(index) {
    const { openPicker: open } = await import("./picker.js");
    open({ onInsert: (module, version) => insertModule(index, module, version) });
}

// Scroll the page so a section is in view, its bar clear below the header
function reveal(id) {
    const node = sectionNode(id);
    if (!node) return;
    const scroller = document.querySelector(".scrollbar-container");
    const bar = scroller && window.Scrollbar ? Scrollbar.get(scroller) : null;
    const offsetTop = Math.round(chromeBottom + 24);
    if (bar) bar.scrollIntoView(node, { offsetTop, onlyScrollIfNeeded: !expanded });
    else node.scrollIntoView({ block: "nearest" });
}

//=================================== Controls ===================================//
const icon = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
    move: icon("M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"), up: icon("M12 19V5M6 11l6-6 6 6"), down: icon("M12 5v14M6 13l6 6 6-6"),
    duplicate: icon("M8 8h11v11H8zM5 16V5h11"), insert: icon("M12 5v14M5 12h14"),
    "theme-page": '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor"/></svg>',
    "theme-light": icon("M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"),
    "theme-dark": icon("M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"),
    "focal-left": icon("M3 5h18v14H3zM12 5v14M7.5 10.5a1.6 1.6 0 1 0 0 .1"),
    "focal-right": icon("M3 5h18v14H3zM12 5v14M16.5 10.5a1.6 1.6 0 1 0 0 .1"), remove: icon("M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"),
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
    // Appearance in one control, like the language switch: the chosen option shows, pressing it unfolds the others
    const current = entry.theme || "page";
    const theme = document.createElement("span");
    theme.className = "kalq-section-tools__theme kalq-theme-switch";
    theme.setAttribute("role", "group");
    theme.setAttribute("aria-label", t("theme"));
    const labels = { page: t("themePage"), light: t("themeLight"), dark: t("themeDark") };
    [current, ...["page", "light", "dark"].filter((v) => v !== current)].forEach((value) => {
        const chosen = value === current;
        const b = toolButton(`theme-${value}`, chosen ? `${t("theme")}: ${labels[value]} (${t("themeChoose")})` : `${t("theme")}: ${labels[value]}`, () => {
            if (chosen) { const open = !theme.classList.contains("is-open"); theme.classList.toggle("is-open", open); b.setAttribute("aria-expanded", open); }
            else setTheme(entry.id, value);
        });
        b.setAttribute("aria-pressed", chosen);
        if (chosen) b.setAttribute("aria-expanded", "false");
        theme.append(b);
    });
    const layout = currentLayout();
    box.append(name);
    if (!isTopHero(layout, entry.id)) box.append(toolButton("move", `${t("move")}: ${sectionName(entry)}`, (b) => toggleOutline(entry.id, b)));
    // insert: the same as the plus on the seam below this section (opens the picker, inserts directly after it)
    const index = layout.sections.findIndex((s) => s.id === entry.id);
    box.append(toolButton("duplicate", t("copy"), () => duplicate(entry.id)),
        toolButton("insert", t("insertAfter"), () => openPicker(index + 1)),
        toolButton("remove", t("remove"), () => remove(entry.id)), theme);
    // Sections with a full-width picture: where its subject sits on two screens
    if (hasFullWidthMedia(entry)) {
        const focal = document.createElement("span");
        focal.className = "kalq-section-tools__theme kalq-section-tools__focal";
        focal.setAttribute("role", "group");
        focal.setAttribute("aria-label", t("focal"));
        [["left", t("focalLeft")], ["right", t("focalRight")]].forEach(([side, label]) => {
            const b = toolButton(`focal-${side}`, label, () => setFocal(entry.id, side));
            b.setAttribute("aria-pressed", (entry.focal || "right") === side);
            focal.append(b);
        });
        box.append(focal);
    }
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
    // the open move panel is the control in use: it is never hidden (moves keep it below the header, and the header
    // stays on top of it)
    document.querySelectorAll(".kalq-section-tools:not(.is-expanded), .kalq-insert-zone").forEach((n) => {
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
    // the one "before the first section" (when there is one) sits just below the header band
    [...insertLayer.children].forEach((zone) => { const i = Number(zone.dataset.index); zone.style.top = `${Math.max(i === 0 ? chromeBottom + 26 : 0, seams[i] ?? 0)}px`; });
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
    // nothing goes above a fixed top hero: its seam has no plus
    for (let i = firstMovable(currentLayout()); i <= count; i++) {
        const zone = document.createElement("div");
        zone.className = "kalq-insert-zone";
        zone.dataset.index = i;
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

//=================================== Move: the bar grows into the page outline ===================================//
// Pressing the move control selects the section and the same bar extends downward into a small true map of the page:
// every section a block at the screen's proportion and its real height, in order, the one being moved in blue, the
// fixed top hero and the footer marked. Dragging the blue block moves it many steps, the arrows on the right one step;
// each move is one history entry. The bar is lifted into a page layer at the same spot, so no section clips it.
let expanded = null; // id of the section whose bar shows the outline
let animateNext = false; // the next render opens the outline with its growing animation
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const OUTLINE_W = 72; // px: a block's width; heights follow the page's own proportions

function toggleOutline(id) {
    if (expanded === id) return collapse(true);
    expanded = id;
    select(id);
    animateNext = true;
    render();
}

function collapse(returnFocus = false) {
    if (!expanded) return;
    const id = expanded;
    expanded = null;
    render();
    if (returnFocus) sectionNode(id)?.querySelector(".kalq-section-tools .is-move")?.focus();
}

function expand(id, { animate = false } = {}) {
    const node = sectionNode(id);
    const bar = node?.querySelector(":scope > .kalq-section-tools");
    if (!bar) { expanded = null; return; }
    const top = node.offsetTop + bar.offsetTop;
    bar.classList.add("is-expanded");
    bar.style.top = `${top}px`;
    container().append(bar);
    bar.querySelector(".is-move")?.setAttribute("aria-expanded", "true");
    const outline = buildOutline(id);
    bar.append(outline);
    if (animate && !reducedMotion.matches) requestAnimationFrame(() => requestAnimationFrame(() => outline.classList.add("is-open")));
    else outline.classList.add("is-open");
    // keys anywhere in the panel: arrows move the section, Esc folds the panel back
    bar.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); nudge(e.key === "ArrowUp" ? -1 : 1); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); collapse(true); }
    });
    // focus the moved section's row once the panel is in place (a move rebuilds the panel)
    requestAnimationFrame(() => { if (expanded === id) bar.querySelector(".kalq-outline__row.is-current")?.focus({ preventScroll: true }); });
    clearChrome();
}

function buildOutline(id) {
    const layout = currentLayout();
    const c = container();
    const scale = OUTLINE_W / (c.clientWidth || window.innerWidth);
    const outline = document.createElement("div");
    outline.className = "kalq-outline";
    const inner = document.createElement("div");
    inner.className = "kalq-outline__inner";
    const head = document.createElement("div");
    head.className = "kalq-outline__head";
    const i = layout.sections.findIndex((s) => s.id === id);
    const up = toolButton("up", t("up"), () => nudge(-1));
    const down = toolButton("down", t("down"), () => nudge(1));
    up.disabled = i <= firstMovable(layout);
    down.disabled = i >= layout.sections.length - 1;
    head.append(Object.assign(document.createElement("span"), { className: "kalq-outline__title", textContent: t("map") }), up, down);
    const list = document.createElement("div");
    list.className = "kalq-outline__list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", t("map"));
    const row = (label, height, { current = false, fixed = false, draft = false, id: rowId } = {}) => {
        const r = document.createElement("div");
        r.className = `kalq-outline__row${current ? " is-current" : ""}${fixed ? " is-fixed" : ""}${draft ? " is-draft" : ""}`;
        if (rowId) r.dataset.id = rowId;
        r.setAttribute("role", "option");
        r.setAttribute("aria-selected", current);
        const block = document.createElement("span");
        block.className = "kalq-outline__block";
        block.style.width = `${OUTLINE_W}px`;
        block.style.height = `${Math.max(5, Math.round(height * scale))}px`;
        r.append(block, Object.assign(document.createElement("span"), { className: "kalq-outline__name", textContent: label }));
        if (fixed) r.append(Object.assign(document.createElement("span"), { className: "kalq-outline__fixed", textContent: t("fixed") }));
        if (current) { r.tabIndex = 0; r.setAttribute("aria-label", `${label}, ${t("move")}`); }
        return r;
    };
    layout.sections.forEach((s) => {
        const h = sectionNode(s.id)?.offsetHeight || 0;
        if (!h && s.state === "draft" && !sectionNode(s.id)) return;
        list.append(row(sectionName(s), h || 300, { current: s.id === id, fixed: isTopHero(layout, s.id), draft: s.state === "draft", id: s.id }));
    });
    const footer = c.querySelector("footer") || document.querySelector("footer");
    if (footer) list.append(row(t("footer"), footer.offsetHeight, { fixed: true }));
    inner.append(head, list);
    outline.append(inner);
    const cur = list.querySelector(".is-current");
    cur?.addEventListener("pointerdown", startDrag);
    return outline;
}

// Arrows: one step, one history entry; the outline stays open on the moved section
async function nudge(delta) {
    const id = expanded;
    if (!id) return;
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    await moveTo(id, i + delta);
}

// Drag the blue block along the outline; dropping it moves the real section there (one history entry). The fixed
// rows (top hero, footer) stay where they are: nothing goes above the hero or below the footer.
function startDrag(e) {
    if (!expanded) return;
    e.preventDefault();
    const rowEl = e.currentTarget;
    const list = rowEl.parentElement;
    const layout = currentLayout();
    const sectionsRows = [...list.children].filter((r) => r.dataset.id);
    const others = sectionsRows.filter((r) => r !== rowEl);
    rowEl.setPointerCapture(e.pointerId);
    rowEl.classList.add("is-dragging");
    const startY = e.clientY;
    let target = sectionsRows.indexOf(rowEl);
    const marker = document.createElement("div");
    marker.className = "kalq-outline__marker";
    const lo = firstMovable(layout), hi = layout.sections.length - 1;
    const move = (ev) => {
        rowEl.style.transform = `translateY(${ev.clientY - startY}px)`;
        let k = others.findIndex((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (k < 0) k = others.length;
        target = Math.max(lo, Math.min(hi, k));
        list.insertBefore(marker, others[target] || list.querySelector(".kalq-outline__row.is-fixed:last-child") || null);
    };
    const up = () => {
        rowEl.removeEventListener("pointermove", move);
        rowEl.removeEventListener("pointerup", up);
        rowEl.removeEventListener("pointercancel", up);
        marker.remove();
        rowEl.style.transform = "";
        rowEl.classList.remove("is-dragging");
        moveTo(expanded, target);
    };
    rowEl.addEventListener("pointermove", move);
    rowEl.addEventListener("pointerup", up);
    rowEl.addEventListener("pointercancel", up);
}

//=================================== Selection and keys ===================================//
function select(id) {
    selected = id;
    container()?.querySelectorAll(":scope > section[data-section]").forEach((s) => s.classList.toggle("kalq-section-selected", s.dataset.section === id));
}

// Clicking a section's background (not its text, links or controls) in edit mode selects it
function onPointerDown(e) {
    if (!editing() || e.target.closest(".kalq-picker, .kalq-toolbar, .kalq-panel, .kalq-styles")) return;
    // a theme choice left open folds back
    document.querySelectorAll(".kalq-theme-switch.is-open").forEach((sw) => { if (!sw.contains(e.target)) sw.classList.remove("is-open"); });
    if (e.target.closest(".kalq-section-tools.is-expanded")) return;
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
    if (!editing() || typing(e.target) || e.target.closest?.(".kalq-picker, .kalq-outline")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopImmediatePropagation(); return e.shiftKey ? redo() : undo(); }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); e.stopImmediatePropagation(); return redo(); }
    if (e.key === "Escape" && expanded) { e.preventDefault(); e.stopImmediatePropagation(); collapse(true); return; }
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
    if (!editing() || !container()) { insertLayer?.remove(); expanded = null; return; }
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
    if (expanded) expand(expanded, { animate: animateNext }); // after a move the outline stays open on the section
    animateNext = false;
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
    collab.on("page", () => { selected = null; expanded = null; render(); });
    document.addEventListener("pointerdown", onPointerDown, true);
    // A click outside the open panel folds it back, after the click has reached its target (a button on another
    // section's bar still does what it says)
    document.addEventListener("click", (e) => { if (expanded && !e.target.closest(".kalq-section-tools.is-expanded")) setTimeout(() => collapse(false)); }, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", () => { measureChrome(); placeInserts(); });
    const scroller = document.querySelector(".scrollbar-container");
    const bar = scroller && window.Scrollbar ? Scrollbar.get(scroller) : null;
    bar?.addListener(clearChrome);
    if (!bar) window.addEventListener("scroll", clearChrome, { passive: true });
    render();
}
