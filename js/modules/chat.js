// interaction.inquiry: the inquiry chat. The project inquiry as a short conversation (ported from the Project Inquiry
// chat of scar.lat): the avatar and a greeting, then the editor's questions one at a time (tap choices or a short
// text), optionally the visitor's contact details, then a summary and a link for each send destination that opens the
// visitor's own app, filled in. Nothing is sent to or stored by Kalq; the visitor's progress stays in their own
// browser so they can pick up where they left off.
//
// The questions live on the section's layout entry (opts.items: id and kind, in order; opts.contact), so adding,
// moving, deleting and changing a question is one undo step (def.act, js/sections.js); each question's words are its
// own blocks (q_<id>, c_<id>: the choices, one per line), in each language. The send destinations are the same for the
// whole site: site blocks site.chat.<id> (js/modules/destinations.js CHAT_DEST_KEYS), set in the insert panel (Chat).
// In the HTML: every question and its choices as text (a list); the conversation itself is played by
// js/modules/chatBehaviour.js. Template only: shared by the server render and the browser, no browser globals.
import { L, append, el, keyOf, mediaEl, mediaOf, plain, section, slotEl, textOf } from "./kit.js";
import { CHAT_DEST_KEYS, SEND_DESTS } from "./destinations.js";

export const CHAT_MAX = 12;
export const CHAT_WORDS = {
    de: {
        title: "Projektanfrage", choice: "Auswahl", text: "Kurztext", question: (n) => `Frage ${n}`, add: "Frage hinzufügen", up: "Nach oben", down: "Nach unten", remove: "Frage entfernen",
        contact: "Kontaktdaten am Ende abfragen",
        send: { whatsapp: "Per WhatsApp senden", telegram: "Per Telegram senden", threema: "Per Threema senden", sms: "Per SMS senden", email: "Per E-Mail senden" },
        destNote: "Wohin gesendet wird, gilt für die ganze Website: im Einfügen-Fenster unter Chat.", destSet: (list) => `Eingetragen: ${list}.`,
        noDest: "Noch kein Ziel eingetragen. Ohne Ziel kann niemand die Anfrage senden, und der Chat lässt sich nicht veröffentlichen.",
        avatar: "Bild der Person (rund, aus dem Kalq-Speicher hochladen)", avatarRefused: "Diese Adresse ist nicht aus dem Kalq-Speicher und wird nicht gezeigt. Bitte das Bild hochladen.",
        greeting: "Begrüßung", name: "Name der Person (über der Begrüßung)", qph: "Frage", cph: "Antworten zum Antippen, eine pro Zeile",
        contactAsk: ["Wie heißen Sie?", "Ihre E-Mail-Adresse?", "Ihre Telefonnummer?", "Ihr LinkedIn-Profil?"],
        contactLabels: ["Name", "E-Mail", "Telefon", "LinkedIn"],
        summary: "Ihre Anfrage", note: "Nichts wird bei uns gespeichert: Sie senden die Anfrage selbst, aus Ihrer eigenen App.",
    },
    en: {
        title: "Project inquiry", choice: "Choices", text: "Short text", question: (n) => `Question ${n}`, add: "Add a question", up: "Move up", down: "Move down", remove: "Remove question",
        contact: "Ask for contact details at the end",
        send: { whatsapp: "Send via WhatsApp", telegram: "Send via Telegram", threema: "Send via Threema", sms: "Send by SMS", email: "Send by email" },
        destNote: "Send destinations are set for the whole site in the insert panel: Chat.", destSet: (list) => `Set: ${list}.`,
        noDest: "No destination yet. Without one nobody can send the inquiry, and the chat cannot be published.",
        avatar: "Picture of the person (round, upload to Kalq storage)", avatarRefused: "This address is not from Kalq's storage and is not shown. Please upload the picture.",
        greeting: "Greeting", name: "Name of the person (above the greeting)", qph: "Question", cph: "Answers to tap, one per line",
        contactAsk: ["What is your name?", "Your email address?", "Your phone number?", "Your LinkedIn profile?"],
        contactLabels: ["Name", "Email", "Phone", "LinkedIn"],
        summary: "Your inquiry", note: "Nothing is stored on our side: you send the inquiry yourself, from your own app.",
    },
};
const chatWords = (lang) => CHAT_WORDS[lang === "en" ? "en" : "de"];
const ID = /^[a-z0-9]{1,12}$/;
const KINDS = ["choice", "text"];
const newId = () => Math.random().toString(36).slice(2, 8);
export const chatItems = (entry) => (Array.isArray(entry?.opts?.items) ? entry.opts.items.filter((x) => x && ID.test(x.id) && KINDS.includes(x.kind)).slice(0, CHAT_MAX) : []);
export const chatContact = (entry) => entry?.opts?.contact !== false; // on unless switched off
const choicesOf = (ctx, id) => (textOf(ctx, `c_${id}`) || "").split(/<br\s*\/?>|\n|<\/p>\s*<p>/i).map(plain).filter(Boolean).slice(0, 8);

// A site-wide destination: its value (the site block), the link and how the inquiry goes into it; null when not set
// or not valid. get: the store's lookup (a Map's get, or missing()'s get)
export function chatDest(get, d) {
    const e = get(CHAT_DEST_KEYS[d.id]);
    const value = e ? plain(e.de ?? e.en ?? "") : "";
    if (!value) return null;
    const href = d.href(value);
    return href ? { href, param: d.param ? d.param(value) : "", blank: d.blank } : null;
}

// The avatar: only from Kalq's own storage (a site path, or the project's storage bucket); anything else is refused
const OWN_STORAGE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/site-media\/[^?#\s]+$/i;
export const isOwnMedia = (url) => typeof url === "string" && url !== "" && ((!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url) && !/\.\.\//.test(url)) || OWN_STORAGE.test(url));
// Without a picture: the image placeholder's motif, round and quiet (a mountain under a sun, in the text's colour)
const GLYPH_SVG = '<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="18" fill="currentColor" fill-opacity=".08"/><circle cx="22" cy="13" r="4" fill="currentColor" fill-opacity=".14"/><path d="M8 26 L15 18 L18.5 21.5 L21 19 L28 26" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
function avatarNode(ctx) {
    const url = mediaOf(ctx, "avatar");
    if (ctx.editor) return mediaEl(ctx, "avatar", "kalq-m-chat__avatar", { alt: "" });
    const box = el(ctx, "span", "kalq-m-chat__avatar");
    box.setAttribute("aria-hidden", "true"); // decorative: the name and greeting say who it is
    if (url && isOwnMedia(url)) { const img = el(ctx, "img"); img.setAttribute("src", url); img.setAttribute("alt", ""); img.setAttribute("loading", "lazy"); box.append(img); }
    else { box.classList.add("is-glyph"); box.innerHTML = GLYPH_SVG; }
    return box;
}

// A text block in each language (the chat's own words are edited per language)
const langSlot = (ctx, slot, tag, opts = {}) => { const n = slotEl(ctx, slot, tag, opts); n?.setAttribute("data-kalq-lang", ""); return n; };
const head = (ctx) => {
    const box = append(el(ctx, "div", "kalq-m-chat__head-text"), slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }));
    return box.children.length ? box : null;
};

// An editor control: js/sections.js turns its data-items-* into one undo step (def.act below)
function control(ctx, cls, action, text, { id, arg, label, pressed, off } = {}) {
    const b = el(ctx, "button", cls, text);
    b.setAttribute("type", "button");
    b.setAttribute("data-items-action", action);
    if (id) b.setAttribute("data-items-id", id);
    if (arg) b.setAttribute("data-items-arg", arg);
    if (label) b.setAttribute("aria-label", label);
    if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
    if (off) b.setAttribute("disabled", "");
    return b;
}

// Editors' controls for one question: its kind, moving it, removing it
function chatTools(ctx, item, n, count, w) {
    const bar = el(ctx, "div", "kalq-m-chat__tools");
    const kinds = el(ctx, "span", "kalq-m-chat__kinds");
    kinds.setAttribute("role", "group");
    KINDS.forEach((k) => kinds.append(control(ctx, `kalq-m-chat__tool is-kind-${k}`, "kind", w[k], { id: item.id, arg: k, pressed: item.kind === k })));
    append(bar, el(ctx, "span", "kalq-m-chat__num", w.question(n)), kinds,
        n > 1 ? control(ctx, "kalq-m-chat__tool is-up", "up", "↑", { id: item.id, label: w.up }) : null,
        n < count ? control(ctx, "kalq-m-chat__tool is-down", "down", "↓", { id: item.id, label: w.down }) : null,
        control(ctx, "kalq-m-chat__tool is-remove", "remove", "×", { id: item.id, label: w.remove }));
    return bar;
}

// The editor's changes: questions added, moved, removed, their kind; the contact step on or off
function chatAct(opts, action, id, arg) {
    const items = chatItems({ opts });
    const contact = opts.contact !== false;
    const i = items.findIndex((x) => x.id === id);
    let label = null;
    if (action === "add" && items.length < CHAT_MAX) { items.push({ id: newId(), kind: "choice" }); label = "question added"; }
    else if (action === "remove" && i >= 0) { items.splice(i, 1); label = "question removed"; }
    else if ((action === "up" && i > 0) || (action === "down" && i >= 0 && i < items.length - 1)) {
        const j = action === "up" ? i - 1 : i + 1;
        [items[i], items[j]] = [items[j], items[i]];
        label = `question moved ${action}`;
    } else if (action === "kind" && i >= 0 && KINDS.includes(arg)) {
        if (items[i].kind === arg) return null;
        items[i] = { ...items[i], kind: arg };
        label = `question as ${arg === "choice" ? "choices" : "short text"}`;
    } else if (action === "contact") { opts.contact = !contact; label = `contact details ${opts.contact ? "on" : "off"}`; }
    if (!label) return null;
    opts.items = items;
    if (opts.contact === undefined) opts.contact = contact;
    return label;
}

function renderInquiry(ctx) {
    const w = chatWords(ctx.lang);
    const ew = CHAT_WORDS.en; // the editor's own controls and notes: in English, whatever the page language
    const items = chatItems(ctx.entry);
    const contact = chatContact(ctx.entry);
    const get = (key) => ctx.store.get(key);
    const s = section(ctx, "kalq-m-chat");
    if (!ctx.editor) s.setAttribute("data-chat", "");
    const i = el(ctx, "div", "kalq-m-inner");
    const intro = append(el(ctx, "div", "kalq-m-chat__intro"), head(ctx), slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }));
    if (intro.children.length) s.classList.add("has-intro");

    const win = el(ctx, "div", "kalq-m-chat__window");
    const top = el(ctx, "div", "kalq-m-chat__head");
    // one h2 for the section: the heading beside the chat if there is one, else the chat's title
    const titleTag = intro.querySelector("h2") ? "p" : "h2";
    const title = langSlot(ctx, "title", titleTag, { className: "kalq-m-chat__title" }) || el(ctx, titleTag, "kalq-m-chat__title", w.title);
    const langs = el(ctx, "div", "kalq-m-chat__langs");
    langs.setAttribute("role", "group");
    ["de", "en"].forEach((l) => { const b = el(ctx, "button", "kalq-m-chat__lang", l.toUpperCase()); b.setAttribute("type", "button"); b.setAttribute("data-lang", l); b.setAttribute("lang", l); b.setAttribute("aria-pressed", String(ctx.lang === l)); langs.append(b); });
    append(top, title, langs);

    // the greeting, from the avatar
    const greet = append(el(ctx, "div", "kalq-m-chat__msg is-bot is-greeting"), avatarNode(ctx),
        append(el(ctx, "div", "kalq-m-chat__bubble"), slotEl(ctx, "name", "p", { className: "kalq-m-chat__name" }),
            langSlot(ctx, "greeting", "div", { className: "kalq-m-chat__greeting", format: "paragraphs" })));
    const log = append(el(ctx, "div", "kalq-m-chat__log"), greet);

    // the questions, in order, as text: the conversation asks them one at a time
    const script = el(ctx, "ol", "kalq-m-chat__script");
    items.forEach((item, k) => {
        const li = el(ctx, "li", `kalq-m-chat__q is-${item.kind}`);
        li.setAttribute("data-q", item.id);
        li.setAttribute("data-kind", item.kind);
        if (ctx.editor) li.append(chatTools(ctx, item, k + 1, items.length, ew));
        const q = langSlot(ctx, `q_${item.id}`, "h3", { className: "kalq-m-chat__ask", label: L(`${CHAT_WORDS.de.qph} ${k + 1}`, `${CHAT_WORDS.en.qph} ${k + 1}`) });
        if (!q) return; // visitors: a question without words is not asked
        li.append(q);
        if (item.kind === "choice") {
            if (ctx.editor) li.append(langSlot(ctx, `c_${item.id}`, "div", { className: "kalq-m-chat__choices-field", format: "lines", label: L(CHAT_WORDS.de.cph, CHAT_WORDS.en.cph) }));
            else {
                const list = choicesOf(ctx, item.id);
                if (!list.length) return; // a choice question needs its choices
                const ul = el(ctx, "ul", "kalq-m-chat__choices");
                ul.setAttribute("data-choices", keyOf(ctx, `c_${item.id}`)); // rebuilt in the other language (js/modules/chatBehaviour.js)
                list.forEach((c) => ul.append(el(ctx, "li", "", c)));
                li.append(ul);
            }
        }
        script.append(li);
    });
    // the contact details, asked at the end (when switched on)
    if (contact && !ctx.editor) w.contactAsk.forEach((ask, k) => {
        const li = el(ctx, "li", "kalq-m-chat__q is-contact");
        li.setAttribute("data-q", ["name", "email", "phone", "linkedin"][k]);
        li.setAttribute("data-kind", "contact");
        li.append(el(ctx, "h3", "kalq-m-chat__ask", ask));
        script.append(li);
    });

    // the end: a summary (filled in as the visitor answers) and a link for each destination set for the site
    const send = el(ctx, "div", "kalq-m-chat__send");
    if (!ctx.editor) SEND_DESTS.forEach((d) => {
        const to = chatDest(get, d);
        if (!to) return; // not set (or not valid): no button
        const a = el(ctx, "a", `kalq-m-chat__go is-${d.id}`, w.send[d.id]);
        a.setAttribute("href", to.href);
        a.setAttribute("data-dest", d.id);
        if (to.param) a.setAttribute("data-param", to.param);
        if (to.blank) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        send.append(a);
    });
    const finish = append(el(ctx, "div", "kalq-m-chat__finish"), el(ctx, "h3", "kalq-m-chat__summary-title", w.summary), el(ctx, "dl", "kalq-m-chat__summary"),
        send.children.length ? send : null, el(ctx, "p", "kalq-m-chat__note", w.note));

    if (ctx.editor) {
        const add = control(ctx, "kalq-m-chat__add", "add", `+ ${ew.add}`, { off: items.length >= CHAT_MAX });
        const sw = control(ctx, "kalq-m-chat__switch", "contact", ew.contact, { pressed: contact });
        const avatarUrl = mediaOf(ctx, "avatar");
        const avatarField = append(el(ctx, "div", "kalq-m-chat__setting is-avatar"), el(ctx, "span", "", ew.avatar), mediaEl(ctx, "avatar", "kalq-m-chat__avatar-field", { alt: "" }),
            avatarUrl && !isOwnMedia(avatarUrl) ? el(ctx, "span", "kalq-m-chat__missing", ew.avatarRefused) : null);
        const set = SEND_DESTS.filter((d) => chatDest(get, d)).map((d) => d.label);
        const settings = append(el(ctx, "div", "kalq-m-chat__settings"), avatarField, sw,
            el(ctx, "p", "kalq-m-chat__dest-note", ew.destNote),
            set.length ? el(ctx, "p", "kalq-m-chat__dest-set", ew.destSet(set.join(", "))) : el(ctx, "p", "kalq-m-chat__nodest", ew.noDest));
        append(win, top, log, script, add, settings);
    } else append(win, top, log, script, finish);
    if (!ctx.editor && !items.length && !textOf(ctx, "greeting")) return null;
    append(i, intro.children.length ? intro : null, win);
    return append(s, i);
}

export const CHAT_CATEGORY = { id: "chat", de: "Chat", en: "Chat" };

export const CHAT = {
    "interaction.inquiry": {
        category: "chat",
        name: L("Anfrage im Chat", "Inquiry chat"),
        keywords: "chat anfrage inquiry project projekt fragen questions whatsapp email kontakt contact",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift (optional)", "Eyebrow (optional)") },
            heading: { kind: "heading", label: L("Überschrift neben dem Chat (optional)", "Heading beside the chat (optional)") },
            text: { kind: "text", label: L("Text neben dem Chat (optional)", "Text beside the chat (optional)") },
            title: { kind: "eyebrow", label: L("Titel des Chats (sonst: Projektanfrage)", "Chat title (otherwise: Project inquiry)") },
            avatar: { kind: "media", label: L(CHAT_WORDS.de.avatar, CHAT_WORDS.en.avatar) },
            name: { kind: "button", label: L(CHAT_WORDS.de.name, CHAT_WORDS.en.name) },
            greeting: { kind: "text", label: L(CHAT_WORDS.de.greeting, CHAT_WORDS.en.greeting), required: true },
        },
        versions: {
            chat: { name: L("Chat mit Fragen zum Antippen", "Chat with questions to tap"),
                wire: [["heading", 6, 18, 28], ["line", 6, 25, 24], ["band", 50, 6, 44, 50], ["media", 53, 12, 5, 5], ["line", 60, 13, 26, "light"], ["line", 60, 17, 20, "light"],
                    ["button", 60, 24, 10, "light"], ["button", 72, 24, 12, "light"], ["line", 74, 33, 16, "light"], ["button", 60, 46, 30, "light"]] },
        },
        // a new chat starts with one question of each kind, its words to fill in
        initialOpts: () => ({ items: [{ id: newId(), kind: "choice" }, { id: newId(), kind: "text" }], contact: true }),
        act: chatAct,
        // it can go live once it has a greeting (a required slot), at least one question with words, and a destination
        // set for the site
        missing: (entry, page, get) => {
            const out = [];
            const has = (slot) => { const e = get(`${page}.${entry.id}.${slot}`); return e && (e.de || e.en); };
            if (!chatItems(entry).some((it) => has(`q_${it.id}`))) out.push(L("eine Frage", "a question"));
            if (!SEND_DESTS.some((d) => chatDest(get, d))) out.push(L("ein Ziel zum Senden für die Website (Einfügen-Fenster: Chat)", "a send destination for the site (insert panel: Chat)"));
            return out;
        },
        magazine: {
            layout: "B",
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-m-chat__intro .kalq-m-eyebrow"),
                title: s.querySelector(".kalq-m-chat__intro .kalq-m-heading") || s.querySelector(".kalq-m-chat__title"),
                lead: s.querySelector(".kalq-m-chat__greeting p"),
                body: [...k.parasOf(s.querySelector(".kalq-m-chat__intro .kalq-m-text")), ...[...s.querySelectorAll(".kalq-m-chat__script > li:not(.is-contact)")].flatMap((li, n) => [
                    k.textOf(li.querySelector(".kalq-m-chat__ask"), "h3", "bk-item", `${n + 1}. `),
                    li.querySelector(".kalq-m-chat__choices") ? Object.assign(document.createElement("p"), { className: "bk-small", textContent: [...li.querySelectorAll(".kalq-m-chat__choices li")].map((c) => c.textContent.trim()).join(" · ") }) : null]).filter(Boolean)],
                actions: [...s.querySelectorAll(".kalq-m-chat__send a")] }),
        },
        render: renderInquiry,
    },
};
