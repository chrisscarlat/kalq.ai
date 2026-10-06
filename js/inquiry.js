// The inquiry chat: not a page module but one chat for the whole site, floating at the bottom right of every page
// while it is switched on (the insert picker's Chat entry: site.chat.active, site.chat.name and the send destinations
// site.chat.<id>, js/siteSettings.js). Opened from its round button. Modelled on scar.lat's Project Inquiry: a short,
// witty conversation that asks one thing at a time and waits for the answer (a typing pause, then the message rises
// in), collects who is asking and how to reach them, and ends with an editable summary the visitor sends from their
// own app (WhatsApp, Telegram, Threema, SMS, email). Nothing is stored or sent by the site. Under reduced motion no
// pause and no animation: each message is simply there. Everything a visitor types is text, never markup.
import { currentLang } from "./i18n.js";
import { storedEntry } from "./content.js";
import { SEND_DESTS, chatDest } from "./modules/destinations.js";

const W = {
    en: {
        open: "Open the chat", close: "Close the chat", title: "Project inquiry", answer: "Your answer", placeholder: "Type your message…", send: "Send",
        greet: (n) => n ? `Hi! I'm ${n} from Kalq.` : "Hi! This is Kalq.",
        intro: "We price manufactured parts from their drawing, and match them with the suppliers who can make them. What brings you here?",
        start: "What are we looking at?",
        chips: [["price", "Price a part"], ["supplier", "Find a supplier"], ["demo", "See Kalq in action"], ["other", "Something else"]],
        onChip: {
            price: ["Good choice, that's our favourite question. Which part is it, and what is it made of?", "Prices are what we do. Tell me about the part: what is it, and which material?"],
            supplier: ["Matchmaking for parts, love it. What needs making, and roughly how many?", "Let's find who can make it. What's the part, and what's the process: machining, sheet metal, casting?"],
            demo: ["Happy to show you. What would you like to see it price, ideally one of your own parts?", "A demo it is. Which kind of parts do you buy most?"],
            other: ["Intriguing. Tell me what you have in mind.", "I like unusual questions. Go ahead."],
        },
        follow: ["How many do you need a year, roughly?", "Do you have a drawing? A STEP file or a PDF is perfect, you can send it later.", "Who makes it today, and is the price the problem or the supplier?",
            "Got it. Is there a deadline we should know about?", "Interesting. What would a good result look like for you?"],
        price: "That's exactly what Kalq answers: a price you can defend, from the drawing. A few details and we'll get back to you with one.",
        hello: ["Hello back! What can we price for you?", "Hi! Ready when you are: what's the part?"],
        rude: ["Fair, procurement can do that to people. What do you actually need?", "Noted. Shall we start over? What's the part?"],
        odd: ["I'm good with drawings, less with riddles. Could you say that in a sentence?", "That one went over my head. Tell me about the part?"],
        thanks: ["You're welcome! Anything else about the part?"],
        askName: "Got it, thank you. Who am I talking to? Your name, please.",
        askCompany: (n) => `Great to meet you, ${n}! Which company are you with?`,
        askRole: "And your role there?",
        askMethod: "How shall we reach you?",
        methods: [["email", "Email"], ["phone", "Phone"], ["linkedin", "LinkedIn"]],
        askContact: { email: "Your email address?", phone: "Your phone number, with the country code?", linkedin: "Your LinkedIn profile or user name?" },
        invalid: { email: "That doesn't look like an email address yet. Once more?", phone: "That doesn't look like a phone number yet. With the country code, please, e.g. +49 170 1234567.", linkedin: "Hmm, a LinkedIn link or user name, please?" },
        summary: "Here's your inquiry. Change anything you like, then send it from your own app:",
        summaryTitle: "Your inquiry",
        sendVia: { whatsapp: "Send via WhatsApp", telegram: "Send via Telegram", threema: "Send via Threema", sms: "Send by SMS", email: "Send by email" },
        sent: "Over to you. We'll answer quickly, promised.",
        note: "Nothing is stored on our side: you send the inquiry yourself, from your own app.",
        after: "Anything else? Just type it, I'll add it to your inquiry.",
        added: "Added to your inquiry.",
        lines: { hello: "Hi Kalq,", name: "Name", company: "Company", role: "Role", contact: "Contact", topic: "Topic", details: "Details" },
        subject: (n) => `Inquiry from ${n || "the website"}`,
        langs: "Language",
    },
    de: {
        open: "Chat öffnen", close: "Chat schließen", title: "Projektanfrage", answer: "Ihre Antwort", placeholder: "Nachricht schreiben …", send: "Senden",
        greet: (n) => n ? `Hallo! Ich bin ${n} von Kalq.` : "Hallo! Hier ist Kalq.",
        intro: "Wir bepreisen Fertigungsteile aus ihrer Zeichnung und finden die Lieferanten, die sie herstellen können. Was führt Sie her?",
        start: "Worum geht es?",
        chips: [["price", "Ein Teil bepreisen"], ["supplier", "Lieferanten finden"], ["demo", "Kalq in Aktion sehen"], ["other", "Etwas anderes"]],
        onChip: {
            price: ["Gute Wahl, das ist unsere Lieblingsfrage. Welches Teil ist es, und aus welchem Material?", "Preise sind unser Ding. Erzählen Sie vom Teil: Was ist es, welches Material?"],
            supplier: ["Partnervermittlung für Teile, sehr gern. Was soll gefertigt werden, und etwa wie viele?", "Finden wir, wer es fertigen kann. Welches Teil, welches Verfahren: Zerspanung, Blech, Guss?"],
            demo: ["Zeige ich gern. Was soll Kalq bepreisen, am besten eins Ihrer eigenen Teile?", "Eine Demo also. Welche Art Teile kaufen Sie am meisten ein?"],
            other: ["Spannend. Erzählen Sie, was Sie vorhaben.", "Ungewöhnliche Fragen mag ich. Nur zu."],
        },
        follow: ["Wie viele brauchen Sie im Jahr, ungefähr?", "Gibt es eine Zeichnung? Eine STEP-Datei oder ein PDF ist perfekt, gern auch später.", "Wer fertigt es heute, und ist der Preis das Problem oder der Lieferant?",
            "Verstanden. Gibt es einen Termin, den wir kennen sollten?", "Interessant. Wie sähe ein gutes Ergebnis für Sie aus?"],
        price: "Genau das beantwortet Kalq: einen Preis, den Sie belegen können, aus der Zeichnung. Ein paar Angaben, und wir melden uns mit einem.",
        hello: ["Hallo zurück! Was dürfen wir für Sie bepreisen?", "Hallo! Ich bin bereit: Um welches Teil geht es?"],
        rude: ["Verständlich, Einkauf kann das mit einem machen. Was brauchen Sie denn?", "Notiert. Fangen wir neu an? Um welches Teil geht es?"],
        odd: ["Mit Zeichnungen kann ich gut, mit Rätseln weniger. Sagen Sie es in einem Satz?", "Da komme ich nicht mit. Erzählen Sie vom Teil?"],
        thanks: ["Gern! Noch etwas zum Teil?"],
        askName: "Verstanden, danke. Mit wem spreche ich? Ihr Name, bitte.",
        askCompany: (n) => `Schön, Sie kennenzulernen, ${n}! Für welches Unternehmen sind Sie unterwegs?`,
        askRole: "Und Ihre Rolle dort?",
        askMethod: "Wie erreichen wir Sie?",
        methods: [["email", "E-Mail"], ["phone", "Telefon"], ["linkedin", "LinkedIn"]],
        askContact: { email: "Ihre E-Mail-Adresse?", phone: "Ihre Telefonnummer, mit Ländervorwahl?", linkedin: "Ihr LinkedIn-Profil oder Ihr Benutzername?" },
        invalid: { email: "Das sieht noch nicht nach einer E-Mail-Adresse aus. Noch einmal?", phone: "Das sieht noch nicht nach einer Telefonnummer aus. Bitte mit Ländervorwahl, z. B. +49 170 1234567.", linkedin: "Hm, einen LinkedIn-Link oder Benutzernamen, bitte?" },
        summary: "Hier ist Ihre Anfrage. Ändern Sie, was Sie möchten, dann senden Sie sie aus Ihrer eigenen App:",
        summaryTitle: "Ihre Anfrage",
        sendVia: { whatsapp: "Per WhatsApp senden", telegram: "Per Telegram senden", threema: "Per Threema senden", sms: "Per SMS senden", email: "Per E-Mail senden" },
        sent: "Jetzt sind Sie dran. Wir antworten schnell, versprochen.",
        note: "Bei uns wird nichts gespeichert: Sie senden die Anfrage selbst, aus Ihrer eigenen App.",
        after: "Noch etwas? Schreiben Sie es einfach, ich ergänze Ihre Anfrage.",
        added: "Zu Ihrer Anfrage hinzugefügt.",
        lines: { hello: "Hallo Kalq,", name: "Name", company: "Unternehmen", role: "Rolle", contact: "Kontakt", topic: "Thema", details: "Details" },
        subject: (n) => `Anfrage von ${n || "der Website"}`,
        langs: "Sprache",
    },
};
const lang = () => (currentLang() === "en" ? "en" : "de");
const w = () => W[lang()];
const still = window.matchMedia("(prefers-reduced-motion: reduce)");
const site = (key) => { const e = storedEntry(`site.chat.${key}`); return String((e && (e.de ?? e.en)) || "").replace(/<[^>]+>/g, "").trim(); };
export const chatActive = () => site("active") === "on";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const AVATAR = '<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="18" fill="currentColor" opacity=".08"/><circle cx="22" cy="13" r="3.4" fill="currentColor" opacity=".35"/><path d="M8 26l7-9 4 5 3-3 6 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" opacity=".6"/></svg>';

// What a visitor writes, read for its tone (scar.lat's intent detection, in both languages)
function intent(text) {
    const t = text.toLowerCase().trim();
    if (t.length <= 2 || !/[a-zäöüß]/i.test(t) || (/^[^aeiouäöüy\s]{5,}$/i.test(t))) return "odd";
    if (/\b(fuck|shit|scheiß|scheiss|idiot|stupid|blöd|doof|sucks)\b/.test(t)) return "rude";
    if (/^(hi|hello|hey|hallo|moin|servus|guten (tag|morgen|abend))\b/.test(t)) return "hello";
    if (/\b(thanks|thank you|danke)\b/.test(t)) return "thanks";
    if (/\b(price|cost|costs|how much|preis|preise|kosten|was kostet)\b/.test(t)) return "price";
    return "general";
}
// a random line, not the same one twice in a row
const recent = [];
function pick(list) {
    const fresh = list.filter((x) => !recent.includes(x));
    const line = (fresh.length ? fresh : list)[Math.floor(Math.random() * (fresh.length || list.length))];
    recent.push(line); if (recent.length > 8) recent.shift();
    return line;
}
const valid = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    phone: (v) => /^\+?[\d\s()/.-]{6,20}$/.test(v) && (v.match(/\d/g) || []).length >= 6,
    linkedin: (v) => /linkedin\.com\/in\/[\w-]+/i.test(v) || /^@?[\w-]{3,100}$/.test(v),
};

let widget = null;

// Build the widget when the chat is on, take it away when it is off (settings changed, language changed)
export function initChatWidget() {
    if (!chatActive()) { widget?.root.remove(); widget = null; return; }
    if (widget) { relabel(); return; }
    widget = build();
}

function build() {
    const root = el("div", "kalq-chat");
    root.setAttribute("data-optional", ""); // never in the way of the page's own content
    const toggle = el("button", "kalq-chat__toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "kalq-chat-window");
    toggle.innerHTML = AVATAR;
    const win = el("section", "kalq-chat__window");
    win.id = "kalq-chat-window";
    win.setAttribute("role", "dialog");
    win.hidden = true;
    const head = el("header", "kalq-chat__head");
    const title = el("h2", "kalq-chat__title");
    const langs = el("div", "kalq-chat__langs");
    langs.setAttribute("role", "group");
    ["de", "en"].forEach((l) => { const b = el("button", "kalq-chat__lang", l.toUpperCase()); b.type = "button"; b.dataset.lang = l; b.lang = l; langs.append(b); });
    const close = el("button", "kalq-chat__close", "×");
    close.type = "button";
    head.append(title, langs, close);
    const log = el("div", "kalq-chat__log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    const form = el("form", "kalq-chat__bar");
    const label = el("label", "kalq-sr");
    label.htmlFor = "kalq-chat-input";
    const input = el("input", "kalq-chat__input");
    input.id = "kalq-chat-input";
    input.autocomplete = "off";
    input.maxLength = 500;
    const send = el("button", "kalq-chat__send");
    send.type = "submit";
    form.append(label, input, send);
    win.append(head, log, form);
    root.append(win, toggle);
    document.body.append(root);

    const state = { step: "intro", topic: "", details: [], info: {}, method: "", count: 0, started: false, busy: 0 };
    const self = { root, toggle, win, title, langs, close, log, input, send, label, state };

    const setOpen = (on) => {
        win.hidden = !on;
        root.classList.toggle("is-open", on);
        toggle.setAttribute("aria-expanded", String(on));
        if (on) {
            if (!state.started) { state.started = true; begin(self); }
            setTimeout(() => input.focus(), still.matches ? 0 : 320);
        } else toggle.focus();
    };
    toggle.addEventListener("click", () => setOpen(win.hidden));
    close.addEventListener("click", () => setOpen(false));
    win.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }); // the site's shortcuts stay out
    langs.addEventListener("click", async (e) => { const b = e.target.closest(".kalq-chat__lang"); if (b) (await import("./header.js")).setLanguage(b.dataset.lang); });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || state.busy) return;
        input.value = "";
        user(self, text);
        answer(self, text);
    });
    self.setOpen = setOpen;
    widget = self;
    relabel();
    return self;
}

function relabel() {
    const s = widget, t = w();
    s.toggle.setAttribute("aria-label", s.win.hidden ? t.open : t.close);
    s.win.setAttribute("aria-label", t.title);
    s.title.textContent = t.title;
    s.langs.setAttribute("aria-label", t.langs);
    s.langs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang())));
    s.close.setAttribute("aria-label", t.close);
    s.label.textContent = t.answer;
    s.input.placeholder = t.placeholder;
    s.send.textContent = t.send;
    s.root.querySelector(".kalq-chat__note")?.replaceChildren(t.note);
}

//=================================== Messages ===================================//
function scrollDown(s) { s.log.scrollTop = s.log.scrollHeight; }

function message(s, who, nodes) {
    const m = el("div", `kalq-chat__msg is-${who}`);
    if (who === "bot") { const a = el("span", "kalq-chat__avatar"); a.innerHTML = AVATAR; m.append(a); }
    const bubble = el("div", "kalq-chat__bubble");
    bubble.append(...nodes);
    m.append(bubble);
    s.log.append(m);
    scrollDown(s);
    return m;
}
const para = (text) => el("p", "", text);
function user(s, text) { message(s, "user", [para(text)]); }

// The bot speaks after a short pause with the typing dots (about a second), then the message rises in; under reduced
// motion at once. Returns the message when it is there.
function bot(s, nodes, { pause = 400 } = {}) {
    s.state.busy++;
    const done = (resolve) => { const m = message(s, "bot", nodes); s.state.busy--; resolve(m); };
    if (still.matches) return new Promise(done);
    return new Promise((resolve) => setTimeout(() => {
        const typing = el("div", "kalq-chat__msg is-bot is-typing");
        const a = el("span", "kalq-chat__avatar"); a.innerHTML = AVATAR;
        const dots = el("div", "kalq-chat__bubble");
        dots.innerHTML = '<span class="kalq-chat__dot"></span><span class="kalq-chat__dot"></span><span class="kalq-chat__dot"></span>';
        dots.setAttribute("aria-hidden", "true");
        typing.append(a, dots);
        s.log.append(typing);
        scrollDown(s);
        setTimeout(() => { typing.remove(); done(resolve); }, 600 + Math.random() * 400);
    }, pause));
}
const say = (s, text, opts) => bot(s, [para(text)], opts);

// Answers to tap: each a button; the one tapped is the visitor's answer, the row goes
function chips(s, list, onPick) {
    const row = el("div", "kalq-chat__chips");
    list.forEach(([value, text]) => {
        const b = el("button", "kalq-chat__chip", text);
        b.type = "button";
        b.addEventListener("click", () => { if (s.state.busy) return; row.remove(); user(s, text); onPick(value, text); }, { once: true });
        row.append(b);
    });
    return row;
}

//=================================== The conversation ===================================//
async function begin(s) {
    const t = w();
    await bot(s, [el("p", "kalq-chat__hello", t.greet(site("name"))), para(t.intro)], { pause: 150 });
    await askTopic(s);
}
async function askTopic(s) {
    const t = w();
    s.state.step = "topic";
    await bot(s, [para(t.start), chips(s, t.chips, (value, text) => { s.state.topic = text; s.state.step = "chatting"; say(s, pick(w().onChip[value])); })]);
}

async function answer(s, text) {
    const t = w(), st = s.state;
    const kind = intent(text);
    if (st.step === "topic" || st.step === "intro") { // typed instead of tapping: that is the topic
        s.log.querySelectorAll(".kalq-chat__chips").forEach((r) => r.remove());
        st.topic = st.topic || text; st.details.push(text); st.step = "chatting";
        return say(s, kind === "price" ? t.price : kind === "hello" ? pick(t.hello) : pick(t.follow));
    }
    if (st.step === "chatting") {
        if (kind === "odd" || kind === "rude") return say(s, pick(t[kind]));
        st.details.push(text);
        st.count++;
        if (kind === "price" && st.count < 2) return say(s, t.price);
        if (st.count >= 2) { st.step = "name"; return say(s, t.askName); }
        return say(s, kind === "thanks" ? pick(t.thanks) : pick(t.follow));
    }
    if (st.step === "name") { st.info.name = text; st.step = "company"; return say(s, t.askCompany(text.split(/\s+/)[0])); }
    if (st.step === "company") { st.info.company = text; st.step = "role"; return say(s, t.askRole); }
    if (st.step === "role") {
        st.info.role = text; st.step = "method";
        return bot(s, [para(t.askMethod), chips(s, t.methods, (value) => { st.method = value; st.step = "contact"; say(s, w().askContact[value]); })]);
    }
    if (st.step === "method") { st.method = "email"; st.step = "contact"; return answer(s, text); } // typed instead of tapping
    if (st.step === "contact") {
        if (!valid[st.method](text)) return say(s, t.invalid[st.method]);
        st.info.contact = text; st.step = "done";
        return summary(s);
    }
    if (st.step === "done") { // after the summary: added to the inquiry
        st.details.push(text);
        const area = s.log.querySelector(".kalq-chat__summary textarea");
        if (area) area.value = summaryText(st);
        return say(s, t.added);
    }
}

function summaryText(st) {
    const L = w().lines;
    return [L.hello, "", `${L.name}: ${st.info.name || ""}`, `${L.company}: ${st.info.company || ""}`, `${L.role}: ${st.info.role || ""}`, `${L.contact}: ${st.info.contact || ""}`,
        `${L.topic}: ${st.topic || ""}`, "", `${L.details}:`, ...st.details.map((d) => `- ${d}`)].join("\n");
}

// The editable summary and a button per destination set for the site: the visitor's own app opens with the text
async function summary(s) {
    const t = w(), st = s.state;
    const box = el("div", "kalq-chat__summary");
    const id = "kalq-chat-summary";
    const lab = el("label", "kalq-chat__summary-title", t.summaryTitle);
    lab.htmlFor = id;
    const area = el("textarea", "kalq-chat__summary-text");
    area.id = id;
    area.rows = 8;
    area.value = summaryText(st);
    area.addEventListener("keydown", (e) => e.stopPropagation());
    const sends = el("div", "kalq-chat__sends");
    SEND_DESTS.forEach((d) => {
        const to = chatDest((k) => storedEntry(k), d);
        if (!to) return;
        const a = el("a", `kalq-chat__go is-${d.id}`, t.sendVia[d.id]);
        a.dataset.dest = d.id;
        if (to.blank) { a.target = "_blank"; a.rel = "noopener"; }
        const link = () => {
            const text = area.value;
            if (to.param === "mailto") return `${to.href}?subject=${encodeURIComponent(t.subject(st.info.name))}&body=${encodeURIComponent(text)}`;
            if (to.param) return `${to.href}${to.href.includes("?") ? "&" : "?"}${to.param}=${encodeURIComponent(text)}`;
            return to.href;
        };
        a.href = link();
        area.addEventListener("input", () => { a.href = link(); });
        a.addEventListener("click", () => { a.href = link(); setTimeout(() => say(s, t.sent, { pause: 300 }).then(() => say(s, t.after)), 300); });
        sends.append(a);
    });
    box.append(lab, area, sends, el("p", "kalq-chat__note", t.note));
    await say(s, t.summary, { pause: 500 });
    await bot(s, [box], { pause: 100 });
}
