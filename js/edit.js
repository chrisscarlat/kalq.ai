// Edit mode (editors only): click a keyed text block to edit it in place, replace images and videos.
// Saves go straight to Supabase with the editor's own login (RLS: editors only, as themselves) and are live for
// everyone at once: the page channel only says "this block changed", every browser then reloads it from the server.
// While someone edits a block, the others see it locked (see setLock in collab.js).
import { applyDirect, sanitize, setLocalContent } from "./content.js";
import { applyLanguage, currentLang } from "./i18n.js";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = { image: "image/jpeg,image/png,image/webp,image/avif,image/gif", video: "video/mp4,video/webm" };

const TEXT = {
    de: {
        edit: "Bearbeiten (E)", saved: "Gespeichert", failed: "Speichern fehlgeschlagen",
        locked: (n) => `${n} bearbeitet gerade`, relogin: "Bitte melden Sie sich erneut an, um zu bearbeiten.",
        replace: "Ersetzen", uploading: "Wird hochgeladen", tooLarge: "Die Datei ist größer als 50 MB.",
        empty: "Leerer Text wird nicht gespeichert.", marquee: "Laufschrift",
    },
    en: {
        edit: "Edit (E)", saved: "Saved", failed: "Could not save",
        locked: (n) => `${n} is editing`, relogin: "Please log in again to edit.",
        replace: "Replace", uploading: "Uploading", tooLarge: "The file is larger than 50 MB.",
        empty: "Empty text is not saved.", marquee: "Marquee text",
    },
};
const t = (key) => TEXT[currentLang() === "en" ? "en" : "de"][key];

let collab;
let on = false;
let editing = null; // { el, key, original }
let button;
let locks = new Map(); // key -> person editing it

const keyOf = (node) => node.dataset.kalqKey;
const typeOf = (node) => node.dataset.kalqType || "text";
const pageOf = (key) => (key.startsWith("site.") ? "site" : collab.page);
const isTranslated = (node) => node.hasAttribute("data-i18n") || node.hasAttribute("data-i18n-marquee");
const label = (key) => `Edited ${key.split(".").slice(1).join(" ")}`;

const toHtml = (fragment) => {
    const box = document.createElement("div");
    box.append(fragment);
    return box.innerHTML.replace(/(<br>\s*)+$/, "").trim();
};

async function editorSession() {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    return session && session.user?.app_metadata?.role === "editor" ? session : null;
}

// One revision batch: the block row (first save creates it) and one revision per language
async function save(key, type, langs, content) {
    const session = await editorSession();
    if (!session) throw new Error("relogin");
    const page = pageOf(key);
    const { error: blockError } = await collab.sb.from("blocks").upsert({ key, page, type }, { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const rows = langs.map((lang) => ({
        block_key: key, page, lang, content, author_id: session.user.id,
        batch_id: batch, batch_scope: "block", batch_label: label(key),
    }));
    const { error } = await collab.sb.from("revisions").insert(rows);
    if (error) throw error;
    langs.forEach((lang) => setLocalContent(key, lang, content, type));
    collab.broadcast("content", { keys: [key], color: collab.me.color });
}

const fail = (error) => {
    console.error("save", error);
    collab.toast(error?.message === "relogin" ? t("relogin") : t("failed"), "error");
};

//=================================== Text ===================================//
function onKey(e) {
    e.stopPropagation(); // keep smooth-scrollbar and the shortcuts out of the text
    if (e.key === "Escape") { e.preventDefault(); stopEditing(false); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); stopEditing(true); }
    else if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); }
}

function onPaste(e) {
    e.preventDefault(); // plain text only
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
}

const onBlur = () => stopEditing(true);

function startEditing(node) {
    const key = keyOf(node);
    if (editing?.el === node) return;
    if (editing) stopEditing(true);

    // The marquee repeats its phrase 60 times, so it gets a small prompt instead
    if (node.hasAttribute("data-i18n-marquee")) {
        const current = node.textContent.trim().split(/\s+·\s*/)[0] + " ·";
        const next = window.prompt(t("marquee"), current);
        if (next && next.trim() && next.trim() !== current) {
            save(key, "text", [currentLang()], next.trim()).then(() => { applyLanguage(); collab.toast(t("saved")); }).catch(fail);
        }
        return;
    }

    editing = { el: node, key, original: node.innerHTML };
    node.contentEditable = "true";
    node.classList.add("kalq-is-editing");
    node.addEventListener("keydown", onKey);
    node.addEventListener("paste", onPaste);
    node.addEventListener("blur", onBlur);
    node.focus();
    collab.setLock(key);
}

async function stopEditing(keep) {
    if (!editing) return;
    const { el: node, key, original } = editing;
    editing = null;
    node.removeEventListener("keydown", onKey);
    node.removeEventListener("paste", onPaste);
    node.removeEventListener("blur", onBlur);
    node.contentEditable = "false";
    node.classList.remove("kalq-is-editing");
    collab.setLock(null);

    const before = toHtml(sanitize(original));
    const after = toHtml(sanitize(node.innerHTML));
    if (!keep || after === before) { node.innerHTML = original; return; }
    if (!node.textContent.trim()) { node.innerHTML = original; collab.toast(t("empty"), "error"); return; }

    node.replaceChildren(sanitize(after));
    // Translated blocks save the language being shown, the others (numbers, email) both languages
    const langs = isTranslated(node) ? [currentLang()] : ["de", "en"];
    try {
        await save(key, "text", langs, after);
        applyDirect(document); // e.g. the mailto link follows an edited email
        collab.toast(t("saved"));
    } catch (error) {
        node.innerHTML = original;
        fail(error);
    }
}

//=================================== Media ===================================//
function replaceButtons() {
    document.querySelectorAll(".kalq-replace").forEach((b) => b.remove());
    if (!on) return;
    document.querySelectorAll('[data-kalq-type="image"], [data-kalq-type="video"]').forEach((node) => {
        const host = node.tagName === "IMG" || node.tagName === "VIDEO" ? node.parentElement : node;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kalq-replace";
        btn.textContent = t("replace");
        btn.dataset.forKey = keyOf(node);
        btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pickFile(node, btn); });
        host.append(btn);
    });
}

function pickFile(node, btn) {
    const key = keyOf(node);
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    const type = typeOf(node);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT[type];
    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) return collab.toast(t("tooLarge"), "error");
        btn.disabled = true;
        btn.textContent = t("uploading");
        collab.setLock(key);
        try {
            if (!(await editorSession())) throw new Error("relogin");
            const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
            const path = `${pageOf(key)}/${key}/${Date.now()}-${safe}`;
            const { error } = await collab.sb.storage.from("site-media").upload(path, file, { contentType: file.type, upsert: false });
            if (error) throw error;
            const { data } = collab.sb.storage.from("site-media").getPublicUrl(path);
            await save(key, type, [null], data.publicUrl);
            applyDirect(document);
            collab.toast(t("saved"));
        } catch (error) {
            fail(error);
        } finally {
            btn.disabled = false;
            btn.textContent = t("replace");
            collab.setLock(null);
        }
    });
    input.click();
}

//=================================== Mode, locks ===================================//
function setMode(next) {
    on = next;
    if (on) collab.setActiveMode("edit");
    document.body.classList.toggle("kalq-edit", on);
    button.setAttribute("aria-pressed", on);
    if (!on) stopEditing(true);
    replaceButtons();
}

// In edit mode a click on a keyed text block edits it, links and Barba do not fire
function onClick(e) {
    if (!on) return;
    const node = e.target.closest?.("[data-kalq-key]");
    if (!node || e.target.closest(".kalq-replace, .kalq-toolbar")) return;
    if (typeOf(node) !== "text") return;
    e.preventDefault();
    e.stopPropagation();
    const key = keyOf(node);
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    startEditing(node);
}

function showLocks(list) {
    locks = new Map(list.map(({ key, person }) => [key, person]));
    document.querySelectorAll(".kalq-locked").forEach((node) => {
        if (!locks.has(keyOf(node))) { node.classList.remove("kalq-locked"); node.removeAttribute("data-kalq-lock"); }
    });
    locks.forEach((person, key) => {
        document.querySelectorAll(`[data-kalq-key="${CSS.escape(key)}"]`).forEach((node) => {
            node.classList.add("kalq-locked");
            node.style.setProperty("--kalq-lock", person.color);
            node.style.setProperty("--kalq-lock-fg", collab.textOn(person.color));
            node.setAttribute("data-kalq-lock", t("locked")(person.name));
        });
    });
}

export async function initEditing(api) {
    collab = api;
    button = document.createElement("button");
    button.type = "button";
    button.className = "kalq-toolbar__btn";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const labelButton = () => { button.title = t("edit"); button.setAttribute("aria-label", t("edit")); };
    labelButton();
    button.addEventListener("click", async () => {
        if (!on && !(await editorSession())) return collab.toast(t("relogin"), "error");
        setMode(!on);
    });
    collab.addTool(button, 10);

    document.addEventListener("click", onClick, true); // capture: before links and Barba
    document.addEventListener("kalq:language", () => { labelButton(); replaceButtons(); });
    collab.on("key:e", () => button.click());
    collab.on("escape", () => { if (on) setMode(false); });
    collab.on("locks", showLocks);
    collab.on("mode", (mode) => { if (mode !== "edit" && on) setMode(false); });
    collab.on("leave", () => stopEditing(true));
    collab.on("page", () => replaceButtons());
}
