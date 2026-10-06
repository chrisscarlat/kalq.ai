// Edit mode (editors only): click a keyed text block to edit it in place, replace images and videos.
// Saves go straight to Supabase with the editor's own login (RLS: editors only, as themselves) and are live for
// everyone at once: the page channel only says "this block changed", every browser then reloads it from the server.
// While someone edits a block, the others see it locked (see setLock in collab.js).
import { applyDirect, setLocalContent, shownStyleId, storedEntry, styleMediaOf } from "./content.js";
import { styleKey } from "./styleMedia.js";
import { recordUndo } from "./sections.js";
import { getActive } from "./variants.js";
import { editableHtml, renderBlock, serializeBlock } from "./blocks.js";
import { applyLanguage, currentLang, EDITOR_LANG } from "./i18n.js";
import { progressLine, showDone, uploadMedia } from "./upload.js";
import { sanitizeSvg } from "../lib/svg-sanitize.js";

const MAX_BYTES = 50 * 1024 * 1024;
// Every slot takes an image or a video
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm";
const HERO = ".header, .expertise_header, .about_header";

const TEXT = {
    de: {
        edit: "Bearbeiten (E)", saved: "Gespeichert", failed: "Speichern fehlgeschlagen",
        locked: (n) => `${n} bearbeitet gerade`, relogin: "Bitte melden Sie sich erneut an, um zu bearbeiten.",
        forStyle: (l) => `Stil ${l}`, useFor: "Verwenden für …", useOnly: "Nur dieses Feld", useHeroes: "Alle Heros", useImages: "Alle Bilder außer Heros", useAll: "Alles",
        useConfirm: (n, l) => `${n} Felder in Stil ${l} mit dieser Datei füllen?`, useNone: "Hier ist noch keine Datei.", useDone: (n) => `${n} Felder gefüllt.`, useNothing: "Keine weiteren Felder dieser Art.",
        replace: "Ersetzen", add: "Bild oder Video hinzufügen", remove: "Entfernen", uploading: "Wird hochgeladen", tooLarge: "Die Datei ist größer als 50 MB.",
        empty: "Leerer Text wird nicht gespeichert.", marquee: "Laufschrift",
        svgAdd: "SVG-Logo hochladen", svgBad: "Diese Datei ist kein verwendbares SVG.",
    },
    en: {
        edit: "Edit (E)", saved: "Saved", failed: "Could not save",
        locked: (n) => `${n} is editing`, relogin: "Please log in again to edit.",
        forStyle: (l) => `Style ${l}`, useFor: "Use for …", useOnly: "This slot only", useHeroes: "All heroes", useImages: "All images except heroes", useAll: "Everything",
        useConfirm: (n, l) => `Fill ${n} slots in style ${l} with this file?`, useNone: "There is no file here yet.", useDone: (n) => `${n} slots filled.`, useNothing: "No other slots of this kind.",
        replace: "Replace", add: "Add image or video", remove: "Remove", uploading: "Uploading", tooLarge: "The file is larger than 50 MB.",
        empty: "Empty text is not saved.", marquee: "Marquee text",
        svgAdd: "Upload SVG logo", svgBad: "This file is not a usable SVG.",
    },
};
const t = (key) => TEXT[EDITOR_LANG][key];

let collab;
let on = false;
let editing = null; // { el, key, original }
let button;
let locks = new Map(); // key -> person editing it

const keyOf = (node) => node.dataset.kalqKey;
const typeOf = (node) => node.dataset.kalqType || "text";
const pageOf = (key) => (key.startsWith("site.") ? "site" : collab.page);
const isTranslated = (node) => node.hasAttribute("data-i18n") || node.hasAttribute("data-i18n-marquee") || node.hasAttribute("data-kalq-lang");
const label = (key) => `Edited ${key.split(".").slice(1).join(" ")}`;

// The saved form of some rendered HTML, to tell whether an edit changed anything
const savedForm = (node, html) => {
    const probe = document.createElement("div");
    if (node.dataset.kalqFormat) probe.dataset.kalqFormat = node.dataset.kalqFormat;
    probe.innerHTML = html;
    if (probe.dataset.kalqFormat === "lines") probe.innerHTML = editableHtml(probe); // rendered lines back to line<br>line
    return serializeBlock(probe);
};

async function editorSession() {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    return session && session.user?.app_metadata?.role === "editor" ? session : null;
}

// One revision batch: the block row (first save creates it) and one revision per language. Every edit is also one
// step of the editor's undo (js/sections.js): what the block held before, per language (or its media), so ⌘Z writes
// it back in place, without re-rendering the page. before: what the page showed before, when the store has none yet
// (a built-in text never edited).
async function save(key, type, langs, content, { undo = true, before = null, batchLabel = null } = {}) {
    const session = await editorSession();
    if (!session) throw new Error("relogin");
    const page = pageOf(key);
    const prev = storedEntry(key);
    const was = Object.fromEntries(langs.map((lang) => [lang ?? "media", lang == null ? (prev?.media ?? before ?? "") : (prev?.[lang] ?? before ?? "")]));
    const { error: blockError } = await collab.sb.from("blocks").upsert({ key, page, type }, { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const rows = langs.map((lang) => ({
        block_key: key, page, lang, content, author_id: session.user.id,
        batch_id: batch, batch_scope: "block", batch_label: batchLabel || label(key),
    }));
    const { error } = await collab.sb.from("revisions").insert(rows);
    if (error) throw error;
    langs.forEach((lang) => setLocalContent(key, lang, content, type));
    collab.broadcast("content", { keys: [key], color: collab.me.color });
    if (undo) recordUndo({ kind: "block", key, type, langs, before: was, after: content, label: label(key) });
}

// Undo or redo of an edit (js/sections.js): only while the block still holds what that edit left; one new revision
// per language with the other value, shown at once. false: the block changed since (someone else, or later).
export async function restoreBlock(step, dir) {
    if (step.kind === "batch") { // every slot as that fill left it, then all of them back
        const fits = (st) => { const now = storedEntry(st.key)?.media ?? ""; return now === (dir === "undo" ? st.after : st.before.media); };
        if (!step.steps.every(fits)) return false;
        await saveMany(step.steps.map((st) => ({ key: st.key, type: st.type, content: dir === "undo" ? st.before.media : st.after })), `${dir === "undo" ? "Undo" : "Redo"}: ${step.label}`, { undo: false });
        applyDirect(document);
        replaceButtons();
        return true;
    }
    const now = storedEntry(step.key);
    const current = (lang) => (lang == null ? now?.media ?? "" : now?.[lang] ?? "");
    const target = (lang) => (dir === "undo" ? step.before[lang ?? "media"] : step.after);
    const expect = (lang) => (dir === "undo" ? step.after : step.before[lang ?? "media"]);
    if (!step.langs.every((lang) => current(lang) === expect(lang))) return false;
    for (const lang of step.langs) {
        await save(step.key, step.type, [lang], target(lang), { undo: false, batchLabel: `${dir === "undo" ? "Undo" : "Redo"}: ${step.label}` });
    }
    applyDirect(document);
    replaceButtons();
    return true;
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
    else if (e.key === "Enter") {
        // Paragraph blocks: Enter starts a paragraph, Shift+Enter breaks the line. Elsewhere Enter breaks the line.
        e.preventDefault();
        const paragraphs = editing?.el.dataset.kalqFormat === "paragraphs";
        document.execCommand(paragraphs && !e.shiftKey ? "insertParagraph" : "insertLineBreak");
    }
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
    // Line blocks are edited as plain "line<br>line"; new paragraphs become <p>
    if (node.dataset.kalqFormat === "lines") node.innerHTML = editableHtml(node);
    document.execCommand("defaultParagraphSeparator", false, "p");
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

    const before = savedForm(node, original);
    const after = serializeBlock(node);
    if (!keep || after === before) { node.innerHTML = original; return; }
    if (!node.textContent.trim()) { node.innerHTML = original; collab.toast(t("empty"), "error"); return; }

    renderBlock(node, after);
    // Translated blocks save the language being shown, the others (numbers, email) both languages
    const langs = isTranslated(node) ? [currentLang()] : ["de", "en"];
    try {
        await save(key, "text", langs, after, { before });
        applyDirect(document); // e.g. the mailto link follows an edited email
        collab.toast(t("saved"));
    } catch (error) {
        node.innerHTML = original;
        fail(error);
    }
}

//=================================== Settings ===================================//
// A module's number setting (a slider in edit mode): shown while dragging, saved for both languages on release
function onSettingInput(e) {
    const input = e.target.closest?.("input[data-kalq-setting]");
    if (!input) return;
    const value = `${input.value}${input.dataset.kalqUnit || ""}`;
    const out = input.parentElement.querySelector("output");
    if (out) out.textContent = value;
    const target = input.dataset.kalqTarget ? input.closest("section")?.querySelector(input.dataset.kalqTarget) : null;
    if (target) target.style.opacity = String(input.value / 100);
}

async function onSettingChange(e) {
    const input = e.target.closest?.("input[data-kalq-setting]");
    if (!input || !on) return;
    const key = input.dataset.kalqSetting;
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    try {
        await save(key, "text", ["de", "en"], String(input.value));
        collab.toast(t("saved"));
    } catch (error) {
        fail(error);
    }
}

//=================================== Media ===================================//
// The slot element can be swapped (image <-> video), so always look it up by key
const slot = (key) => document.querySelector(`[data-kalq-key="${CSS.escape(key)}"]`);
// what a media slot shows now (for undo): its stored file, else the page's own (the HTML's)
const shownUrl = (key) => { const n = slot(key); return styleMediaOf(key) || n?.dataset.kalqDefault || n?.getAttribute("src") || n?.querySelector("video, img")?.getAttribute("src") || ""; };
// a picture or video is written for the shown style (js/styleMedia.js): "<slot>@<style id>"
const mediaKey = (key) => (shownStyleId() ? styleKey(key, shownStyleId()) : key);
const isHolderNode = (node) => node.classList.contains("hero_media") || node.classList.contains("kalq-media-slot");
const isEmptySlot = (node) => isHolderNode(node) && !node.querySelector(":scope > img, :scope > video");

function replaceButtons() {
    document.querySelectorAll(".kalq-media-tools").forEach((b) => b.remove());
    if (!on) return;
    document.querySelectorAll('[data-kalq-type="image"], [data-kalq-type="video"]').forEach((node) => {
        const key = keyOf(node);
        const host = node.classList.contains("hero_media") ? node.closest("section")
            : node.tagName === "IMG" || node.tagName === "VIDEO" ? node.parentElement : node;
        const tools = document.createElement("div");
        tools.className = "kalq-media-tools";
        if (host.matches(HERO)) tools.classList.add("is-hero"); // vertical centre, right
        const add = (label, cls, fn) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = cls;
            btn.textContent = label;
            btn.dataset.forKey = key;
            btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(btn); });
            tools.append(btn);
        };
        add(isEmptySlot(node) ? t("add") : t("replace"), "kalq-replace", (btn) => pickFile(key, btn));
        // pictures are the shown style's own: say which style this slot is being filled for
        const style = getActive();
        if (style) {
            const note = document.createElement("span");
            note.className = "kalq-media-style";
            note.textContent = t("forStyle")(style.letter);
            tools.append(note);
        }
        if (!isEmptySlot(node) && styleMediaOf(key)) {
            add(t("remove"), "kalq-replace kalq-remove", () => setSlot(key, ""));
            add(t("useFor"), "kalq-replace kalq-use", (btn) => useMenu(key, btn));
        }
        host.append(tools);
    });
    // SVG logos (a module's data-kalq-type="svg" box): uploaded as a file, kept as sanitised SVG text in the block
    document.querySelectorAll('[data-kalq-type="svg"]').forEach((node) => {
        const key = keyOf(node);
        const tools = document.createElement("div");
        tools.className = "kalq-media-tools is-svg";
        const add = (label, cls, fn) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = cls;
            btn.textContent = label;
            btn.dataset.forKey = key;
            btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
            tools.append(btn);
        };
        const filled = !!node.querySelector(":scope > svg");
        add(filled ? t("replace") : t("svgAdd"), "kalq-replace", () => pickSvg(key));
        if (filled) add(t("remove"), "kalq-replace kalq-remove", () => saveSvg(key, ""));
        node.append(tools);
    });
}

function pickSvg(key) {
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/svg+xml,.svg";
    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        const clean = sanitizeSvg(await file.text());
        if (!clean) return collab.toast(t("svgBad"), "error");
        saveSvg(key, clean);
    });
    input.click();
}

// Both languages the same; the page shows it at once (js/content.js applyDirect draws svg boxes)
async function saveSvg(key, clean) {
    try {
        await save(key, "text", ["de", "en"], clean);
        applyDirect(document);
        replaceButtons();
        collab.toast(t("saved"));
    } catch (error) {
        fail(error);
    }
}

async function setSlot(key, url) {
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    const node = slot(key);
    try {
        await save(mediaKey(key), typeOf(node), [null], url, { before: shownUrl(key) });
        applyDirect(document);
        replaceButtons();
        collab.toast(t("saved"));
    } catch (error) {
        fail(error);
    }
}

// "Use for": this slot's file also in other slots, within the shown style only: all heroes (Home's and every Hero
// card's background; a hero without a background is not one of them), all images except heroes, or everything.
// People's and brands' pictures (portraits, logos) are never filled. One batch, one step of undo.
function useMenu(key, btn) {
    document.querySelector(".kalq-use-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "kalq-use-menu";
    menu.setAttribute("role", "menu");
    [["only", t("useOnly")], ["heroes", t("useHeroes")], ["images", t("useImages")], ["all", t("useAll")]].forEach(([target, text]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.dataset.target = target;
        b.textContent = text;
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); menu.remove(); if (target !== "only") useFor(key, target); });
        menu.append(b);
    });
    btn.closest(".kalq-media-tools").append(menu);
    menu.querySelector("button").focus();
    const off = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("pointerdown", off, true); } };
    document.addEventListener("pointerdown", off, true);
}

async function useFor(key, target) {
    const url = styleMediaOf(key);
    if (!url) return collab.toast(t("useNone"), "error");
    const style = getActive();
    const { siteMediaSlots, targetSlots } = await import("./mediaSlots.js");
    const keys = targetSlots(await siteMediaSlots(), target).map((s) => s.key).filter((k) => k !== key && styleMediaOf(k) !== url);
    if (!keys.length) return collab.toast(t("useNothing"));
    if (!window.confirm(t("useConfirm")(keys.length, style?.letter || ""))) return;
    try {
        await saveMany(keys.map((k) => ({ key: mediaKey(k), type: /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image", content: url, before: styleMediaOf(k) })), `Used one file for ${keys.length} slots`);
        applyDirect(document);
        replaceButtons();
        collab.toast(t("useDone")(keys.length));
    } catch (error) {
        fail(error);
    }
}

// Several picture slots in one batch (one version, one step of undo)
async function saveMany(items, batchLabel, { undo = true } = {}) {
    const session = await editorSession();
    if (!session) throw new Error("relogin");
    const blocks = items.map(({ key, type }) => ({ key, page: pageOf(key), type }));
    const { error: blockError } = await collab.sb.from("blocks").upsert(blocks, { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const rows = items.map(({ key, content }) => ({ block_key: key, page: pageOf(key), lang: null, content, author_id: session.user.id, batch_id: batch, batch_scope: "page", batch_label: batchLabel }));
    const { error } = await collab.sb.from("revisions").insert(rows);
    if (error) throw error;
    items.forEach(({ key, type, content }) => setLocalContent(key, null, content, type));
    collab.broadcast("content", { keys: items.map((i) => i.key), color: collab.me.color });
    if (undo) recordUndo({ kind: "batch", label: batchLabel, steps: items.map(({ key, type, content, before }) => ({ kind: "block", key, type, langs: [null], before: { media: before || "" }, after: content, label: label(key) })) });
}

function pickFile(key, btn) {
    if (locks.has(key)) return collab.toast(t("locked")(locks.get(key).name), "error");
    // a slot may say what to upload (data-kalq-upload-hint) and when a file is too large to be good (a warning only)
    const target = slot(key);
    const hint = target?.dataset.kalqUploadHint;
    const warnAt = Number(target?.dataset.kalqUploadWarn) || 0;
    if (hint) collab.toast(hint);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) return collab.toast(t("tooLarge"), "error");
        if (warnAt && file.size > warnAt) collab.toast(target.dataset.kalqUploadWarnText || t("tooLarge"), "error"); // warned, still uploaded
        btn.disabled = true;
        btn.textContent = t("uploading");
        collab.setLock(key);
        // The thin line along the bottom of the image while it uploads, a tick when done
        const host = btn.closest(".kalq-media-tools")?.parentElement || slot(key);
        const progress = progressLine(host);
        try {
            if (!(await editorSession())) throw new Error("relogin");
            const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
            const path = `${pageOf(key)}/${key}/${Date.now()}-${safe}`;
            const url = await uploadMedia(collab.sb, path, file, (p) => {
                progress.set(p);
                btn.textContent = `${t("uploading")} ${Math.round(p * 100)} %`;
            });
            await save(mediaKey(key), typeOf(slot(key)), [null], url, { before: shownUrl(key) });
            applyDirect(document);
            replaceButtons();
            showDone(host);
            collab.toast(t("saved"));
        } catch (error) {
            fail(error);
        } finally {
            progress.done();
            collab.setLock(null);
            replaceButtons();
        }
    });
    input.click();
}

//=================================== Mode, locks ===================================//
function setMode(next) {
    on = next;
    if (on) collab.setActiveMode("edit");
    document.body.classList.toggle("kalq-edit", on);
    applyDirect(document);
    button.setAttribute("aria-pressed", on);
    if (!on) stopEditing(true);
    replaceButtons();
}

// In edit mode a click on a keyed text block edits it, links and Barba do not fire
function onClick(e) {
    if (!on) return;
    const node = e.target.closest?.("[data-kalq-key]");
    if (!node || e.target.closest(".kalq-media-tools, .kalq-toolbar")) return;
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
    document.addEventListener("input", onSettingInput);
    document.addEventListener("change", onSettingChange);
    document.addEventListener("kalq:language", () => { labelButton(); replaceButtons(); });
    collab.on("key:e", () => button.click());
    document.addEventListener("kalq:edit-on", () => { if (!on) setMode(true); }); // e.g. a module inserted from the toolbar's whole-site picker
    collab.on("escape", () => { if (on) setMode(false); });
    collab.on("locks", showLocks);
    collab.on("mode", (mode) => { if (mode !== "edit" && on) setMode(false); });
    collab.on("leave", () => stopEditing(true));
    collab.on("page", () => replaceButtons());
    document.addEventListener("kalq:layout", () => replaceButtons()); // inserted or copied sections get their media buttons
}
