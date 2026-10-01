// Version history (everyone): the Versions tab lists save batches, a click previews the page as it was right
// after that batch. Editors can restore one block, the page or the whole site; a restore only ever adds new
// revisions (see restore_to in supabase/migrations), so it can itself be undone the same way.
import { enterPreview, exitPreview, isPreviewing } from "./content.js";
import { currentLang } from "./i18n.js";

const PAGE_NAMES = {
    de: { home: "Start", platform: "Plattform", company: "Unternehmen", impressum: "Impressum", datenschutz: "Datenschutz", site: "Website" },
    en: { home: "Home", platform: "Platform", company: "Company", impressum: "Legal notice", datenschutz: "Privacy", site: "site" },
};
const TEXT = {
    de: {
        tab: "Versionen", thisPage: "Diese Seite", site: "Gesamte Website", empty: "Noch keine Versionen.",
        previewing: (when, who) => `Vorschau ${when}, bearbeitet von ${who}`,
        restoreBlock: "Block wiederherstellen", restorePage: "Seite wiederherstellen", restoreSite: "Website wiederherstellen",
        exit: "Vorschau beenden", restored: "Wiederhergestellt", same: "Ist schon auf diesem Stand.",
        confirmSite: "Die gesamte Website auf diesen Stand zurücksetzen? Das lässt sich über die Versionen wieder rückgängig machen.",
        failed: "Das hat nicht geklappt.", initial: "Erster Inhalt der Website", edited: (w) => `Bearbeitet: ${w}`,
        restoredTo: (w, when) => `${w} wiederhergestellt auf ${when}`, system: "Kalq",
    },
    en: {
        tab: "Versions", thisPage: "This page", site: "Whole site", empty: "No versions yet.",
        previewing: (when, who) => `Previewing ${when}, edited by ${who}`,
        restoreBlock: "Restore this block", restorePage: "Restore this page", restoreSite: "Restore whole site",
        exit: "Exit preview", restored: "Restored", same: "Already at this version.",
        confirmSite: "Reset the whole site to this version? You can undo it from the versions again.",
        failed: "That did not work.", initial: "Initial site content", edited: (w) => `Edited ${w}`,
        restoredTo: (w, when) => `Restored ${w} to ${when}`, system: "Kalq",
    },
};
const lang = () => (currentLang() === "en" ? "en" : "de");
const t = (key) => TEXT[lang()][key];

let collab, panel;
let scope = "page"; // "page" | "site"
let batches = [];
let loadedFor = null; // "page|scope" the list was loaded for, so an empty history does not reload forever
let people = {};
let previewing = null; // the batch being previewed
let banner = null;

const fmt = (iso) => new Date(iso).toLocaleString(lang() === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const blockName = (key) => key.split(".").slice(1).join(" ").replace(/-/g, " ");

function author(batch) {
    const id = batch.author_id;
    if (!id) return { name: t("system"), color: "#555", emoji: "✳" };
    const live = collab.peers.find((p) => p.uid === id);
    if (live) return live;
    const p = people[id];
    return { name: p?.name || "Editor", avatar_url: p?.avatar_url, color: p?.color || "#3B82F6" };
}

// Labels are stored in English; shown in the current language
function describe(batch) {
    const label = batch.batch_label || "";
    if (label === "Initial site content") return t("initial");
    const restored = label.match(/^Restored (\S+) to (.+)$/);
    if (restored) {
        const what = PAGE_NAMES[lang()][restored[1]] || blockName(restored[1]);
        return t("restoredTo")(what, fmt(restored[2]));
    }
    if (label.startsWith("Edited ")) return t("edited")(label.slice(7));
    return label || `${batch.row_count} ×`;
}

function avatarNode(p) {
    const node = document.createElement("span");
    node.className = "kalq-avatar kalq-avatar--mini";
    node.style.setProperty("--c", p.color);
    node.style.setProperty("--fg", collab.textOn(p.color));
    if (p.avatar_url) {
        const img = document.createElement("img");
        img.src = p.avatar_url; img.alt = ""; img.referrerPolicy = "no-referrer";
        node.append(img);
    } else {
        node.textContent = p.emoji || p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        if (p.emoji) node.classList.add("is-emoji");
    }
    return node;
}

async function load() {
    const key = `${collab.page}|${scope}`;
    loadedFor = key;
    const res = await fetch(`/api/history?page=${encodeURIComponent(collab.page)}&scope=${scope}`, { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return; }
    const data = await res.json();
    if (loadedFor !== key) return; // page or filter changed meanwhile
    batches = data.batches || [];
    people = { ...people, ...data.people };
    panel.refresh("versions");
}

//=================================== Preview ===================================//
function showBanner(batch) {
    banner?.remove();
    const who = author(batch);
    banner = document.createElement("div");
    banner.className = "kalq-preview";
    banner.setAttribute("role", "status");
    banner.style.setProperty("--c", who.color);
    banner.style.setProperty("--fg", collab.textOn(who.color));
    const text = document.createElement("span");
    text.className = "kalq-preview__text";
    text.append(avatarNode(who), document.createTextNode(t("previewing")(fmt(batch.created_at), who.name)));
    const actions = document.createElement("span");
    actions.className = "kalq-preview__actions";
    const add = (label, fn, primary) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = primary ? "kalq-btn kalq-btn--primary" : "kalq-btn";
        b.textContent = label;
        b.addEventListener("click", fn);
        actions.append(b);
    };
    if (collab.me.kind === "editor") {
        if (batch.block_keys?.length === 1) add(t("restoreBlock"), () => restore("block"));
        add(t("restorePage"), () => restore("page"));
        add(t("restoreSite"), () => { if (window.confirm(t("confirmSite"))) restore("site"); });
    }
    add(t("exit"), () => exit(), true);
    banner.append(text, actions);
    document.body.append(banner);
}

async function preview(batch) {
    const res = await fetch(`/api/history?page=${encodeURIComponent(collab.page)}&preview=${batch.batch_id}`, { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return collab.toast(t("failed"), "error"); }
    const { blocks = [] } = await res.json();
    collab.setActiveMode("preview"); // edit and comment mode off
    previewing = batch;
    enterPreview(blocks);
    showBanner(batch);
    document.body.classList.add("kalq-previewing");
    panel.refresh("versions");
}

async function exit() {
    if (!previewing && !isPreviewing()) return;
    previewing = null;
    banner?.remove();
    banner = null;
    document.body.classList.remove("kalq-previewing");
    await exitPreview();
    panel.refresh("versions");
}

async function restore(kind) {
    const batch = previewing;
    if (!batch) return;
    const res = await fetch("/api/history", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batch.batch_id, scope: kind, page: collab.page }),
    }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return collab.toast(t("failed"), "error"); }
    const { added, keys } = await res.json();
    await exit();
    collab.toast(added ? t("restored") : t("same"));
    if (added) {
        // Everyone reloads; a block restore highlights the block
        collab.broadcast("content", { keys: keys || [], color: collab.me.color });
        load();
    }
}

//=================================== Tab ===================================//
function renderTab(body) {
    const filter = document.createElement("div");
    filter.className = "kalq-segment";
    for (const [value, label] of [["page", t("thisPage")], ["site", t("site")]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.setAttribute("aria-pressed", scope === value);
        b.addEventListener("click", () => { scope = value; batches = []; panel.refresh("versions"); load(); });
        filter.append(b);
    }
    body.append(filter);

    if (!batches.length) {
        const empty = document.createElement("p");
        empty.className = "kalq-panel__empty";
        empty.textContent = t("empty");
        body.append(empty);
        return;
    }
    batches.forEach((batch) => {
        const who = author(batch);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "kalq-panel__row";
        if (previewing?.batch_id === batch.batch_id) row.classList.add("is-current");
        const meta = document.createElement("span");
        meta.className = "kalq-panel__meta";
        const name = document.createElement("strong");
        name.textContent = who.name;
        const time = document.createElement("span");
        time.textContent = fmt(batch.created_at);
        meta.append(avatarNode(who), name, time);
        const text = document.createElement("span");
        text.className = "kalq-panel__text";
        text.textContent = describe(batch);
        row.append(meta, text);
        row.addEventListener("click", () => preview(batch));
        body.append(row);
    });
}

export function initHistory(api, sidePanel) {
    collab = api;
    panel = sidePanel;
    panel.addTab({ id: "versions", order: 10, label: () => t("tab"), render: (body) => { renderTab(body); if (loadedFor !== `${collab.page}|${scope}`) load(); } });

    collab.on("escape", () => exit());
    collab.on("mode", (mode) => { if (mode !== "preview") exit(); }); // editing an old version would be confusing
    collab.on("page", () => { previewing = null; banner?.remove(); banner = null; document.body.classList.remove("kalq-previewing"); batches = []; if (panel.isOpen) load(); });
    collab.on("content", () => { if (panel.isOpen && panel.active === "versions") load(); });
    document.addEventListener("kalq:language", () => { if (previewing) showBanner(previewing); });
}
