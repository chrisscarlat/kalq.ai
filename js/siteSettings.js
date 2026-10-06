// Site-wide settings shown in the insert picker's left menu (js/picker.js), for every editor: the cookie bar (its mode
// and texts, moved here from the Styles panel) and the chat's send destinations. Both are site blocks ("site.*"),
// saved here as one batch each, a version like any edited text; the server writes them into every page.
import { EDITOR_LANG } from "./i18n.js";
import { setLocalContent, storedEntry } from "./content.js";
import { SEND_DESTS } from "./modules/destinations.js";

// The cookie bar's stored keys, the same as in js/dontpanic.js (data: they never change)
const NOTE_KEYS = { mode: "site.cookie.mode", notice: "site.cookie.notice", consent: "site.cookie.consent" };
const PAGE_MODE = { notice: "tell", consent: "ask" }; // the bar's markup (data-for)
// The chat's destinations: one site block each (js/modules/chat.js reads them)
export const CHAT_SITE_KEYS = Object.fromEntries(SEND_DESTS.map((d) => [d.id, `site.chat.${d.id}`]));
// The bar's script loads only when the panel needs it: if a blocker refuses it, saving still works
let dontpanic = null;
const loadDontPanic = () => (dontpanic ||= import("./dontpanic.js").catch((error) => { dontpanic = null; throw error; }));

const TEXT = {
    de: {
        cookieTitle: "Cookie-Leiste", cookieIntro: "Der Hinweis unten auf jeder Seite. Gilt für die ganze Website, in jedem Stil gleich.",
        cookieMode: "Art", cookieNotice: "Hinweis", cookieConsent: "Einwilligung",
        cookieNoticeHint: "Es werden keine Daten erhoben: eine Zeile ohne Buttons, nach 5 Sekunden verschwindet sie von selbst.",
        cookieConsentHint: "Es werden Daten erhoben: mit Akzeptieren und Ablehnen; bleibt, bis gewählt wird. Optionales lädt erst nach Akzeptieren.",
        cookieTextNotice: "Text des Hinweises", cookieTextConsent: "Text der Einwilligung", lang_de: "Deutsch", lang_en: "Englisch",
        noteBlocked: "Die Vorschau konnte nicht laden: Der Browser oder ein Blocker hat das Skript der Leiste verhindert. Speichern geht trotzdem.",
        cookiePreview: "Vorschau zeigen", cookieSave: "Hinweis speichern", cookieSaved: "Cookie-Hinweis gespeichert", cookieEmpty: "Bitte beide Sprachen ausfüllen.",
        chatTitle: "Wohin der Chat sendet", chatIntro: "Für die ganze Website: jeder Anfrage-Chat bietet die eingetragenen Wege an. Mindestens einer, sonst lässt sich ein Chat nicht veröffentlichen.",
        chatSave: "Ziele speichern", chatSaved: "Ziele gespeichert", chatInvalid: (n) => `Ungültig: ${n}`,
        failed: "Speichern fehlgeschlagen", relogin: "Bitte melden Sie sich erneut an.",
    },
    en: {
        cookieTitle: "Cookie bar", cookieIntro: "The notice at the bottom of every page. For the whole site, the same in every style.",
        cookieMode: "Kind", cookieNotice: "Notice", cookieConsent: "Consent",
        cookieNoticeHint: "No data is collected: one line, no buttons; after 5 seconds it goes by itself.",
        cookieConsentHint: "Data is collected: with Accept and Deny; it stays until one is chosen. Optional content loads only after Accept.",
        cookieTextNotice: "Notice text", cookieTextConsent: "Consent text", lang_de: "German", lang_en: "English",
        noteBlocked: "The preview could not load: the browser or a blocker stopped the bar's script. Saving still works.",
        cookiePreview: "Show preview", cookieSave: "Save notice", cookieSaved: "Cookie notice saved", cookieEmpty: "Please fill in both languages.",
        chatTitle: "Where the chat sends", chatIntro: "For the whole site: every inquiry chat offers the ways set here. At least one, or a chat cannot be published.",
        chatSave: "Save destinations", chatSaved: "Destinations saved", chatInvalid: (n) => `Not valid: ${n}`,
        failed: "Could not save", relogin: "Please log in again.",
    },
};
const t = (key) => TEXT[EDITOR_LANG][key];

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};
const plainOf = (key, lang) => { const e = storedEntry(key); return String((e && (e[lang] ?? (lang === "de" ? e.en : e.de))) || "").replace(/<[^>]+>/g, "").trim(); };

// One batch of site blocks: rows [{ key, lang, content }] (empty contents are left out)
export async function saveSiteBlocks(collab, rows, label) {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    if (!session) throw new Error("relogin");
    rows = rows.filter((r) => r.content != null);
    const keys = [...new Set(rows.map((r) => r.key))];
    const { error: blockError } = await collab.sb.from("blocks").upsert(keys.map((key) => ({ key, page: "site", type: "text" })), { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const { error } = await collab.sb.from("revisions").insert(rows.map((r) => ({ block_key: r.key, page: "site", lang: r.lang, content: r.content, author_id: session.user.id,
        batch_id: batch, batch_scope: "site", batch_label: label })));
    if (error) throw error;
    rows.forEach((r) => setLocalContent(r.key, r.lang, r.content, "text"));
    collab.broadcast("content", { keys, color: collab.me.color });
}

const failText = (error) => (error?.message === "relogin" ? t("relogin") : t("failed"));

function seg(items, current, onPick) {
    const box = el("div", { className: "kalq-seg", role: "group" });
    const draw = (value) => box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === value));
    items.forEach(([value, label]) => {
        const b = el("button", { type: "button", className: "kalq-seg__item", textContent: label });
        b.dataset.value = value;
        b.addEventListener("click", () => { onPick(value); draw(value); });
        box.append(b);
    });
    draw(current);
    return box;
}

// The cookie bar: mode, both texts in both languages, a preview on the page, its own save. onPreview: the picker
// steps aside so the bar can be seen.
export function cookiePanel(collab, { onPreview } = {}) {
    const bar = document.querySelector(".dontpanic-bar");
    const builtIn = (mode, lang) => bar?.querySelector(`.dontpanic-bar__text[data-for="${PAGE_MODE[mode]}"] [lang="${lang}"]`)?.textContent.trim() || "";
    const draft = { mode: plainOf(NOTE_KEYS.mode, "de") === "consent" ? "consent" : "notice", texts: {} };
    ["notice", "consent"].forEach((m) => ["de", "en"].forEach((l) => { draft.texts[`${m}.${l}`] = plainOf(NOTE_KEYS[m], l) || builtIn(m, l); }));
    const hint = el("p", { className: "kalq-site__hint" });
    const showHint = () => { hint.textContent = draft.mode === "consent" ? t("cookieConsentHint") : t("cookieNoticeHint"); };
    const mode = seg([["notice", t("cookieNotice")], ["consent", t("cookieConsent")]], draft.mode, (v) => { draft.mode = v; showHint(); });
    showHint();
    const text = (m, l) => {
        const id = `kalq-site-dontpanic-${PAGE_MODE[m]}-${l}`;
        const area = el("textarea", { id, className: "kalq-site__input", rows: 2, maxLength: 200, value: draft.texts[`${m}.${l}`] || "", spellcheck: true });
        area.addEventListener("input", () => { draft.texts[`${m}.${l}`] = area.value; });
        return el("label", { className: "kalq-site__field", htmlFor: id }, el("span", { textContent: `${t(m === "notice" ? "cookieTextNotice" : "cookieTextConsent")} · ${t(`lang_${l}`)}` }), area);
    };
    // the page's bar shows what is set here (before saving too)
    const toPage = async () => (await loadDontPanic()).applyNoteSettings(document, (key) => {
        if (key === NOTE_KEYS.mode) return { de: draft.mode, en: draft.mode };
        const m = key === NOTE_KEYS.notice ? "notice" : "consent";
        return { de: draft.texts[`${m}.de`], en: draft.texts[`${m}.en`] };
    });
    const preview = el("button", { type: "button", className: "kalq-btn", textContent: t("cookiePreview") });
    preview.addEventListener("click", async () => {
        try { await toPage(); onPreview?.(); (await loadDontPanic()).previewDontPanic(); }
        catch (error) { console.error("dontpanic", error); collab.toast(t("noteBlocked"), "error"); }
    });
    const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("cookieSave") });
    save.addEventListener("click", async () => {
        const m = draft.mode;
        if (!draft.texts[`${m}.de`]?.trim() || !draft.texts[`${m}.en`]?.trim()) return collab.toast(t("cookieEmpty"), "error");
        save.disabled = true;
        try {
            await saveSiteBlocks(collab, [
                ...["de", "en"].map((lang) => ({ key: NOTE_KEYS.mode, lang, content: draft.mode })),
                ...["notice", "consent"].flatMap((k) => ["de", "en"].map((lang) => ({ key: NOTE_KEYS[k], lang, content: draft.texts[`${k}.${lang}`].trim() || null }))),
            ], "Edited cookie notice");
            collab.toast(t("cookieSaved"));
            toPage().catch(() => { }); // saved; the page's bar follows when its script is there
        } catch (error) { console.error("cookie", error); collab.toast(failText(error), "error"); }
        finally { save.disabled = false; }
    });
    return el("section", { className: "kalq-site kalq-site--dontpanic" },
        el("h3", { className: "kalq-site__title", textContent: t("cookieTitle") }), el("p", { className: "kalq-site__intro", textContent: t("cookieIntro") }),
        el("div", { className: "kalq-site__field" }, el("span", { textContent: t("cookieMode") }), mode), hint,
        el("div", { className: "kalq-site__grid" }, text("notice", "de"), text("notice", "en"), text("consent", "de"), text("consent", "en")),
        el("div", { className: "kalq-site__actions" }, preview, save));
}

// The chat's send destinations: one field each (WhatsApp, Telegram, Threema, SMS, email), checked as typed
export function chatPanel(collab) {
    const values = Object.fromEntries(SEND_DESTS.map((d) => [d.id, plainOf(CHAT_SITE_KEYS[d.id], "de")]));
    const fields = SEND_DESTS.map((d) => {
        const id = `kalq-site-chat-${d.id}`;
        const input = el("input", { id, type: d.id === "email" ? "email" : "text", className: "kalq-site__input", value: values[d.id], placeholder: d.hint, autocomplete: "off" });
        const state = el("span", { className: "kalq-site__state" });
        const check = () => {
            const v = input.value.trim();
            const ok = !v || !!d.href(v);
            input.setAttribute("aria-invalid", String(!ok));
            state.textContent = !v ? "" : ok ? "✓" : t("chatInvalid")(d.label);
        };
        input.addEventListener("input", () => { values[d.id] = input.value; check(); });
        check();
        return el("label", { className: "kalq-site__field", htmlFor: id }, el("span", { textContent: d.label }), input, state);
    });
    const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("chatSave") });
    save.addEventListener("click", async () => {
        const bad = SEND_DESTS.filter((d) => values[d.id].trim() && !d.href(values[d.id].trim()));
        if (bad.length) return collab.toast(t("chatInvalid")(bad.map((d) => d.label).join(", ")), "error");
        save.disabled = true;
        try {
            // an emptied field is saved empty (the destination is gone); unchanged empty ones are left out
            const rows = SEND_DESTS.flatMap((d) => {
                const v = values[d.id].trim();
                if (!v && !plainOf(CHAT_SITE_KEYS[d.id], "de")) return [];
                return ["de", "en"].map((lang) => ({ key: CHAT_SITE_KEYS[d.id], lang, content: v }));
            });
            if (rows.length) await saveSiteBlocks(collab, rows, "Edited chat destinations");
            collab.toast(t("chatSaved"));
        } catch (error) { console.error("chat destinations", error); collab.toast(failText(error), "error"); }
        finally { save.disabled = false; }
    });
    return el("section", { className: "kalq-site kalq-site--chat" },
        el("h3", { className: "kalq-site__title", textContent: t("chatTitle") }), el("p", { className: "kalq-site__intro", textContent: t("chatIntro") }),
        el("div", { className: "kalq-site__grid" }, ...fields), el("div", { className: "kalq-site__actions" }, save));
}
