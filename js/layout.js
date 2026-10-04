// Page layout: which sections a page shows and in which order. Shared by the server render (api/page.js, on a
// linkedom document) and the browser (after an edit, a restore or someone else's change), so both produce the same
// page. No browser globals here.
//
// Stored as the block "layout.<page>" (type layout), JSON:
//   { v: 1, sections: [{ id, module, version?, source?, state }], removed: [id] }
//   module "legacy":        one of the page's built-in sections (data-section="<id>" in the HTML)
//   module "legacy", source: a copy of built-in section <source>; its blocks are keyed "<page>.<id>.<key without page>"
//   other modules:          rendered by the module registry (js/modules), blocks keyed "<page>.<id>.<slot>"
//   state "draft":          editors only, never in the public page or its HTML
//   theme "light" | "dark": always that appearance; absent: follows the site's light/dark toggle
//   focal "left":           on two screens a full-width picture's subject sits on the left screen (default right)
//   removed:                built-in sections taken out (so a section added to the code later still shows up)

export const layoutKey = (page) => `layout.${page}`;

export function parseLayout(json) {
    if (!json) return null;
    try {
        const data = typeof json === "string" ? JSON.parse(json) : json;
        if (!data || !Array.isArray(data.sections)) return null;
        const sections = data.sections.filter((s) => s && typeof s.id === "string" && /^[a-z0-9-]{1,40}$/.test(s.id) && typeof s.module === "string")
            .map((s) => ({ ...s, state: s.state === "draft" ? "draft" : "live" }));
        const removed = Array.isArray(data.removed) ? data.removed.filter((id) => typeof id === "string") : [];
        return { v: 1, sections, removed };
    } catch (e) {
        return null;
    }
}

// The built-in order, from the page's own HTML
export function defaultLayout(templates) {
    return { v: 1, sections: [...templates.keys()].map((id) => ({ id, module: "legacy", state: "live" })), removed: [] };
}

// The blocks of a copied built-in section get their own keys: home.about.text -> home.s4k2q.about.text
export const copyKey = (page, sectionId, key) => `${page}.${sectionId}.${key.replace(/^[^.]+\./, "")}`;

// Keys that belong to a section instance (copies and modules); built-in sections keep their original keys
export const sectionPrefix = (page, sectionId) => `${page}.${sectionId}.`;

export const newSectionId = () => `s${Math.random().toString(36).slice(2, 7)}`;

// Built-in sections of the page, by id, as found in the HTML before any layout is applied
export function collectTemplates(container) {
    const map = new Map();
    container.querySelectorAll(":scope > section[data-section-builtin]").forEach((s) => map.set(s.getAttribute("data-section"), s));
    // Editors' pages also carry the built-in sections the layout took out, so they can come back
    const store = container.querySelector(":scope > template.kalq-sections");
    if (store) [...store.content.children].forEach((s) => { const id = s.getAttribute("data-section"); if (id && !map.has(id)) map.set(id, s); });
    return map;
}

// The layout to show: the stored one, plus built-in sections that are new in the code (not placed, not removed)
export function resolveLayout(stored, templates) {
    const layout = stored ? { ...stored, sections: [...stored.sections] } : defaultLayout(templates);
    const placed = new Set(layout.sections.filter((s) => s.module === "legacy" && !s.source).map((s) => s.id));
    const removed = new Set(layout.removed);
    const order = [...templates.keys()];
    order.forEach((id, i) => {
        if (placed.has(id) || removed.has(id)) return;
        // after the section that comes before it in the code, if that one is on the page
        const before = order.slice(0, i).reverse().find((b) => placed.has(b));
        const at = before ? layout.sections.findIndex((s) => s.id === before) + 1 : 0;
        layout.sections.splice(at, 0, { id, module: "legacy", state: "live" });
        placed.add(id);
    });
    return layout;
}

// Arrange the container: sections in layout order, drafts only for editors, copies cloned from their source.
// renderModule(entry, doc) returns an element for registry modules (or null). Returns the layout it applied.
// fresh: render registry modules again even if already on the page (visitors: a slot filled later must appear)
export function applyLayout({ doc, container, page, stored, editor = false, renderModule = () => null, fresh = false }) {
    const templates = collectTemplates(container);
    const layout = resolveLayout(stored, templates);
    const current = new Map();
    container.querySelectorAll(":scope > section[data-section]").forEach((s) => current.set(s.getAttribute("data-section"), s));

    const wanted = [];
    for (const entry of layout.sections) {
        if (entry.state === "draft" && !editor) continue;
        let node = current.get(entry.id);
        // A section already on the page is reused unless it has to change kind (a module whose version changed)
        if (node && entry.module !== "legacy" && (fresh || node.getAttribute("data-module") !== `${entry.module}:${entry.version || ""}`)) node = null;
        if (!node) {
            if (entry.module === "legacy" && !entry.source) node = templates.get(entry.id)?.cloneNode(true);
            else if (entry.module === "legacy") node = copySection(templates.get(entry.source), page, entry.id);
            else node = renderModule(entry, doc);
        }
        if (!node) continue;
        node.setAttribute("data-section", entry.id);
        if (entry.state === "draft") node.setAttribute("data-section-state", "draft");
        else node.removeAttribute("data-section-state");
        // light or dark regardless of the site toggle; no attribute: follows the page
        if (entry.theme === "light" || entry.theme === "dark") node.setAttribute("data-section-theme", entry.theme);
        else node.removeAttribute("data-section-theme");
        // where the subject of a full-width picture sits, for two screens (right unless set to left)
        if (entry.focal === "left") node.setAttribute("data-focal", "left");
        else node.removeAttribute("data-focal");
        wanted.push(node);
    }

    // Keep the editors' store of built-in sections, then put the sections in order
    const store = container.querySelector(":scope > template.kalq-sections");
    container.querySelectorAll(":scope > section[data-section]").forEach((s) => { if (!wanted.includes(s)) s.remove(); });
    let anchor = null;
    for (const node of wanted) {
        const next = anchor ? anchor.nextElementSibling : firstSectionSlot(container);
        if (next !== node) container.insertBefore(node, next);
        anchor = node;
    }
    if (store && editor) container.append(store);
    // Every section can be linked to (#s-<id>); a hero's "next section" link points at the section after it
    wanted.forEach((node, i) => {
        if (!node.getAttribute("id")) node.setAttribute("id", `s-${node.getAttribute("data-section")}`);
        node.querySelectorAll("[data-next-section]").forEach((a) => {
            const after = wanted[i + 1];
            if (after) a.setAttribute("href", `#${after.getAttribute("id") || `s-${after.getAttribute("data-section")}`}`);
            else a.remove(); // nothing below: no arrow pointing nowhere
        });
    });
    return layout;
}

// Where the first section goes: before anything that is not a section at the top of the container
function firstSectionSlot(container) {
    return [...container.children].find((c) => c.matches("section[data-section]")) || container.firstElementChild;
}

function copySection(source, page, id) {
    if (!source) return null;
    const node = source.cloneNode(true);
    node.removeAttribute("data-section-builtin");
    node.querySelectorAll("[data-kalq-key]").forEach((el) => el.setAttribute("data-kalq-key", copyKey(page, id, el.getAttribute("data-kalq-key"))));
    if (node.hasAttribute("data-kalq-key")) node.setAttribute("data-kalq-key", copyKey(page, id, node.getAttribute("data-kalq-key")));
    // ids inside must stay unique on the page
    node.querySelectorAll("[id]").forEach((el) => el.setAttribute("id", `${el.getAttribute("id")}-${id}`));
    return node;
}

// The sections of a layout as a list of ids in order (for moves and history labels)
export const sectionIds = (layout) => layout.sections.map((s) => s.id);
