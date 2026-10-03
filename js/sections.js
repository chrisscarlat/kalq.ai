// Page builder, part 1 (editors only, in edit mode): every section gets move up, move down, duplicate and remove,
// and copies and new sections a draft/live switch. Each action writes one new revision of the page's layout block
// (plus the copied blocks for a duplicate) in one page batch, so it shows in Versions and can be restored.
// Nothing is deleted: a removed section leaves the layout, its blocks stay, a restore brings it back with them.
import { applyStoredLayout, setLocalContent, storedEntry, storedKeys } from "./content.js";
import { currentLang } from "./i18n.js";
import { collectTemplates, copyKey, layoutKey, newSectionId, parseLayout, resolveLayout, sectionPrefix } from "./layout.js";

const TEXT = {
    de: {
        up: "Nach oben", down: "Nach unten", duplicate: "Duplizieren", remove: "Entfernen", draft: "Entwurf",
        publish: "Veröffentlichen", toDraft: "Zum Entwurf", confirmRemove: "Diesen Abschnitt von der Seite nehmen? Er bleibt in den Versionen und lässt sich wiederherstellen.",
        failed: "Das hat nicht geklappt.", relogin: "Bitte melden Sie sich erneut an.", copy: "Kopie", section: "Abschnitt",
        names: { header: "Hero", about: "Über Kalq", expertise: "Plattform-Liste", belief: "Haltung", social: "Social", "expertise-header": "Kopf",
            "expertise-header-img": "Bild", "expertise-container": "Karten", "about-header": "Kopf", "about-header-img": "Bild", "about-goals": "Ziele",
            "about-wedo": "Was wir tun", "about-awwards": "Logos", legal: "Text" },
    },
    en: {
        up: "Move up", down: "Move down", duplicate: "Duplicate", remove: "Remove", draft: "Draft",
        publish: "Publish", toDraft: "Back to draft", confirmRemove: "Take this section off the page? It stays in Versions and can be restored.",
        failed: "That did not work.", relogin: "Please log in again.", copy: "copy", section: "Section",
        names: { header: "Hero", about: "About Kalq", expertise: "Platform list", belief: "Belief", social: "Social", "expertise-header": "Header",
            "expertise-header-img": "Image", "expertise-container": "Cards", "about-header": "Header", "about-header-img": "Image", "about-goals": "Goals",
            "about-wedo": "What we do", "about-awwards": "Logos", legal: "Text" },
    },
};
const t = (key) => TEXT[currentLang() === "en" ? "en" : "de"][key];

let collab;
let busy = false;

const container = () => { const all = document.querySelectorAll('[data-barba="container"]'); return all[all.length - 1] || null; };
const pageName = () => container()?.dataset.page;

// The layout as it stands, drafts included (editors get them from /api/content)
function currentLayout() {
    const page = pageName();
    return resolveLayout(parseLayout(storedEntry(layoutKey(page))?.media), collectTemplates(container()));
}

function sectionName(entry) {
    const names = t("names");
    if (entry.module === "legacy" && !entry.source) return names[entry.id] || entry.id;
    if (entry.module === "legacy") return `${names[entry.source] || entry.source} (${t("copy")})`;
    return entry.module;
}

async function editorSession() {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    return session && session.user?.app_metadata?.role === "editor" ? session : null;
}

// One batch: the new layout, plus any copied blocks
async function write(layout, label, extra = []) {
    const session = await editorSession();
    if (!session) throw new Error("relogin");
    const page = pageName();
    const key = layoutKey(page);
    const blocks = [{ key, page, type: "layout" }, ...extra.map((r) => ({ key: r.key, page: r.page, type: r.type }))];
    const { error: blockError } = await collab.sb.from("blocks").upsert(blocks, { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const content = JSON.stringify({ v: 1, sections: layout.sections, removed: layout.removed });
    const rows = [{ block_key: key, page, lang: null, content }, ...extra.map((r) => ({ block_key: r.key, page: r.page, lang: r.lang, content: r.content }))]
        .map((r) => ({ ...r, author_id: session.user.id, batch_id: batch, batch_scope: "page", batch_label: label }));
    const { error } = await collab.sb.from("revisions").insert(rows);
    if (error) throw error;
    setLocalContent(key, null, content, "layout");
    extra.forEach((r) => setLocalContent(r.key, r.lang, r.content, r.type));
    applyStoredLayout();
    collab.broadcast("content", { keys: [key], color: collab.me.color });
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

const move = (id, delta) => run(async () => {
    const layout = currentLayout();
    const i = layout.sections.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= layout.sections.length) return;
    [layout.sections[i], layout.sections[j]] = [layout.sections[j], layout.sections[i]];
    await write(layout, `Section ${delta < 0 ? "moved up" : "moved down"}: ${sectionName(layout.sections[j])}`);
});

const remove = (id) => run(async () => {
    if (!window.confirm(t("confirmRemove"))) return;
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    if (!entry) return;
    layout.sections = layout.sections.filter((s) => s.id !== id);
    if (entry.module === "legacy" && !entry.source && !layout.removed.includes(id)) layout.removed.push(id);
    await write(layout, `Section removed: ${sectionName(entry)}`);
});

const setState = (id, state) => run(async () => {
    const layout = currentLayout();
    const entry = layout.sections.find((s) => s.id === id);
    if (!entry || entry.state === state) return;
    entry.state = state;
    await write(layout, `Section ${state === "live" ? "published" : "to draft"}: ${sectionName(entry)}`);
});

// A copy starts as a draft, with its own copies of every stored block of the section
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
    const own = sectionPrefix(page, entry.id);
    const newKey = (key) => (key.startsWith(own) ? sectionPrefix(page, copyId) + key.slice(own.length) : copyKey(page, copyId, key));
    // The blocks of the section: its own prefixed keys, or for a built-in section the keys found in its HTML
    const node = container().querySelector(`:scope > section[data-section="${CSS.escape(id)}"]`);
    const keys = new Set(storedKeys().filter((k) => k.startsWith(own)));
    node?.querySelectorAll("[data-kalq-key]").forEach((el) => keys.add(el.dataset.kalqKey));
    const extra = [];
    keys.forEach((key) => {
        const stored = storedEntry(key);
        if (!stored) return; // never edited: the copy shows the same built-in text
        const target = newKey(key);
        if (stored.type === "text") ["de", "en"].forEach((lang) => { if (stored[lang] != null) extra.push({ key: target, page, type: "text", lang, content: stored[lang] }); });
        else if (stored.media != null) extra.push({ key: target, page, type: stored.type, lang: null, content: stored.media });
    });
    layout.sections.splice(i + 1, 0, copy);
    await write(layout, `Section duplicated: ${sectionName(entry)}`, extra);
});

//=================================== Controls ===================================//
const icon = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
    up: icon("M12 19V5M6 11l6-6 6 6"), down: icon("M12 5v14M6 13l6 6 6-6"),
    duplicate: icon("M8 8h11v11H8zM5 16V5h11"), remove: icon("M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"),
};

function tools(entry, index, count) {
    const box = document.createElement("div");
    box.className = "kalq-section-tools";
    box.setAttribute("role", "toolbar");
    box.setAttribute("aria-label", `${t("section")}: ${sectionName(entry)}`);
    const name = document.createElement("span");
    name.className = "kalq-section-tools__name";
    name.textContent = sectionName(entry);
    box.append(name);
    const button = (kind, label, fn, disabled = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `kalq-section-tools__btn is-${kind}`;
        b.title = label;
        b.setAttribute("aria-label", `${label}: ${sectionName(entry)}`);
        b.innerHTML = ICONS[kind] || "";
        if (!ICONS[kind]) b.textContent = label;
        b.disabled = disabled;
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
        box.append(b);
    };
    button("up", t("up"), () => move(entry.id, -1), index === 0);
    button("down", t("down"), () => move(entry.id, 1), index === count - 1);
    button("duplicate", t("duplicate"), () => duplicate(entry.id));
    button("remove", t("remove"), () => remove(entry.id));
    // Copies and new sections: draft or live; built-in sections are always live
    if (!(entry.module === "legacy" && !entry.source)) {
        if (entry.state === "draft") {
            const tag = document.createElement("span");
            tag.className = "kalq-section-tools__draft";
            tag.textContent = t("draft");
            box.append(tag);
            button("publish", t("publish"), () => setState(entry.id, "live"));
        } else {
            button("todraft", t("toDraft"), () => setState(entry.id, "draft"));
        }
    }
    return box;
}

export function render() {
    document.querySelectorAll(".kalq-section-tools").forEach((n) => n.remove());
    if (!document.body.classList.contains("kalq-edit") || !container()) return;
    const layout = currentLayout();
    const sections = [...container().querySelectorAll(":scope > section[data-section]")];
    sections.forEach((node) => {
        const index = layout.sections.findIndex((s) => s.id === node.dataset.section);
        if (index < 0) return;
        node.prepend(tools(layout.sections[index], index, layout.sections.length));
    });
}

export function initSections(api) {
    collab = api;
    // Edit mode on or off, a page change, a layout change (own, someone else's, a restore), a language switch
    new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("kalq:layout", render);
    document.addEventListener("kalq:language", render);
    collab.on("page", render);
    render();
}
