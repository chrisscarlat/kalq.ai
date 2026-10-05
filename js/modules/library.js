// The module library, batch 2 (old/KALQ_MODULE_LIBRARY_SPEC.md 2.1–2.19): the workhorse sections. Merged into
// MODULES by js/modules/registry.js; rendered with js/modules/kit.js; behaviour in js/moduleBehaviour.js; look in
// css/components/_library2.scss. Shared by the server render and the browser: no browser globals at the top level.
//
// Common to all: every text is plain text in the server HTML; an empty slot renders nothing for visitors (so no
// number, price or rating is ever shown that an editor did not type); lists are lists; pictures that carry content
// have a description (alt), decorative ones are hidden. Motion is visitor-only (editors edit still text) and set up by
// js/moduleBehaviour.js from data-reveal, never under reduced motion. magazine.unit(section, kit) turns the rendered
// section into the book's unit (js/magazine.js), so the book carries every text the page has.
import { L, append, altField, editorField, el, keyOf, mediaEl, mediaOf, picture, plain, rangeEl, rangeOf, section, slotEl, hrefOf, textOf, roundArrow } from "./kit.js";

const SERVICES = 6;
const PLANS = 4;
const STATS = 4;

// Numbered slots: [[`title1`, def], …] for items 1..n (the first ones required)
const items = (n, make) => Object.fromEntries(Array.from({ length: n }, (_, i) => make(i + 1)).flat());

// Which of n numbered items show: visitors the filled ones; editors the filled ones and one empty to fill next
function shown(ctx, n, filled) {
    const out = [];
    let empty = 0;
    for (let i = 1; i <= n; i++) {
        if (filled(i)) out.push(i);
        else if (ctx.editor && empty++ < 1) out.push(i);
    }
    return out;
}
const has = (ctx, slot) => !!plain(textOf(ctx, slot));

// A plain text link (underline or curved arrow, 2.10): a real anchor with its visible text; editors get both fields
export function textLink(ctx, labelSlot, linkSlot, style = "underline") {
    const cls = style === "curved" ? "kalq-link-curved" : "kalq-link-underline";
    if (ctx.editor) {
        return append(el(ctx, "span", "kalq-m-edit-link"), slotEl(ctx, labelSlot, "span", { className: cls }), editorField(ctx, linkSlot));
    }
    const label = textOf(ctx, labelSlot), href = hrefOf(ctx, linkSlot);
    if (!label || !href) return null;
    const a = el(ctx, "a", cls);
    a.setAttribute("href", href);
    const text = slotEl(ctx, labelSlot, "span", { className: "kalq-link__text" });
    a.append(text);
    if (style === "curved") {
        const arrow = el(ctx, "span", "kalq-link-curved__arrow");
        arrow.setAttribute("aria-hidden", "true");
        arrow.innerHTML = '<svg viewBox="0 0 20 20" focusable="false"><path d="M4 15c1-6 5-9 11-9M11 3l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>';
        a.append(arrow);
    }
    return a;
}

const inner = (ctx, cls = "") => el(ctx, "div", `kalq-m-inner ${cls}`.trim());
const head = (ctx, { eyebrow = "eyebrow", heading = "heading", cls = "kalq-m-lib__head" } = {}) => {
    const box = append(el(ctx, "div", cls), slotEl(ctx, eyebrow, "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, heading, "h2", { className: "kalq-m-heading" }));
    return box.children.length ? box : null;
};
// Visitors only: motion set up in the browser (js/moduleBehaviour.js)
const reveal = (ctx, s, kind) => { if (!ctx.editor) s.setAttribute("data-reveal", kind); };

//=================================== 2.1 Statement with word reveal ===================================//
// One large sentence (its words rise in as it comes into view; the sentence stays the heading's own text), then a
// label, two paragraphs, a text link and a small portrait.
function renderStatement(ctx) {
    const s = section(ctx, `kalq-m-statement is-${ctx.entry.version === "still" ? "still" : "reveal"}`);
    if (ctx.entry.version !== "still") reveal(ctx, s, "words");
    const i = inner(ctx);
    const below = el(ctx, "div", "kalq-m-statement__below");
    const portrait = mediaEl(ctx, "portrait", "kalq-m-statement__portrait");
    const copy = append(el(ctx, "div", "kalq-m-statement__copy"),
        slotEl(ctx, "label", "p", { className: "kalq-m-statement__label" }),
        slotEl(ctx, "text1", "div", { className: "kalq-m-text", format: "paragraphs" }),
        slotEl(ctx, "text2", "div", { className: "kalq-m-text", format: "paragraphs" }),
        textLink(ctx, "link_label", "link"));
    append(below, portrait ? append(el(ctx, "div", "kalq-m-statement__side"), portrait, altField(ctx, "portrait")) : null, copy.children.length ? copy : null);
    append(i, slotEl(ctx, "heading", "h2", { className: "kalq-m-statement__text kalq-reveal-words" }), below.children.length ? below : null);
    return append(s, i);
}

//=================================== 2.2 Numbered services ===================================//
// Up to six services as a numbered list: number, title, text on one side, the picture on the other
function renderServices(ctx) {
    const s = section(ctx, `kalq-m-services is-${ctx.entry.version === "alternating" ? "alternating" : "image-right"}`);
    const i = inner(ctx);
    const list = el(ctx, "ol", "kalq-m-services__list");
    shown(ctx, SERVICES, (n) => has(ctx, `title${n}`)).forEach((n, k) => {
        const text = append(el(ctx, "div", "kalq-m-services__text"),
            el(ctx, "span", "kalq-m-services__num", String(k + 1).padStart(2, "0")),
            slotEl(ctx, `title${n}`, "h3", { className: "kalq-m-services__title" }),
            slotEl(ctx, `text${n}`, "div", { className: "kalq-m-text", format: "paragraphs" }));
        text.querySelector(".kalq-m-services__num").setAttribute("aria-hidden", "true"); // the list numbers itself
        const media = mediaEl(ctx, `image${n}`, "kalq-m-services__media");
        list.append(append(el(ctx, "li", "kalq-m-services__item"), text, media ? append(el(ctx, "div", "kalq-m-services__side"), media, altField(ctx, `image${n}`)) : null));
    });
    append(i, head(ctx), list);
    return append(s, i);
}

//=================================== 2.3 Feature row ===================================//
// Two pictures side by side and a column of three short features
function renderFeatureRow(ctx) {
    const s = section(ctx, `kalq-m-featrow is-${ctx.entry.version === "text-left" ? "text-left" : "images-left"}`);
    const i = inner(ctx);
    const pics = el(ctx, "div", "kalq-m-featrow__pictures");
    [1, 2].forEach((n) => { const m = mediaEl(ctx, `image${n}`, "kalq-m-featrow__media"); if (m) pics.append(append(el(ctx, "div", "kalq-m-featrow__pic"), m, altField(ctx, `image${n}`))); });
    const list = el(ctx, "ul", "kalq-m-featrow__list");
    shown(ctx, 3, (n) => has(ctx, `ftitle${n}`)).forEach((n) => list.append(append(el(ctx, "li", "kalq-m-featrow__item"),
        slotEl(ctx, `ftitle${n}`, "h3", { className: "kalq-m-featrow__title" }),
        slotEl(ctx, `ftext${n}`, "div", { className: "kalq-m-text", format: "paragraphs" }))));
    const side = append(el(ctx, "div", "kalq-m-featrow__side"), head(ctx), list.children.length ? list : null);
    append(i, pics.children.length ? pics : null, side);
    return append(s, i);
}

//=================================== 2.11 Three features ===================================//
// Three centred columns (heading, text, optional link) fading up one after the other
function renderThree(ctx) {
    const s = section(ctx, "kalq-m-three");
    reveal(ctx, s, "items");
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-three__list");
    shown(ctx, 3, (n) => has(ctx, `title${n}`)).forEach((n) => list.append(append(el(ctx, "li", "kalq-m-three__item kalq-reveal-item"),
        slotEl(ctx, `title${n}`, "h3", { className: "kalq-m-three__title" }),
        slotEl(ctx, `text${n}`, "div", { className: "kalq-m-text", format: "paragraphs" }),
        textLink(ctx, `link_label${n}`, `link${n}`))));
    append(i, head(ctx), list);
    return append(s, i);
}

//=================================== 2.4 Stats band ===================================//
// Up to four figures, each with a small label pill and a line of context; a figure is what the editor typed (no
// counting up from zero) and a stat without one is not shown. Over a picture with a darkening, or on plain colour.
function renderStats(ctx) {
    const onImage = ctx.entry.version !== "colour";
    const s = section(ctx, `kalq-m-stats is-${onImage ? "image" : "colour"}`);
    const bg = onImage ? mediaEl(ctx, "background", "kalq-m-stats__bg") : null;
    if (bg) {
        bg.setAttribute("aria-hidden", "true");
        const shade = el(ctx, "div", "kalq-m-stats__shade");
        shade.setAttribute("aria-hidden", "true");
        shade.setAttribute("style", `opacity: ${rangeOf(ctx, "shade") / 100}`);
        append(s, bg, shade);
        s.classList.add("has-media");
    }
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-stats__list");
    shown(ctx, STATS, (n) => has(ctx, `figure${n}`)).forEach((n) => list.append(append(el(ctx, "li", "kalq-m-stats__item"),
        slotEl(ctx, `label${n}`, "p", { className: "kalq-m-stats__label" }),
        slotEl(ctx, `figure${n}`, "p", { className: "kalq-m-stats__figure" }),
        slotEl(ctx, `context${n}`, "p", { className: "kalq-m-stats__context" }))));
    if (!list.children.length && !ctx.editor) return null;
    append(i, head(ctx), list, ctx.editor && bg ? rangeEl(ctx, "shade", ".kalq-m-stats__shade") : null);
    return append(s, i);
}

//=================================== 2.5 Pricing table ===================================//
// Two to four plans in columns: name, badge, description, price and period, button, "includes" and the features as
// a list. A plan shows with its name; a price only when one is typed.
function renderPricing(ctx) {
    const s = section(ctx, `kalq-m-pricing is-${ctx.entry.version === "cards" ? "cards" : "bordered"}`);
    const i = inner(ctx);
    const plans = el(ctx, "ul", "kalq-m-pricing__plans");
    const nums = shown(ctx, PLANS, (n) => has(ctx, `name${n}`));
    nums.forEach((n) => {
        const plan = el(ctx, "li", "kalq-m-pricing__plan");
        if (has(ctx, `badge${n}`)) plan.classList.add("has-badge");
        const top = append(el(ctx, "div", "kalq-m-pricing__top"),
            slotEl(ctx, `name${n}`, "h3", { className: "kalq-m-pricing__name" }),
            slotEl(ctx, `badge${n}`, "p", { className: "kalq-m-pricing__badge" }));
        const price = append(el(ctx, "p", "kalq-m-pricing__price"),
            slotEl(ctx, `price${n}`, "span", { className: "kalq-m-pricing__amount" }),
            slotEl(ctx, `period${n}`, "span", { className: "kalq-m-pricing__period" }));
        const features = featureList(ctx, `features${n}`);
        append(plan, top, slotEl(ctx, `desc${n}`, "div", { className: "kalq-m-pricing__desc", format: "paragraphs" }),
            price.children.length ? price : null, planButton(ctx, n), features ? el(ctx, "hr", "kalq-m-pricing__rule") : null,
            features ? slotEl(ctx, "includes", "p", { className: "kalq-m-pricing__includes" }) : null, features);
        plans.append(plan);
    });
    if (!plans.children.length && !ctx.editor) return null;
    plans.setAttribute("data-count", String(nums.length));
    append(i, head(ctx), plans);
    return append(s, i);
}

// The features: one per line, as a real list (editors edit the lines in place)
function featureList(ctx, slot) {
    if (ctx.editor) return slotEl(ctx, slot, "div", { className: "kalq-m-pricing__features is-edit", format: "lines" });
    const lines = (textOf(ctx, slot) || "").split(/<br\s*\/?>|\n|<\/p>\s*<p>/i).map(plain).filter(Boolean);
    if (!lines.length) return null;
    const ul = el(ctx, "ul", "kalq-m-pricing__features");
    lines.forEach((line) => ul.append(el(ctx, "li", "", line)));
    return ul;
}

function planButton(ctx, n) {
    if (ctx.editor) return append(el(ctx, "div", "kalq-m-actions"), slotEl(ctx, `button${n}`, "span", { className: "kalq-m-button" }), editorField(ctx, `link${n}`));
    const label = textOf(ctx, `button${n}`), href = hrefOf(ctx, `link${n}`);
    if (!label || !href) return null;
    const a = el(ctx, "a", "kalq-m-button");
    a.setAttribute("href", href);
    a.append(slotEl(ctx, `button${n}`, "span", {}));
    return append(el(ctx, "div", "kalq-m-actions"), a);
}

//=================================== 2.6 CTA sentence ===================================//
// A large centred sentence that is itself the link: one real anchor, its area stretched over the band. Optional
// picture behind (decorative). The words come in with a soft blur as the band comes into view.
function renderCtaSentence(ctx) {
    const onImage = ctx.entry.version === "image";
    const s = section(ctx, `kalq-m-ctaline is-${onImage ? "image" : "colour"}`);
    reveal(ctx, s, "blur");
    const bg = onImage ? mediaEl(ctx, "background", "kalq-m-ctaline__bg") : null;
    if (bg) { bg.setAttribute("aria-hidden", "true"); append(s, bg, append(el(ctx, "div", "kalq-m-ctaline__shade"))); s.classList.add("has-media"); }
    const i = inner(ctx);
    const sentence = slotEl(ctx, "heading", "span", { className: "kalq-m-ctaline__text kalq-reveal-words" });
    const href = hrefOf(ctx, "link");
    const h = el(ctx, "h2", "kalq-m-ctaline__heading");
    if (ctx.editor) append(i, append(h, sentence), editorField(ctx, "link", "p"));
    else {
        if (!sentence || !href) return null;
        const a = el(ctx, "a", "kalq-m-ctaline__link");
        a.setAttribute("href", href);
        a.append(sentence, roundArrow(ctx));
        append(i, append(h, a));
    }
    return append(s, i);
}


//=================================== Contact (2.8, without a form) ===================================//
// A heading on one side; on the other a label, the email address large as a link and the networks as large words.
// There are no forms on the site: an inquiry goes through the chat (interaction.inquiry), sent from the visitor's own
// mail or WhatsApp.
function renderContact(ctx) {
    const s = section(ctx, "kalq-m-contact");
    const i = inner(ctx);
    const left = append(el(ctx, "div", "kalq-m-contact__left"), head(ctx), slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }));
    const right = el(ctx, "div", "kalq-m-contact__right");
    append(right, slotEl(ctx, "label", "p", { className: "kalq-m-eyebrow" }));
    const email = plain(textOf(ctx, "email"));
    if (ctx.editor) right.append(slotEl(ctx, "email", "p", { className: "kalq-m-contact__email" }));
    else if (/^[^\s@]+@[^\s@]+$/.test(email)) {
        const a = el(ctx, "a", "kalq-m-contact__email");
        a.setAttribute("href", `mailto:${email}`);
        a.append(slotEl(ctx, "email", "span", {}));
        right.append(a);
    }
    const socials = el(ctx, "ul", "kalq-m-contact__social");
    for (let n = 1; n <= 4; n++) {
        if (ctx.editor) { socials.append(append(el(ctx, "li"), slotEl(ctx, `social${n}`, "span", { className: "kalq-m-contact__word" }), editorField(ctx, `social_link${n}`))); continue; }
        const label = textOf(ctx, `social${n}`), href = hrefOf(ctx, `social_link${n}`);
        if (!label || !href) continue;
        const a = el(ctx, "a", "kalq-m-contact__word");
        a.setAttribute("href", href);
        if (/^https?:/.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        a.append(slotEl(ctx, `social${n}`, "span", {}));
        socials.append(append(el(ctx, "li"), a));
    }
    append(right, socials.children.length ? socials : null);
    if (!right.children.length && !ctx.editor) return null;
    append(i, left.children.length ? left : null, right);
    return append(s, i);
}

//=================================== The inquiry chat ===================================//
// The project inquiry as a short conversation (ported from the Project Inquiry chat of scar.lat): the avatar and a
// greeting, then the editor's questions one at a time (tap choices or a short text), optionally the visitor's contact
// details, then a summary and a link for each destination the editor set (WhatsApp, Telegram, Threema, SMS, email)
// that opens the visitor's own app, filled in. Nothing is sent to
// or stored by Kalq; the visitor's progress stays in their own browser so they can pick up where they left off.
// The questions live on the section's layout entry (opts.items: id and kind, in order), so adding, moving, deleting
// and changing a question is one undo step; each question's words are its own blocks (q_<id>, c_<id>: the choices,
// one per line), in each language. In the HTML: every question and its choices as text (a list); the conversation
// itself is played by js/moduleBehaviour.js (setupChat), still under reduced motion.
export const CHAT_MAX = 12;
export const CHAT_WORDS = {
    de: {
        title: "Projektanfrage", choice: "Auswahl", text: "Kurztext", question: (n) => `Frage ${n}`, add: "Frage hinzufügen", up: "Nach oben", down: "Nach unten", remove: "Frage entfernen",
        contact: "Kontaktdaten am Ende abfragen",
        dest: { whatsapp: "WhatsApp: Nummer mit Ländervorwahl, z. B. +49 170 1234567", telegram: "Telegram: Benutzername (z. B. @kalq) oder Nummer mit Ländervorwahl",
            threema: "Threema: ID (8 Zeichen)", sms: "SMS: Nummer mit Ländervorwahl", email: "E-Mail-Adresse" },
        send: { whatsapp: "Per WhatsApp senden", telegram: "Per Telegram senden", threema: "Per Threema senden", sms: "Per SMS senden", email: "Per E-Mail senden" },
        destMissing: (label) => `Leer: „${label}“ ist ausgeblendet.`, destInvalid: "Das passt nicht: der Button bleibt ausgeblendet.",
        noDest: "Noch kein Ziel eingetragen. Ohne Ziel kann niemand die Anfrage senden, und der Chat lässt sich nicht veröffentlichen.",
        destTitle: "Wohin gesendet wird: jeder Button erscheint nur, wenn sein Ziel eingetragen ist",
        avatar: "Bild der Person (rund, aus dem Kalq-Speicher hochladen)", avatarRefused: "Diese Adresse ist nicht aus dem Kalq-Speicher und wird nicht gezeigt. Bitte das Bild hochladen.",
        greeting: "Begrüßung", name: "Name der Person (über der Begrüßung)", qph: "Frage", cph: "Antworten zum Antippen, eine pro Zeile",
        contactAsk: ["Wie heißen Sie?", "Ihre E-Mail-Adresse?", "Ihre Telefonnummer?", "Ihr LinkedIn-Profil?"],
        contactLabels: ["Name", "E-Mail", "Telefon", "LinkedIn"],
        summary: "Ihre Anfrage", note: "Nichts wird bei uns gespeichert: Sie senden die Anfrage selbst, aus Ihrer eigenen App.",
    },
    en: {
        title: "Project inquiry", choice: "Choices", text: "Short text", question: (n) => `Question ${n}`, add: "Add a question", up: "Move up", down: "Move down", remove: "Remove question",
        contact: "Ask for contact details at the end",
        dest: { whatsapp: "WhatsApp: number with country code, e.g. +49 170 1234567", telegram: "Telegram: username (e.g. @kalq) or number with country code",
            threema: "Threema: ID (8 characters)", sms: "SMS: number with country code", email: "Email address" },
        send: { whatsapp: "Send via WhatsApp", telegram: "Send via Telegram", threema: "Send via Threema", sms: "Send by SMS", email: "Send by email" },
        destMissing: (label) => `Empty: "${label}" is hidden.`, destInvalid: "That does not fit: the button stays hidden.",
        noDest: "No destination yet. Without one nobody can send the inquiry, and the chat cannot be published.",
        destTitle: "Where it is sent: each button appears only when its destination is set",
        avatar: "Picture of the person (round, upload to Kalq storage)", avatarRefused: "This address is not from Kalq's storage and is not shown. Please upload the picture.",
        greeting: "Greeting", name: "Name of the person (above the greeting)", qph: "Question", cph: "Answers to tap, one per line",
        contactAsk: ["What is your name?", "Your email address?", "Your phone number?", "Your LinkedIn profile?"],
        contactLabels: ["Name", "Email", "Phone", "LinkedIn"],
        summary: "Your inquiry", note: "Nothing is stored on our side: you send the inquiry yourself, from your own app.",
    },
};
const chatWords = (lang) => CHAT_WORDS[lang === "en" ? "en" : "de"];
export const chatItems = (entry) => (Array.isArray(entry?.opts?.items) ? entry.opts.items.filter((x) => x && /^[a-z0-9]{1,12}$/.test(x.id) && ["choice", "text"].includes(x.kind)).slice(0, CHAT_MAX) : []);
export const chatContact = (entry) => entry?.opts?.contact !== false; // on unless switched off
const choicesOf = (ctx, id) => (textOf(ctx, `c_${id}`) || "").split(/<br\s*\/?>|\n|<\/p>\s*<p>/i).map(plain).filter(Boolean).slice(0, 8);
const phoneDigits = (raw) => plain(raw).replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/(?!^)\+/g, "");

// Where the inquiry can be sent: each destination is one editor field; its button shows only with a valid value.
// href: the link without the inquiry; param: how the script adds it ("text", "body", "mailto", or none)
const tgOf = (raw) => {
    const v = plain(raw).replace(/^https?:\/\/t\.me\//i, "");
    const user = v.replace(/^@/, "");
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(user)) return { href: `https://t.me/${user}`, param: "text" };
    const d = phoneDigits(v);
    return /^\+\d{6,15}$/.test(d) ? { href: `https://t.me/${d}`, param: "" } : null; // a number opens the chat; the text cannot be put in
};
export const CHAT_DESTS = [
    { id: "whatsapp", to: (v) => { const d = phoneDigits(v); return /^\+?\d{6,15}$/.test(d) ? { href: `https://wa.me/${d.replace("+", "")}`, param: "text", blank: true } : null; } },
    { id: "telegram", to: (v) => { const t = tgOf(v); return t ? { ...t, blank: true } : null; } },
    { id: "threema", to: (v) => { const id = plain(v).toUpperCase(); return /^[A-Z0-9*]{8}$/.test(id) ? { href: `https://threema.id/${id}`, param: "text", blank: true } : null; } },
    { id: "sms", to: (v) => { const d = phoneDigits(v); return /^\+\d{6,15}$/.test(d) ? { href: `sms:${d}`, param: "body" } : null; } },
    { id: "email", to: (v) => { const m = plain(v); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) ? { href: `mailto:${m}`, param: "mailto" } : null; } },
];
const destOf = (ctx, d) => (plain(textOf(ctx, d.id)) ? d.to(textOf(ctx, d.id)) : null);

// The avatar: only from Kalq's own storage (a site path, or the project's storage bucket); anything else is refused
const OWN_STORAGE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/site-media\/[^?#\s]+$/i;
export const isOwnMedia = (url) => typeof url === "string" && url !== "" && ((!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url) && !/\.\.\//.test(url)) || OWN_STORAGE.test(url));
// Without a picture: Kalq's placeholder glyph (the one image placeholder: a blue ground, a light sun, a dark mountain), round
const GLYPH_SVG = '<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="18" fill="#1D4ED8"/><circle cx="21.5" cy="13" r="3.2" fill="#7DB3FF"/><path d="M9 27L17 14L25 27Z" fill="#172E7A"/></svg>';
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

// Editors' controls for one question: its kind, moving it, removing it (js/sections.js does the action, one undo step)
function chatTools(ctx, item, n, count, w) {
    const bar = el(ctx, "div", "kalq-m-chat__tools");
    const btn = (action, label, text, extra = {}) => {
        const b = el(ctx, "button", `kalq-m-chat__tool is-${action}`, text);
        b.setAttribute("type", "button");
        b.setAttribute("data-chat-action", action);
        b.setAttribute("data-chat-id", item.id);
        b.setAttribute("aria-label", label);
        Object.entries(extra).forEach(([k, v]) => b.setAttribute(k, v));
        return b;
    };
    const kinds = el(ctx, "span", "kalq-m-chat__kinds");
    kinds.setAttribute("role", "group");
    ["choice", "text"].forEach((k) => { const b = btn(`kind-${k}`, w[k], w[k], { "aria-pressed": String(item.kind === k) }); b.removeAttribute("aria-label"); kinds.append(b); });
    append(bar, el(ctx, "span", "kalq-m-chat__num", w.question(n)), kinds,
        n > 1 ? btn("up", w.up, "↑") : null, n < count ? btn("down", w.down, "↓") : null, btn("remove", w.remove, "×"));
    return bar;
}

function renderInquiry(ctx) {
    const w = chatWords(ctx.lang);
    const ew = CHAT_WORDS.en; // the editor's own controls and notes: in English, whatever the page language
    const items = chatItems(ctx.entry);
    const contact = chatContact(ctx.entry);
    const s = section(ctx, "kalq-m-chat");
    if (!ctx.editor) s.setAttribute("data-chat", "");
    const i = inner(ctx);
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
    const avatar = avatarNode(ctx);
    const greet = append(el(ctx, "div", "kalq-m-chat__msg is-bot is-greeting"), avatar,
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
                ul.setAttribute("data-choices", keyOf(ctx, `c_${item.id}`)); // rebuilt in the other language (js/moduleBehaviour.js)
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

    // the end: a summary (filled in as the visitor answers) and a link for each destination the editor set
    const send = el(ctx, "div", "kalq-m-chat__send");
    if (!ctx.editor) CHAT_DESTS.forEach((d) => {
        const to = destOf(ctx, d);
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
        const add = el(ctx, "button", "kalq-m-chat__add", `+ ${ew.add}`);
        add.setAttribute("type", "button");
        add.setAttribute("data-chat-action", "add");
        if (items.length >= CHAT_MAX) add.setAttribute("disabled", "");
        const sw = el(ctx, "button", "kalq-m-chat__switch", ew.contact);
        sw.setAttribute("type", "button");
        sw.setAttribute("data-chat-action", "contact");
        sw.setAttribute("aria-pressed", String(contact));
        const avatarUrl = mediaOf(ctx, "avatar");
        const avatarField = append(el(ctx, "div", "kalq-m-chat__setting is-avatar"), el(ctx, "span", "", ew.avatar), mediaEl(ctx, "avatar", "kalq-m-chat__avatar-field", { alt: "" }),
            avatarUrl && !isOwnMedia(avatarUrl) ? el(ctx, "span", "kalq-m-chat__missing", ew.avatarRefused) : null);
        const dests = CHAT_DESTS.map((d) => {
            const raw = plain(textOf(ctx, d.id));
            const note = !raw ? ew.destMissing(ew.send[d.id]) : !d.to(raw) ? ew.destInvalid : null;
            return append(el(ctx, "label", "kalq-m-chat__setting"), el(ctx, "span", "", ew.dest[d.id]), slotEl(ctx, d.id, "span", { className: "kalq-m-chat__value" }),
                note ? el(ctx, "span", "kalq-m-chat__missing", note) : null);
        });
        const none = !CHAT_DESTS.some((d) => destOf(ctx, d));
        const settings = append(el(ctx, "div", "kalq-m-chat__settings"), avatarField, sw,
            el(ctx, "p", "kalq-m-chat__settings-title", ew.destTitle), none ? el(ctx, "p", "kalq-m-chat__nodest", ew.noDest) : null, ...dests);
        append(win, top, log, script, add, settings);
    } else append(win, top, log, script, finish);
    if (!ctx.editor && !items.length && !textOf(ctx, "greeting")) return null;
    append(i, intro.children.length ? intro : null, win);
    return append(s, i);
}

//=================================== Testimonials (2.12, 2.13) ===================================//
const QUOTES = 6;

// 2.12 Testimonial slider: every quote is in the page, each a figure with its quote, a small round portrait, the
// name and role. js/moduleBehaviour.js shows one at a time (the others stay readable, in order, for screen readers)
// with a counter and previous/next buttons; never on its own. Without the script all quotes simply stand in a row.
function renderQuotes(ctx) {
    const s = section(ctx, "kalq-m-quotes");
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-quotes__list");
    shown(ctx, QUOTES, (n) => has(ctx, `quote${n}`)).forEach((n) => {
        const name = plain(textOf(ctx, `name${n}`));
        const photo = mediaEl(ctx, `photo${n}`, "kalq-m-quotes__photo", { alt: name });
        const quote = append(el(ctx, "blockquote", "kalq-m-quotes__quote"), slotEl(ctx, `quote${n}`, "p", { className: "kalq-m-quotes__text" }));
        const who = append(el(ctx, "figcaption", "kalq-m-quotes__who"), photo,
            append(el(ctx, "span", "kalq-m-quotes__person"), slotEl(ctx, `name${n}`, "span", { className: "kalq-m-quotes__name" }), slotEl(ctx, `role${n}`, "span", { className: "kalq-m-quotes__role" })));
        list.append(append(el(ctx, "li", "kalq-m-quotes__slide"), append(el(ctx, "figure", "kalq-m-quotes__figure"), quote, who)));
    });
    if (!list.children.length && !ctx.editor) return null;
    append(i, head(ctx), list);
    return append(s, i);
}

// A rating, only one the editor typed (0 to 5): as text ("Rating: 4.5 of 5"), the stars beside it decoration
export const ratingOf = (raw) => {
    const n = parseFloat(String(raw || "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
};
export const ratingText = (n, lang) => (lang === "en" ? `Rating: ${n} of 5` : `Bewertung: ${String(n).replace(".", ",")} von 5`);

function rating(ctx, slot) {
    if (ctx.editor) return slotEl(ctx, slot, "p", { className: "kalq-m-cards__rating-field" });
    const n = ratingOf(plain(textOf(ctx, slot)));
    if (n == null) return null;
    const p = el(ctx, "p", "kalq-m-cards__rating");
    p.setAttribute("data-rating", String(n));
    const stars = el(ctx, "span", "kalq-m-cards__stars", "★★★★★");
    stars.setAttribute("aria-hidden", "true");
    stars.setAttribute("style", `--rating: ${n / 5}`);
    return append(p, el(ctx, "span", "kalq-m-cards__rating-text", ratingText(n, ctx.lang)), stars);
}

// 2.13 Testimonial photo cards: two cards side by side, each a tall photo fading to the accent colour, the name, a
// detail line, a rating (only a real one) and the quote
function renderPhotoCards(ctx) {
    const s = section(ctx, "kalq-m-cards");
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-cards__list");
    [1, 2].forEach((n) => {
        if (!ctx.editor && !has(ctx, `quote${n}`)) return;
        const name = plain(textOf(ctx, `name${n}`));
        const photo = mediaEl(ctx, `photo${n}`, "kalq-m-cards__photo", { alt: name });
        const body = append(el(ctx, "div", "kalq-m-cards__body"), slotEl(ctx, `name${n}`, "h3", { className: "kalq-m-cards__name" }),
            slotEl(ctx, `detail${n}`, "p", { className: "kalq-m-cards__detail" }), rating(ctx, `rating${n}`),
            append(el(ctx, "blockquote", "kalq-m-cards__quote"), slotEl(ctx, `quote${n}`, "p", {})));
        list.append(append(el(ctx, "li", "kalq-m-cards__card"), photo ? append(el(ctx, "div", "kalq-m-cards__pic"), photo, el(ctx, "div", "kalq-m-cards__fade")) : null, body));
    });
    list.querySelectorAll(".kalq-m-cards__fade").forEach((f) => f.setAttribute("aria-hidden", "true"));
    if (!list.children.length && !ctx.editor) return null;
    append(i, head(ctx), list);
    return append(s, i);
}


//=================================== Cards (2.14–2.18) and the cascade (2.19) ===================================//
const CARDS = 12;
const GRID = 10;
const SLIDES = 5;

// A card's outer element: one link when it has an address (the whole card), else a plain block
function cardShell(ctx, n, cls) {
    const href = ctx.editor ? null : hrefOf(ctx, `link${n}`);
    const card = el(ctx, href ? "a" : "div", cls);
    if (href) card.setAttribute("href", href);
    return card;
}

// Tags typed as "a, b, c": a real list of small pills
function tagList(ctx, slot, cls) {
    if (ctx.editor) return slotEl(ctx, slot, "p", { className: `${cls} is-edit` });
    const tags = plain(textOf(ctx, slot)).split(/,|\n/).map((t) => t.trim()).filter(Boolean).slice(0, 5);
    if (!tags.length) return null;
    const ul = el(ctx, "ul", cls);
    tags.forEach((t) => ul.append(el(ctx, "li", "", t)));
    return ul;
}

// A typed date (2026-10-04 or 4.10.2026) as a real <time>; anything else is not shown
export function dateOf(raw) {
    const t = plain(raw);
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
function timeEl(ctx, slot, cls) {
    if (ctx.editor) return slotEl(ctx, slot, "span", { className: cls });
    const iso = dateOf(textOf(ctx, slot));
    if (!iso) return null;
    const t = el(ctx, "time", cls, new Date(`${iso}T12:00:00Z`).toLocaleDateString(ctx.lang === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
    t.setAttribute("datetime", iso);
    return t;
}

// The editor's link address field for a card (visitors: the card itself is the link)
const cardLink = (ctx, n) => editorField(ctx, `link${n}`, "p");

// 2.14 / 2.15 Card carousels: a row of cards that scrolls sideways (drag, swipe, buttons, a position indicator from
// js/moduleBehaviour.js). Without the script it is a plain horizontal list. 2.14 optionally drifts slowly (with a
// pause control); 2.15 puts the text over the picture, a "Drag" pill follows the cursor on desktops, and optional
// filter tabs (from the cards' categories) narrow the row.
function renderCarousel(ctx, kind) {
    const v = ctx.entry.version;
    const tall = kind === "carousel" && v === "tall";
    const s = section(ctx, `kalq-m-car is-${kind} is-${v}`);
    if (!ctx.editor && kind === "carousel" && rangeOf(ctx, "drift") > 0) s.setAttribute("data-drift", String(rangeOf(ctx, "drift")));
    if (!ctx.editor && kind === "drag" && v === "filter") s.setAttribute("data-filter", "");
    if (!ctx.editor) s.setAttribute("data-carousel", kind); // visitors: js/moduleBehaviour.js adds the controls
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-car__track");
    shown(ctx, CARDS, (n) => has(ctx, `title${n}`)).forEach((n) => {
        const card = cardShell(ctx, n, "kalq-m-car__card");
        const media = mediaEl(ctx, `image${n}`, "kalq-m-car__media");
        const title = slotEl(ctx, `title${n}`, "h3", { className: "kalq-m-car__title" });
        const text = slotEl(ctx, `text${n}`, "p", { className: "kalq-m-car__text" });
        if (kind === "drag") {
            const cat = slotEl(ctx, `category${n}`, "p", { className: "kalq-m-car__pill" });
            append(card, media, el(ctx, "div", "kalq-m-car__shade"), append(el(ctx, "div", "kalq-m-car__over"), cat, title, text));
        } else if (tall) {
            append(card, media, append(el(ctx, "div", "kalq-m-car__over is-top"), title, text), tagList(ctx, `tags${n}`, "kalq-m-car__tags"));
        } else append(card, media, append(el(ctx, "div", "kalq-m-car__body"), title, text));
        card.querySelector(".kalq-m-car__shade")?.setAttribute("aria-hidden", "true");
        const li = append(el(ctx, "li", "kalq-m-car__item"), card, altField(ctx, `image${n}`), cardLink(ctx, n));
        if (kind === "drag") { const c = plain(textOf(ctx, `category${n}`)); if (c) li.setAttribute("data-category", c); }
        list.append(li);
    });
    if (!list.children.length && !ctx.editor) return null;
    const top = append(el(ctx, "div", "kalq-m-car__top"), head(ctx, { cls: "kalq-m-lib__head kalq-m-car__head" }), textLink(ctx, "all_label", "all_link", "curved"));
    append(i, top, append(el(ctx, "div", "kalq-m-car__viewport"), list), ctx.editor && kind === "carousel" ? rangeEl(ctx, "drift") : null);
    return append(s, i);
}

// 2.16 Magazine grid: four columns; the first and eighth card of every ten span two by two (text over the picture),
// the others picture above text. Category, title, author and a real date. Pictures come in from a clipped, enlarged
// start and drift a little with the scroll (desktop, js/moduleBehaviour.js).
function renderGrid(ctx) {
    const s = section(ctx, "kalq-m-grid");
    reveal(ctx, s, "clip");
    const i = inner(ctx);
    const list = el(ctx, "ul", "kalq-m-grid__list");
    shown(ctx, GRID, (n) => has(ctx, `title${n}`)).forEach((n, k) => {
        const large = k % 10 === 0 || k % 10 === 7;
        const card = cardShell(ctx, n, "kalq-m-grid__card");
        const media = mediaEl(ctx, `image${n}`, "kalq-m-grid__media");
        if (media) media.setAttribute("data-depth", "0.05");
        const photo = mediaEl(ctx, `author_photo${n}`, "kalq-m-grid__avatar", { alt: "" }); // beside the name: decoration
        const meta = append(el(ctx, "p", "kalq-m-grid__meta"), photo, slotEl(ctx, `author${n}`, "span", { className: "kalq-m-grid__author" }), timeEl(ctx, `date${n}`, "kalq-m-grid__date"));
        append(card, media ? append(el(ctx, "div", "kalq-m-grid__pic"), media, large ? el(ctx, "div", "kalq-m-grid__shade") : null) : null,
            append(el(ctx, "div", "kalq-m-grid__body"), slotEl(ctx, `category${n}`, "p", { className: "kalq-m-grid__pill" }), slotEl(ctx, `title${n}`, "h3", { className: "kalq-m-grid__title" }), meta.children.length ? meta : null));
        card.querySelector(".kalq-m-grid__shade")?.setAttribute("aria-hidden", "true");
        list.append(append(el(ctx, "li", `kalq-m-grid__item kalq-reveal-item${large ? " is-large" : ""}`), card, altField(ctx, `image${n}`), cardLink(ctx, n)));
    });
    if (!list.children.length && !ctx.editor) return null;
    append(i, append(el(ctx, "div", "kalq-m-car__top"), head(ctx), textLink(ctx, "all_label", "all_link", "curved")), list);
    return append(s, i);
}

// 2.17 Featured story: a full-width picture (drifting slower than the page), the category, title, excerpt, author
// and a "read more" link. It opens from a rounded, inset frame to the full width; then the text comes in.
function renderStory(ctx) {
    const s = section(ctx, "kalq-m-story");
    reveal(ctx, s, "story");
    const media = mediaEl(ctx, "image", "kalq-m-story__media");
    if (media) media.querySelector("img, video")?.setAttribute("data-depth", "-0.08");
    const i = inner(ctx, "kalq-m-story__inner");
    const meta = append(el(ctx, "p", "kalq-m-story__meta kalq-reveal-item"), slotEl(ctx, "author", "span", { className: "kalq-m-story__author" }), timeEl(ctx, "date", "kalq-m-story__date"));
    append(i, slotEl(ctx, "category", "p", { className: "kalq-m-story__pill kalq-reveal-item" }),
        slotEl(ctx, "heading", "h2", { className: "kalq-m-story__title kalq-reveal-item" }),
        slotEl(ctx, "excerpt", "div", { className: "kalq-m-text kalq-m-story__excerpt kalq-reveal-item", format: "paragraphs" }),
        meta.children.length ? meta : null);
    const more = textLink(ctx, "more_label", "link", "curved");
    if (more) i.append(append(el(ctx, "p", "kalq-m-story__more kalq-reveal-item"), more));
    append(s, media ? append(el(ctx, "div", "kalq-m-story__frame"), media, el(ctx, "div", "kalq-m-story__shade")) : null, i, altField(ctx, "image"));
    s.querySelector(".kalq-m-story__shade")?.setAttribute("aria-hidden", "true");
    if (media) s.classList.add("has-media");
    return s;
}

// 2.18 Full-width slider: wide slides (2:1, at least 575px), each a background picture, a headline and a link.
// Arrows and dots from js/moduleBehaviour.js; it changes on its own only if the editor sets seconds (then with a pause
// control, and never under reduced motion). The slides not shown stay readable in order; focusing one shows it.
function renderSlides(ctx) {
    const s = section(ctx, "kalq-m-slides");
    const auto = rangeOf(ctx, "auto");
    if (!ctx.editor && auto > 0) s.setAttribute("data-auto", String(auto));
    if (!ctx.editor) s.setAttribute("data-slider", "");
    const list = el(ctx, "ul", "kalq-m-slides__list");
    shown(ctx, SLIDES, (n) => has(ctx, `headline${n}`)).forEach((n) => {
        const media = mediaEl(ctx, `image${n}`, "kalq-m-slides__media");
        if (media) media.setAttribute("aria-hidden", "true");
        const body = append(el(ctx, "div", "kalq-m-slides__body"), slotEl(ctx, `headline${n}`, "h2", { className: "kalq-m-slides__headline" }), textLink(ctx, `link_label${n}`, `link${n}`));
        list.append(append(el(ctx, "li", "kalq-m-slides__slide"), media, el(ctx, "div", "kalq-m-slides__shade"), body));
    });
    list.querySelectorAll(".kalq-m-slides__shade").forEach((x) => x.setAttribute("aria-hidden", "true"));
    if (!list.children.length && !ctx.editor) return null;
    append(s, list, ctx.editor ? rangeEl(ctx, "auto") : null);
    return s;
}

// 2.19 Cascading image: a coloured block set 20% down, the picture over it set 10% down, each drifting at its own
// speed with the scroll (desktop); text with heading, paragraph and link beside it. Sides and shape per version.
function renderCascade(ctx) {
    const v = ctx.entry.version || "image-left-square";
    const s = section(ctx, `kalq-m-cascade is-${v.startsWith("image-right") ? "image-right" : "image-left"} is-${v.endsWith("tall") ? "tall" : "square"}`);
    const i = inner(ctx);
    const media = mediaEl(ctx, "image", "kalq-m-cascade__media");
    if (media) media.setAttribute("data-depth", "-0.06");
    const block = el(ctx, "div", "kalq-m-cascade__block");
    block.setAttribute("aria-hidden", "true");
    block.setAttribute("data-depth", "0.06");
    const visual = append(el(ctx, "div", "kalq-m-cascade__visual"), block, media, altField(ctx, "image"));
    const text = append(el(ctx, "div", "kalq-m-cascade__text"), slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }),
        slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }), textLink(ctx, "link_label", "link"));
    append(i, visual, text);
    return append(s, i);
}

// The book's unit for the card modules: the cards in a grid over the spread (the heading first)
function cardsUnit(s, k) {
    const cards = [...s.querySelectorAll(".kalq-m-car__item, .kalq-m-grid__item")].map((li) => ({
        media: k.mediaUrl(li.querySelector(".kalq-m-car__media, .kalq-m-grid__media")),
        eyebrow: li.querySelector(".kalq-m-car__pill, .kalq-m-grid__pill") || li.querySelector(".kalq-m-car__tags"),
        title: li.querySelector(".kalq-m-car__title, .kalq-m-grid__title"),
        lead: li.querySelector(".kalq-m-car__text"),
        meta: li.querySelector(".kalq-m-grid__meta"),
        href: (li.querySelector("a.kalq-m-car__card, a.kalq-m-grid__card") || null)?.getAttribute("href") || null,
    })).filter((c) => c.title?.textContent.trim());
    return { layout: "R", eyebrow: s.querySelector(".kalq-m-lib__head .kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
        actions: [...s.querySelectorAll(".kalq-m-car__top a.kalq-link-curved")], cards };
}

//=================================== Definitions ===================================//
const statementSlots = {
    heading: { kind: "heading", label: L("Die Aussage (ein großer Satz)", "The statement (one large sentence)"), required: true },
    label: { kind: "eyebrow", label: L("Kleines Etikett (erscheint in Klammern)", "Small label (shown in brackets)") },
    text1: { kind: "text", label: L("Erster Absatz", "First paragraph") },
    text2: { kind: "text", label: L("Zweiter Absatz", "Second paragraph") },
    link_label: { kind: "button", label: L("Textlink", "Text link") },
    link: { kind: "link", label: L("Textlink-Adresse", "Text link address") },
    ...Object.fromEntries(picture("portrait", L("Kleines Porträt (optional)", "Small portrait (optional)"))),
};

export const LIBRARY = {
    "content.statement": {
        category: "content",
        name: L("Aussage", "Statement"),
        keywords: "statement aussage satz sentence words reveal",
        slots: statementSlots,
        versions: {
            reveal: { name: L("Wörter steigen auf", "Words rise in"),
                wire: [["heading", 6, 10, 88], ["heading", 6, 16, 70], ["heading", 6, 22, 50], ["media", 6, 34, 12, 14], ["eyebrow", 50, 34, 12], ["line", 50, 39, 40], ["line", 50, 43, 36], ["line", 50, 49, 16, "bold"]] },
            still: { name: L("Ruhig, ohne Bewegung", "Still, no motion"),
                wire: [["heading", 6, 12, 88], ["heading", 6, 18, 66], ["eyebrow", 50, 32, 12], ["line", 50, 37, 40], ["line", 50, 41, 36], ["line", 50, 47, 16, "bold"]] },
        },
        magazine: {
            layout: "B",
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-m-statement__label"), title: s.querySelector(".kalq-m-statement__text"),
                body: [...k.parasOf(s.querySelectorAll(".kalq-m-statement__copy .kalq-m-text")[0]), ...k.parasOf(s.querySelectorAll(".kalq-m-statement__copy .kalq-m-text")[1])],
                actions: [...s.querySelectorAll("a.kalq-link-underline")] }),
        },
        render: renderStatement,
    },
    "content.services": {
        category: "content",
        name: L("Nummerierte Leistungen", "Numbered services"),
        keywords: "services leistungen numbered nummeriert list liste",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...items(SERVICES, (n) => [
                [`title${n}`, { kind: "heading", label: L(`Leistung ${n}: Titel`, `Service ${n}: title`), required: n === 1 }],
                [`text${n}`, { kind: "text", label: L(`Leistung ${n}: Text`, `Service ${n}: text`) }],
                ...picture(`image${n}`, L(`Leistung ${n}: Bild`, `Service ${n}: picture`)),
            ]),
        },
        versions: {
            "image-right": { name: L("Text links, Bild rechts", "Text left, picture right"),
                wire: [["heading", 6, 6, 30], ...[16, 36].flatMap((y) => [["heading", 6, y, 6], ["line", 16, y, 26, "bold"], ["line", 16, y + 5, 30], ["line", 16, y + 9, 26], ["media", 56, y - 2, 38, 16]])] },
            alternating: { name: L("Abwechselnd links und rechts", "Alternating sides"),
                wire: [["heading", 6, 6, 30], ["heading", 6, 16, 6], ["line", 16, 16, 26, "bold"], ["line", 16, 21, 30], ["media", 56, 14, 38, 16],
                    ["media", 6, 34, 38, 16], ["heading", 52, 36, 6], ["line", 62, 36, 26, "bold"], ["line", 62, 41, 30]] },
        },
        magazine: {
            layout: "A",
            unit: (s, k) => ({ layout: "A", order: "media-text", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
                body: [...s.querySelectorAll(".kalq-m-services__item")].flatMap((it, i) => [
                    k.textOf(it.querySelector(".kalq-m-services__title"), "h3", "bk-subtitle", `${String(i + 1).padStart(2, "0")} `), ...k.parasOf(it.querySelector(".kalq-m-text"))]),
                media: [...s.querySelectorAll(".kalq-m-services__media")].map(k.mediaUrl).filter(Boolean).slice(0, 2) }),
        },
        render: renderServices,
    },
    "content.feature-row": {
        category: "content",
        name: L("Bilder und drei Merkmale", "Pictures and three features"),
        keywords: "feature row merkmale features images bilder three drei",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...Object.fromEntries([...picture("image1", L("Erstes Bild", "First picture"), { required: true }), ...picture("image2", L("Zweites Bild", "Second picture"))]),
            ...items(3, (n) => [
                [`ftitle${n}`, { kind: "heading", label: L(`Merkmal ${n}: Titel`, `Feature ${n}: title`), required: n === 1 }],
                [`ftext${n}`, { kind: "text", label: L(`Merkmal ${n}: Text`, `Feature ${n}: text`) }],
            ]),
        },
        versions: {
            "images-left": { name: L("Bilder links, Merkmale rechts", "Pictures left, features right"),
                wire: [["media", 4, 10, 22, 36], ["media", 28, 10, 22, 36], ...[12, 24, 36].flatMap((y) => [["line", 58, y, 24, "bold"], ["line", 58, y + 4, 34]])] },
            "text-left": { name: L("Merkmale links, Bilder rechts", "Features left, pictures right"),
                wire: [...[12, 24, 36].flatMap((y) => [["line", 6, y, 24, "bold"], ["line", 6, y + 4, 34]]), ["media", 50, 10, 22, 36], ["media", 74, 10, 22, 36]] },
        },
        magazine: {
            layout: "A",
            unit: (s, k) => ({ layout: "A", order: s.classList.contains("is-text-left") ? "text-media" : "media-text", eyebrow: s.querySelector(".kalq-m-eyebrow"),
                title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
                body: [...s.querySelectorAll(".kalq-m-featrow__item")].flatMap((it) => [k.textOf(it.querySelector(".kalq-m-featrow__title"), "h3", "bk-subtitle"), ...k.parasOf(it.querySelector(".kalq-m-text"))]),
                media: [...s.querySelectorAll(".kalq-m-featrow__media")].map(k.mediaUrl).filter(Boolean) }),
        },
        render: renderFeatureRow,
    },
    "content.three": {
        category: "content",
        name: L("Drei Merkmale", "Three features"),
        keywords: "three features drei merkmale columns spalten",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...items(3, (n) => [
                [`title${n}`, { kind: "heading", label: L(`Spalte ${n}: Titel`, `Column ${n}: title`), required: n === 1 }],
                [`text${n}`, { kind: "text", label: L(`Spalte ${n}: Text`, `Column ${n}: text`) }],
                [`link_label${n}`, { kind: "button", label: L(`Spalte ${n}: Link-Text (optional)`, `Column ${n}: link text (optional)`) }],
                [`link${n}`, { kind: "link", label: L(`Spalte ${n}: Link-Adresse`, `Column ${n}: link address`) }],
            ]),
        },
        versions: {
            centred: { name: L("Drei Spalten, zentriert", "Three columns, centred"),
                wire: [["heading", 34, 8, 32], ...[8, 38, 68].flatMap((x) => [["line", x + 4, 24, 16, "bold"], ["line", x, 30, 24], ["line", x + 2, 34, 20], ["line", x + 7, 40, 10]])] },
        },
        magazine: {
            layout: "B",
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading") || s.querySelector(".kalq-m-three__title"),
                body: [...s.querySelectorAll(".kalq-m-three__item")].flatMap((it, i) => [i === 0 && !s.querySelector(".kalq-m-lib__head .kalq-m-heading") ? null : k.textOf(it.querySelector(".kalq-m-three__title"), "h3", "bk-subtitle"),
                    ...k.parasOf(it.querySelector(".kalq-m-text"))]).filter(Boolean),
                actions: [...s.querySelectorAll("a.kalq-link-underline")] }),
        },
        render: renderThree,
    },
    "numbers.stats": {
        category: "numbers",
        name: L("Kennzahlen", "Stats band"),
        keywords: "stats zahlen kennzahlen numbers figures band",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...items(STATS, (n) => [
                [`figure${n}`, { kind: "heading", label: L(`Zahl ${n} (nur echte, belegbare Zahlen; leer: wird nicht gezeigt)`, `Figure ${n} (real, verifiable numbers only; empty: not shown)`), required: n === 1 }],
                [`label${n}`, { kind: "eyebrow", label: L(`Zahl ${n}: Etikett`, `Figure ${n}: label`) }],
                [`context${n}`, { kind: "text", label: L(`Zahl ${n}: eine Zeile dazu`, `Figure ${n}: one line of context`) }],
            ]),
            background: { kind: "media", label: L("Hintergrundbild (optional)", "Background picture (optional)") },
            shade: { kind: "range", label: L("Abdunkelung über dem Bild", "Darkening over the picture"), min: 0, max: 100, step: 5, initial: 45, unit: "%" },
        },
        versions: {
            image: { name: L("Auf einem Bild", "Over a picture"),
                wire: [["band", 0, 6, 100, 48], ...[6, 30, 54, 78].flatMap((x) => [["eyebrow", x, 20, 10, "light"], ["heading", x, 26, 14, "light"], ["line", x, 33, 16, "light"]])] },
            colour: { name: L("Auf Farbe", "On colour"),
                wire: [...[6, 30, 54, 78].flatMap((x) => [["eyebrow", x, 20, 10], ["heading", x, 26, 14], ["line", x, 33, 16]])] },
        },
        magazine: {
            layout: "S",
            unit: (s) => ({ layout: "S", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
                stats: [...s.querySelectorAll(".kalq-m-stats__item")].map((it) => ({ label: it.querySelector(".kalq-m-stats__label"), figure: it.querySelector(".kalq-m-stats__figure"), context: it.querySelector(".kalq-m-stats__context") }))
                    .filter((x) => x.figure?.textContent.trim()) }),
        },
        render: renderStats,
    },
    "numbers.pricing": {
        category: "numbers",
        name: L("Preistabelle", "Pricing table"),
        keywords: "pricing preise preis plans pakete tarife table tabelle",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            includes: { kind: "eyebrow", label: L("Etikett über den Leistungen, z. B. Enthalten", "Label above the features, e.g. Includes") },
            ...items(PLANS, (n) => [
                [`name${n}`, { kind: "heading", label: L(`Paket ${n}: Name`, `Plan ${n}: name`), required: n <= 2 }],
                [`badge${n}`, { kind: "eyebrow", label: L(`Paket ${n}: Hervorhebung, z. B. Empfohlen (optional)`, `Plan ${n}: badge, e.g. Recommended (optional)`) }],
                [`desc${n}`, { kind: "text", label: L(`Paket ${n}: Beschreibung`, `Plan ${n}: description`) }],
                [`price${n}`, { kind: "heading", label: L(`Paket ${n}: Preis (leer: kein Preis)`, `Plan ${n}: price (empty: no price)`) }],
                [`period${n}`, { kind: "eyebrow", label: L(`Paket ${n}: Zeitraum, z. B. / Monat`, `Plan ${n}: period, e.g. / month`) }],
                [`button${n}`, { kind: "button", label: L(`Paket ${n}: Button-Text`, `Plan ${n}: button label`) }],
                [`link${n}`, { kind: "link", label: L(`Paket ${n}: Button-Link`, `Plan ${n}: button link`) }],
                [`features${n}`, { kind: "text", label: L(`Paket ${n}: Leistungen, eine pro Zeile`, `Plan ${n}: features, one per line`) }],
            ]),
        },
        versions: {
            bordered: { name: L("Spalten mit Linien", "Columns with lines"),
                wire: [["heading", 30, 4, 40], ...[4, 36, 68].flatMap((x) => [["rule", x, 12, 28], ["line", x + 2, 16, 12, "bold"], ["heading", x + 2, 22, 14], ["button", x + 2, 28, 18], ["line", x + 2, 36, 20], ["line", x + 2, 40, 18], ["line", x + 2, 44, 16]])] },
            cards: { name: L("Karten", "Cards"),
                wire: [["heading", 30, 4, 40], ["band", 4, 12, 28, 40], ["band", 36, 12, 28, 40], ["band", 68, 12, 28, 40], ...[4, 36, 68].flatMap((x) => [["line", x + 2, 16, 12, "light"], ["heading", x + 2, 22, 14, "light"], ["button", x + 2, 28, 18, "light"]])] },
        },
        magazine: {
            layout: "P",
            unit: (s, k) => ({ layout: "P", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
                includes: s.querySelector(".kalq-m-pricing__includes"),
                plans: [...s.querySelectorAll(".kalq-m-pricing__plan")].map((p) => ({ name: p.querySelector(".kalq-m-pricing__name"), badge: p.querySelector(".kalq-m-pricing__badge"),
                    desc: p.querySelector(".kalq-m-pricing__desc"), price: p.querySelector(".kalq-m-pricing__price"), action: p.querySelector("a.kalq-m-button"),
                    features: p.querySelector("ul.kalq-m-pricing__features") })).filter((p) => p.name?.textContent.trim()) }),
        },
        render: renderPricing,
    },
    "cta.sentence": {
        category: "cta",
        name: L("Satz als Link", "Sentence as a link"),
        keywords: "call to action cta sentence satz link band",
        slots: {
            heading: { kind: "heading", label: L("Der Satz (ist der Link)", "The sentence (it is the link)"), required: true },
            link: { kind: "link", label: L("Wohin der Satz führt", "Where the sentence leads"), required: true },
            background: { kind: "media", label: L("Hintergrundbild (optional)", "Background picture (optional)") },
        },
        versions: {
            colour: { name: L("Auf Farbe", "On colour"),
                wire: [["band", 0, 10, 100, 40], ["heading", 18, 24, 64, "light"], ["heading", 28, 31, 44, "light"]] },
            image: { name: L("Auf einem Bild", "Over a picture"),
                wire: [["media", 0, 10, 100, 40], ["heading", 18, 24, 64, "light"], ["heading", 28, 31, 44, "light"]] },
        },
        magazine: {
            layout: "B",
            unit: (s) => ({ layout: "B", title: s.querySelector(".kalq-m-ctaline__text"), actions: [...s.querySelectorAll("a.kalq-m-ctaline__link")] }),
        },
        render: renderCtaSentence,
    },
    "interaction.contact": {
        category: "interaction",
        name: L("Kontakt", "Contact"),
        keywords: "contact kontakt email e-mail linkedin social netzwerke",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            text: { kind: "text", label: L("Text (optional)", "Text (optional)") },
            label: { kind: "eyebrow", label: L("Etikett, z. B. Schreiben Sie uns", "Label, e.g. Write to us") },
            email: { kind: "text", label: L("E-Mail-Adresse (groß, als Link)", "Email address (large, as a link)"), required: true },
            ...items(4, (n) => [
                [`social${n}`, { kind: "button", label: L(`Netzwerk ${n}, z. B. LinkedIn`, `Network ${n}, e.g. LinkedIn`) }],
                [`social_link${n}`, { kind: "link", label: L(`Netzwerk ${n}: Adresse`, `Network ${n}: address`) }],
            ]),
        },
        versions: {
            split: { name: L("Überschrift links, Kontakt rechts", "Heading left, contact right"),
                wire: [["heading", 6, 14, 30], ["line", 6, 22, 26], ["eyebrow", 56, 14, 14], ["heading", 56, 20, 36], ["line", 56, 32, 16, "bold"], ["line", 56, 37, 14, "bold"]] },
        },
        magazine: {
            layout: "B",
            unit: (s, k) => ({ layout: "B", eyebrow: s.querySelector(".kalq-m-contact__left .kalq-m-eyebrow"), title: s.querySelector(".kalq-m-contact__left .kalq-m-heading"),
                lead: s.querySelector(".kalq-m-contact__right .kalq-m-eyebrow"), body: k.parasOf(s.querySelector(".kalq-m-contact__left .kalq-m-text")),
                actions: [...s.querySelectorAll("a.kalq-m-contact__email, a.kalq-m-contact__word")] }),
        },
        render: renderContact,
    },
    "interaction.inquiry": {
        category: "interaction",
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
            ...Object.fromEntries(CHAT_DESTS.map((d) => [d.id, { kind: "button", label: L(CHAT_WORDS.de.dest[d.id], CHAT_WORDS.en.dest[d.id]) }])),
        },
        versions: {
            chat: { name: L("Chat mit Fragen zum Antippen", "Chat with questions to tap"),
                wire: [["heading", 6, 18, 28], ["line", 6, 25, 24], ["band", 50, 6, 44, 50], ["media", 53, 12, 5, 5], ["line", 60, 13, 26, "light"], ["line", 60, 17, 20, "light"],
                    ["button", 60, 24, 10, "light"], ["button", 72, 24, 12, "light"], ["line", 74, 33, 16, "light"], ["button", 60, 46, 30, "light"]] },
        },
        // a new chat starts with one question of each kind, its words to fill in
        initialOpts: () => ({ items: [{ id: Math.random().toString(36).slice(2, 8), kind: "choice" }, { id: Math.random().toString(36).slice(2, 8), kind: "text" }], contact: true }),
        // it can go live once it has a greeting, at least one question with words, and somewhere to send to
        missing: (entry, page, get) => {
            const out = [];
            const has = (slot) => { const e = get(`${page}.${entry.id}.${slot}`); return e && (e.de || e.en); };
            if (!chatItems(entry).some((it) => has(`q_${it.id}`))) out.push(L("eine Frage", "a question"));
            const value = (slot) => { const e = get(`${page}.${entry.id}.${slot}`); return e ? (e.de ?? e.en) : null; };
            if (!CHAT_DESTS.some((d) => value(d.id) && d.to(value(d.id)))) out.push(L("ein Ziel zum Senden (WhatsApp, Telegram, Threema, SMS oder E-Mail)", "a destination to send to (WhatsApp, Telegram, Threema, SMS or email)"));
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
    "testimonials.slider": {
        category: "testimonials",
        name: L("Zitate, eins nach dem anderen", "Testimonial slider"),
        keywords: "testimonial zitat quote stimmen slider kunden customers",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...items(QUOTES, (n) => [
                [`quote${n}`, { kind: "text", label: L(`Zitat ${n} (nur echte Zitate)`, `Quote ${n} (real quotes only)`), required: n === 1 }],
                [`name${n}`, { kind: "button", label: L(`Zitat ${n}: Name`, `Quote ${n}: name`), required: n === 1 }],
                [`role${n}`, { kind: "button", label: L(`Zitat ${n}: Rolle, Firma`, `Quote ${n}: role, company`) }],
                [`photo${n}`, { kind: "media", label: L(`Zitat ${n}: kleines Porträt (Beschreibung: der Name)`, `Quote ${n}: small portrait (described by the name)`) }],
            ]),
        },
        versions: {
            single: { name: L("Ein Zitat groß, mit Zähler und Pfeilen", "One large quote, with counter and arrows"),
                wire: [["heading", 10, 12, 80], ["heading", 10, 19, 70], ["heading", 10, 26, 50], ["media", 10, 38, 6, 8], ["line", 18, 40, 16, "bold"], ["line", 18, 44, 12], ["line", 74, 42, 8], ["plus", 86, 41], ["plus", 90, 41]] },
        },
        magazine: {
            layout: "Q",
            unit: (s, k) => ({ layout: "Q", eyebrow: s.querySelector(".kalq-m-eyebrow"), title: s.querySelector(".kalq-m-lib__head .kalq-m-heading"),
                quotes: [...s.querySelectorAll(".kalq-m-quotes__slide")].map((q) => ({ text: q.querySelector(".kalq-m-quotes__text"), name: q.querySelector(".kalq-m-quotes__name"), role: q.querySelector(".kalq-m-quotes__role"),
                    photo: k.mediaUrl(q.querySelector(".kalq-m-quotes__photo")) })).filter((q) => q.text?.textContent.trim()) }),
        },
        render: renderQuotes,
    },
    "testimonials.photo-cards": {
        category: "testimonials",
        name: L("Zwei Stimmen mit Foto", "Testimonial photo cards"),
        keywords: "testimonial zitat quote photo foto cards karten rating bewertung",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            ...items(2, (n) => [
                [`photo${n}`, { kind: "media", label: L(`Karte ${n}: hohes Foto (Beschreibung: der Name)`, `Card ${n}: tall photo (described by the name)`), required: n === 1 }],
                [`name${n}`, { kind: "heading", label: L(`Karte ${n}: Name`, `Card ${n}: name`), required: n === 1 }],
                [`detail${n}`, { kind: "eyebrow", label: L(`Karte ${n}: eine Zeile, z. B. Rolle und Firma`, `Card ${n}: one line, e.g. role and company`) }],
                [`rating${n}`, { kind: "button", label: L(`Karte ${n}: Bewertung 0 bis 5 (nur eine echte; leer: keine)`, `Card ${n}: rating 0 to 5 (a real one only; empty: none)`) }],
                [`quote${n}`, { kind: "text", label: L(`Karte ${n}: Zitat (nur echte Zitate)`, `Card ${n}: quote (real quotes only)`), required: n === 1 }],
            ]),
        },
        versions: {
            pair: { name: L("Zwei Karten nebeneinander", "Two cards side by side"),
                wire: [["media", 6, 6, 42, 30], ["media", 52, 6, 42, 30], ["line", 6, 40, 16, "bold"], ["line", 52, 40, 16, "bold"], ["line", 6, 45, 36], ["line", 52, 45, 36], ["line", 6, 49, 30], ["line", 52, 49, 30]] },
        },
        magazine: {
            layout: "E",
            unit: (s, k) => ({ layout: "E", cards: [...s.querySelectorAll(".kalq-m-cards__card")].map((c) => ({ media: k.mediaUrl(c.querySelector(".kalq-m-cards__photo")), eyebrow: c.querySelector(".kalq-m-cards__detail"),
                title: c.querySelector(".kalq-m-cards__name"), lead: c.querySelector(".kalq-m-cards__quote p"), body: k.parasOf(c.querySelector(".kalq-m-cards__rating-text")) })) }),
        },
        render: renderPhotoCards,
    },
    "cards.carousel": {
        category: "cards",
        name: L("Karten zum Blättern", "Card carousel"),
        keywords: "cards karten carousel slider products produkte services leistungen",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            all_label: { kind: "button", label: L("Link „Alle ansehen“ (optional)", "\"View all\" link (optional)") },
            all_link: { kind: "link", label: L("Adresse für „Alle ansehen“", "Address for \"View all\"") },
            drift: { kind: "range", label: L("Langsames Gleiten (0 = aus)", "Slow drift (0 = off)"), min: 0, max: 3, step: 1, initial: 0, unit: "" },
            ...items(CARDS, (n) => [
                ...picture(`image${n}`, L(`Karte ${n}: Bild`, `Card ${n}: picture`)),
                [`title${n}`, { kind: "heading", label: L(`Karte ${n}: Titel`, `Card ${n}: title`), required: n === 1 }],
                [`text${n}`, { kind: "text", label: L(`Karte ${n}: kurzer Text`, `Card ${n}: short text`) }],
                [`tags${n}`, { kind: "button", label: L(`Karte ${n}: Schlagworte, mit Komma (Version „hoch“)`, `Card ${n}: tags, comma separated ("tall" version)`) }],
                [`link${n}`, { kind: "link", label: L(`Karte ${n}: Link (die ganze Karte)`, `Card ${n}: link (the whole card)`) }],
            ]),
        },
        versions: {
            standard: { name: L("Bild 4:5 über dem Text", "Picture 4:5 above the text"),
                wire: [["heading", 4, 6, 30], ...[4, 28, 52, 76].flatMap((x) => [["media", x, 16, 21, 26], ["line", x, 45, 14, "bold"], ["line", x, 49, 18]])] },
            tall: { name: L("Hohe Karte, Titel oben, Schlagworte unten", "Tall card, title on top, tags below"),
                wire: [["heading", 4, 6, 30], ...[4, 28, 52, 76].flatMap((x) => [["media", x, 14, 21, 40], ["line", x + 2, 17, 14, "light"], ["button", x + 2, 48, 8, "light"]])] },
        },
        magazine: { layout: "R", unit: (s, k) => cardsUnit(s, k) },
        render: (ctx) => renderCarousel(ctx, "carousel"),
    },
    "cards.drag": {
        category: "cards",
        name: L("Karten zum Ziehen, Text im Bild", "Drag carousel"),
        keywords: "cards karten drag ziehen carousel filter kategorien categories",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            all_label: { kind: "button", label: L("Link „Alle ansehen“ (optional)", "\"View all\" link (optional)") },
            all_link: { kind: "link", label: L("Adresse für „Alle ansehen“", "Address for \"View all\"") },
            ...items(CARDS, (n) => [
                ...picture(`image${n}`, L(`Karte ${n}: Bild`, `Card ${n}: picture`)),
                [`category${n}`, { kind: "eyebrow", label: L(`Karte ${n}: Kategorie (auch der Filter)`, `Card ${n}: category (also the filter)`) }],
                [`title${n}`, { kind: "heading", label: L(`Karte ${n}: Titel`, `Card ${n}: title`), required: n === 1 }],
                [`text${n}`, { kind: "text", label: L(`Karte ${n}: kurzer Text`, `Card ${n}: short text`) }],
                [`link${n}`, { kind: "link", label: L(`Karte ${n}: Link (die ganze Karte)`, `Card ${n}: link (the whole card)`) }],
            ]),
        },
        versions: {
            plain: { name: L("Ohne Filter", "Without filters"),
                wire: [["heading", 4, 6, 30], ...[4, 34, 64].flatMap((x) => [["media", x, 16, 28, 36], ["line", x + 2, 44, 16, "light"], ["line", x + 2, 48, 20, "light"]])] },
            filter: { name: L("Mit Filtern nach Kategorie", "With category filters"),
                wire: [["heading", 4, 6, 30], ["button", 4, 13, 8], ["button", 14, 13, 10], ["button", 26, 13, 10], ...[4, 34, 64].flatMap((x) => [["media", x, 20, 28, 34], ["line", x + 2, 46, 16, "light"]])] },
        },
        magazine: { layout: "R", unit: (s, k) => cardsUnit(s, k) },
        render: (ctx) => renderCarousel(ctx, "drag"),
    },
    "cards.grid": {
        category: "cards",
        name: L("Magazin-Raster", "Magazine grid"),
        keywords: "magazine magazin grid raster blog articles artikel posts news",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift (optional)", "Heading (optional)") },
            all_label: { kind: "button", label: L("Link „Alle ansehen“ (optional)", "\"View all\" link (optional)") },
            all_link: { kind: "link", label: L("Adresse für „Alle ansehen“", "Address for \"View all\"") },
            ...items(GRID, (n) => [
                ...picture(`image${n}`, L(`Beitrag ${n}: Bild`, `Story ${n}: picture`)),
                [`category${n}`, { kind: "eyebrow", label: L(`Beitrag ${n}: Kategorie`, `Story ${n}: category`) }],
                [`title${n}`, { kind: "heading", label: L(`Beitrag ${n}: Titel`, `Story ${n}: title`), required: n === 1 }],
                [`author${n}`, { kind: "button", label: L(`Beitrag ${n}: Autor oder Autorin`, `Story ${n}: author`) }],
                [`author_photo${n}`, { kind: "media", label: L(`Beitrag ${n}: Foto der Person (klein)`, `Story ${n}: author photo (small)`) }],
                [`date${n}`, { kind: "button", label: L(`Beitrag ${n}: Datum, z. B. 2026-10-04 (leer: keins)`, `Story ${n}: date, e.g. 2026-10-04 (empty: none)`) }],
                [`link${n}`, { kind: "link", label: L(`Beitrag ${n}: Link (die ganze Karte)`, `Story ${n}: link (the whole card)`) }],
            ]),
        },
        versions: {
            grid: { name: L("Vier Spalten, große und kleine Karten", "Four columns, large and small cards"),
                wire: [["heading", 4, 4, 30], ["media", 4, 12, 44, 30], ["media", 52, 12, 20, 13], ["media", 76, 12, 20, 13], ["line", 52, 27, 14, "bold"], ["line", 76, 27, 14, "bold"], ["media", 52, 32, 20, 10], ["media", 76, 32, 20, 10], ["line", 6, 36, 24, "light"]] },
        },
        magazine: { layout: "R", unit: (s, k) => cardsUnit(s, k) },
        render: renderGrid,
    },
    "cards.story": {
        category: "cards",
        name: L("Hervorgehobener Beitrag", "Featured story banner"),
        keywords: "featured story beitrag banner artikel article hervorgehoben",
        slots: {
            ...Object.fromEntries(picture("image", L("Bild über die ganze Breite", "Full-width picture"), { required: true })),
            category: { kind: "eyebrow", label: L("Kategorie", "Category") },
            heading: { kind: "heading", label: L("Titel", "Title"), required: true },
            excerpt: { kind: "text", label: L("Auszug", "Excerpt") },
            author: { kind: "button", label: L("Autor oder Autorin", "Author") },
            date: { kind: "button", label: L("Datum, z. B. 2026-10-04 (leer: keins)", "Date, e.g. 2026-10-04 (empty: none)") },
            more_label: { kind: "button", label: L("Link-Text, z. B. Weiterlesen", "Link text, e.g. Read more") },
            link: { kind: "link", label: L("Link-Adresse", "Link address") },
        },
        versions: {
            banner: { name: L("Bild über die ganze Breite, Text darüber", "Full-width picture, text over it"),
                wire: [["media", 0, 6, 100, 48], ["eyebrow", 6, 30, 10, "light"], ["heading", 6, 35, 50, "light"], ["line", 6, 42, 40, "light"], ["line", 6, 47, 14, "light"]] },
        },
        magazine: {
            layout: "A",
            unit: (s, k) => ({ layout: "A", order: "media-text", eyebrow: s.querySelector(".kalq-m-story__pill"), title: s.querySelector(".kalq-m-story__title"),
                body: [...k.parasOf(s.querySelector(".kalq-m-story__excerpt")), ...k.parasOf(s.querySelector(".kalq-m-story__meta"), "bk-small")],
                actions: [...s.querySelectorAll(".kalq-m-story__more a")], media: [k.mediaUrl(s.querySelector(".kalq-m-story__media"))] }),
        },
        render: renderStory,
    },
    "cards.slider": {
        category: "cards",
        name: L("Breite Bildfolge", "Full-width slider"),
        keywords: "slider slideshow bildfolge banner full width breit",
        slots: {
            auto: { kind: "range", label: L("Automatischer Wechsel, Sekunden (0 = aus)", "Changes on its own, seconds (0 = off)"), min: 0, max: 12, step: 1, initial: 0, unit: " s" },
            ...items(SLIDES, (n) => [
                [`image${n}`, { kind: "media", label: L(`Folie ${n}: Hintergrundbild`, `Slide ${n}: background picture`), required: n === 1 }],
                [`headline${n}`, { kind: "heading", label: L(`Folie ${n}: Überschrift`, `Slide ${n}: headline`), required: n === 1 }],
                [`link_label${n}`, { kind: "button", label: L(`Folie ${n}: Link-Text`, `Slide ${n}: link text`) }],
                [`link${n}`, { kind: "link", label: L(`Folie ${n}: Link-Adresse`, `Slide ${n}: link address`) }],
            ]),
        },
        versions: {
            wide: { name: L("Breit (2:1), Pfeile und Punkte", "Wide (2:1), arrows and dots"),
                wire: [["media", 0, 6, 100, 50], ["heading", 8, 30, 50, "light"], ["line", 8, 37, 14, "light"], ["line", 44, 50, 2, "light"], ["line", 48, 50, 2, "light"], ["line", 52, 50, 2, "light"]] },
        },
        magazine: {
            layout: "C",
            unit: (s, k) => [...s.querySelectorAll(".kalq-m-slides__slide")].map((sl) => ({ layout: "C", media: [k.mediaUrl(sl.querySelector(".kalq-m-slides__media"))],
                title: sl.querySelector(".kalq-m-slides__headline"), caption: sl.querySelector(".kalq-m-slides__body a, .kalq-m-slides__body .kalq-link-underline") })),
        },
        render: renderSlides,
    },
    "content.cascade": {
        category: "content",
        name: L("Bild mit Tiefe und Text", "Cascading image with text"),
        keywords: "cascade bild image depth tiefe parallax text",
        slots: {
            ...Object.fromEntries(picture("image", L("Bild (gern freigestellt)", "Picture (a cut-out works well)"), { required: true })),
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            text: { kind: "text", label: L("Text", "Text") },
            link_label: { kind: "button", label: L("Link-Text", "Link text") },
            link: { kind: "link", label: L("Link-Adresse", "Link address") },
        },
        versions: {
            "image-left-square": { name: L("Bild links, quadratisch", "Picture left, square"),
                wire: [["band", 6, 18, 34, 34], ["media", 10, 10, 34, 34], ["heading", 54, 20, 36], ["line", 54, 28, 34], ["line", 54, 32, 30], ["line", 54, 38, 14, "bold"]] },
            "image-left-tall": { name: L("Bild links, hoch (4:5)", "Picture left, tall (4:5)"),
                wire: [["band", 8, 14, 28, 40], ["media", 12, 6, 28, 40], ["heading", 54, 20, 36], ["line", 54, 28, 34], ["line", 54, 32, 30], ["line", 54, 38, 14, "bold"]] },
            "image-right-square": { name: L("Bild rechts, quadratisch", "Picture right, square"),
                wire: [["heading", 6, 20, 36], ["line", 6, 28, 34], ["line", 6, 32, 30], ["line", 6, 38, 14, "bold"], ["band", 56, 18, 34, 34], ["media", 60, 10, 34, 34]] },
            "image-right-tall": { name: L("Bild rechts, hoch (4:5)", "Picture right, tall (4:5)"),
                wire: [["heading", 6, 20, 36], ["line", 6, 28, 34], ["line", 6, 32, 30], ["line", 6, 38, 14, "bold"], ["band", 58, 14, 28, 40], ["media", 62, 6, 28, 40]] },
        },
        magazine: {
            layout: "A",
            unit: (s, k) => ({ layout: "A", order: s.classList.contains("is-image-right") ? "text-media" : "media-text", eyebrow: s.querySelector(".kalq-m-cascade__text .kalq-m-eyebrow"),
                title: s.querySelector(".kalq-m-cascade__text .kalq-m-heading"), body: k.parasOf(s.querySelector(".kalq-m-cascade__text .kalq-m-text")),
                actions: [...s.querySelectorAll(".kalq-m-cascade__text a")], media: [k.mediaUrl(s.querySelector(".kalq-m-cascade__media"))] }),
        },
        render: renderCascade,
    },
};

export const LIBRARY_CATEGORIES = [
    { id: "numbers", de: "Zahlen und Preise", en: "Numbers and pricing", after: "content" },
    { id: "testimonials", de: "Stimmen", en: "Testimonials", after: "cards" },
];
