// The inquiry chat's behaviour (js/modules/chat.js), browser only: started by js/moduleBehaviour.js for
// .kalq-m-chat[data-chat], relabelled when the page's language changes.
import { CHAT_WORDS } from "./chat.js";
import { storedEntry } from "../content.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

//=================================== The inquiry chat ===================================//
// Plays the questions in the HTML as a conversation: the greeting, then one question at a time (tap a choice or type
// a short answer), the contact details if the editor asks for them, a summary, and a real link for each send
// destination that opens the visitor's own app with the inquiry filled in. Nothing leaves the visitor's device until they send it
// themselves; their progress is kept in their own browser (localStorage) so they can resume. Under reduced motion no
// typing pause and no animation: each message is simply there.
const CHAT_UI = {
    de: {
        placeholder: "Ihre Antwort", send: "Senden", skip: "Überspringen", country: "Ländervorwahl", answer: "Ihre Antwort", langs: "Sprache des Chats",
        resumeAsk: "Willkommen zurück! Weitermachen, wo Sie aufgehört haben?", resume: "Weitermachen", restart: "Neu beginnen", again: "Neue Anfrage",
        thanks: "Danke! Hier ist Ihre Anfrage. Senden Sie sie, wie es Ihnen lieber ist:", sent: "Ihre App öffnet sich mit der Anfrage. Danke, wir melden uns!",
        badEmail: "Das sieht nicht nach einer E-Mail-Adresse aus. Noch einmal?", badPhone: "Bitte die Nummer mit Ziffern, die Ländervorwahl steht davor.",
        badLink: "Bitte den Link zu Ihrem Profil oder den Namen darin.", needName: "Ihren Namen brauchen wir, damit wir wissen, wen wir ansprechen.",
    },
    en: {
        placeholder: "Your answer", send: "Send", skip: "Skip", country: "Country code", answer: "Your answer", langs: "Chat language",
        resumeAsk: "Welcome back! Pick up where you left off?", resume: "Continue", restart: "Start over", again: "New inquiry",
        thanks: "Thank you! Here is your inquiry. Send it whichever way you like:", sent: "Your app opens with the inquiry in it. Thank you, we'll be in touch!",
        badEmail: "That doesn't look like an email address. Once more?", badPhone: "Please type the number in digits; the country code goes in front.",
        badLink: "Please the link to your profile, or the name in it.", needName: "We need your name, so we know who to address.",
    },
};
const COUNTRIES = ["+49 DE", "+43 AT", "+41 CH", "+44 GB", "+1 US", "+33 FR", "+39 IT", "+34 ES", "+31 NL", "+32 BE", "+48 PL", "+420 CZ", "+45 DK", "+46 SE", "+47 NO",
    "+358 FI", "+351 PT", "+353 IE", "+30 GR", "+90 TR", "+971 AE", "+82 KR", "+81 JP", "+86 CN", "+91 IN", "+61 AU", "+55 BR", "+52 MX"];
const flagOf = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const en = () => document.documentElement.lang === "en";
const chatLang = () => (en() ? "en" : "de");
const ui = () => CHAT_UI[chatLang()];
const chatText = () => CHAT_WORDS[chatLang()];
const OPTIONAL = new Set(["email", "phone", "linkedin"]);

export function setupChat(sec) {
    if (sec.dataset.ready) { relabelChat(sec); return; }
    sec.dataset.ready = "true";
    sec.classList.add("is-live");
    const log = sec.querySelector(".kalq-m-chat__log");
    const script = sec.querySelector(".kalq-m-chat__script");
    const finish = sec.querySelector(".kalq-m-chat__finish");
    const steps = [...script.children].map((li) => ({ id: li.dataset.q, kind: li.dataset.kind, li }));
    const store = `kalq-chat:${location.pathname}:${sec.dataset.section}`;
    const load = () => { try { return JSON.parse(localStorage.getItem(store)) || null; } catch { return null; } };
    const save = () => { try { localStorage.setItem(store, JSON.stringify(st)); } catch { /* private window: this visit only */ } };
    let st = { at: 0, answers: {}, labels: {} };
    let busy = false;
    finish.hidden = true;
    log.setAttribute("aria-live", "polite");
    const greeting = log.querySelector(".is-greeting");

    // the answer bar: a short text (and for the phone, the country code)
    const bar = document.createElement("div");
    bar.className = "kalq-m-chat__bar";
    bar.hidden = true;
    const inputId = `${sec.dataset.section}-chat-input`;
    bar.innerHTML = `<label class="kalq-sr" for="${inputId}"></label><select class="kalq-m-chat__cc" hidden></select><input class="kalq-m-chat__input" id="${inputId}" type="text" autocomplete="off" maxlength="500"><button type="button" class="kalq-m-chat__sendbtn"></button>`;
    const cc = bar.querySelector("select"), input = bar.querySelector("input");
    COUNTRIES.forEach((c) => { const [code, iso] = c.split(" "); const o = document.createElement("option"); o.value = code; o.textContent = `${flagOf(iso)} ${code}`; cc.append(o); });
    finish.after(bar);
    let onSubmit = null;
    const submit = () => { const v = input.value.trim(); if (v && onSubmit) onSubmit(v); };
    bar.querySelector("button").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

    const avatarCopy = () => { const a = greeting?.querySelector(".kalq-chat-avatar, .kalq-m-chat__avatar")?.cloneNode(true); if (!a) return null; a.setAttribute("aria-hidden", "true"); a.querySelectorAll("img").forEach((i) => { i.alt = ""; i.removeAttribute("data-kalq-key"); }); a.removeAttribute("data-kalq-key"); return a; };
    const scrollToEnd = (node) => {
        const bar0 = document.querySelector(".scrollbar-container");
        const sb = bar0 && window.Scrollbar ? Scrollbar.get(bar0) : null;
        if (sb) sb.scrollIntoView(node, { onlyScrollIfNeeded: true, offsetBottom: 140, alignToTop: false });
        else node.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "auto" : "smooth" });
    };
    const wasInside = () => sec.contains(document.activeElement);
    const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion.matches ? 0 : ms));

    function message(kind, nodes) {
        const m = document.createElement("div");
        m.className = `kalq-m-chat__msg is-${kind}`;
        const b = document.createElement("div");
        b.className = "kalq-m-chat__bubble";
        nodes.forEach((n) => n && b.append(n));
        if (kind === "bot") { const a = avatarCopy(); if (a) m.append(a); }
        m.append(b);
        log.append(m);
        return m;
    }
    const para = (text) => Object.assign(document.createElement("p"), { textContent: text });
    async function bot(nodes, instant = false) {
        if (!instant && !reducedMotion.matches) {
            const typing = message("bot", [Object.assign(document.createElement("p"), { className: "kalq-m-chat__typing", textContent: "…" })]);
            typing.setAttribute("aria-hidden", "true");
            typing.classList.add("is-typing");
            await wait(600 + Math.random() * 400);
            typing.remove();
        }
        return message("bot", nodes);
    }
    const user = (text) => { const m = message("user", [para(text)]); scrollToEnd(m); return m; };

    // chips: the choices to tap (real buttons)
    function chips(list, onPick) {
        const row = document.createElement("div");
        row.className = "kalq-m-chat__chips";
        list.forEach(({ label, value }) => {
            const c = document.createElement("button");
            c.type = "button";
            c.className = "kalq-m-chat__chip";
            c.textContent = label;
            c.addEventListener("click", () => { if (busy) return; row.remove(); onPick(value ?? label, label); });
            row.append(c);
        });
        return row;
    }

    function askBar(step, focus) {
        const contact = step.kind === "contact";
        cc.hidden = !(contact && step.id === "phone");
        input.type = contact && step.id === "email" ? "email" : contact && step.id === "phone" ? "tel" : contact && step.id === "linkedin" ? "url" : "text";
        input.autocomplete = contact ? { name: "name", email: "email", phone: "tel-national", linkedin: "url" }[step.id] : "off";
        input.value = "";
        bar.hidden = false;
        if (focus) input.focus({ preventScroll: true });
    }
    const hideBar = () => { bar.hidden = true; onSubmit = null; };

    // the words of a question, as on the page (the copy follows a language switch: it keeps its block's key)
    const askNodes = (step) => [step.li.querySelector(".kalq-m-chat__ask").cloneNode(true)];

    async function ask(i, { instant = false } = {}) {
        if (i >= steps.length) return done(instant);
        const step = steps[i];
        const focus = wasInside();
        busy = true;
        const m = await bot(askNodes(step), instant);
        busy = false;
        if (step.kind === "choice") {
            hideBar();
            const list = [...step.li.querySelectorAll(".kalq-m-chat__choices li")].map((li) => ({ label: li.textContent.trim() }));
            const row = chips(list, (value) => answer(i, value, value));
            row.dataset.for = step.id;
            m.querySelector(".kalq-m-chat__bubble").append(row);
            if (focus) row.querySelector("button")?.focus({ preventScroll: true });
        } else {
            if (step.kind === "contact" && OPTIONAL.has(step.id)) {
                const row = chips([{ label: ui().skip, value: "" }], () => { hideBar(); answer(i, "", ui().skip); });
                m.querySelector(".kalq-m-chat__bubble").append(row);
            }
            onSubmit = (v) => check(step, v, i);
            askBar(step, focus);
        }
        if (focus || !instant) scrollToEnd(m);
    }

    // the contact details: checked, with a friendly word when something is off
    async function check(step, v, i) {
        let value = v, problem = null;
        if (step.kind === "contact") {
            if (step.id === "name" && v.length < 2) problem = ui().needName;
            if (step.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) problem = ui().badEmail;
            if (step.id === "phone") { const d = v.replace(/[\s()/.-]/g, "").replace(/^0+/, ""); if (!/^\d{4,14}$/.test(d)) problem = ui().badPhone; else value = `${cc.value} ${d}`; }
            if (step.id === "linkedin") {
                const m = v.match(/linkedin\.com\/(in|company)\/([\w%-]+)/i) || (/^[\w%-]{3,100}$/.test(v) ? [null, "in", v] : null);
                if (!m) problem = ui().badLink; else value = `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}`;
            }
        }
        if (problem) { user(v); input.value = ""; await bot([para(problem)]); input.focus({ preventScroll: true }); return; }
        hideBar();
        answer(i, value, value);
    }

    function answer(i, value, label) {
        const step = steps[i];
        log.querySelectorAll(".kalq-m-chat__msg .kalq-m-chat__chips").forEach((row) => { if (!row.closest(".kalq-m-chat__finish")) row.remove(); }); // answered: its chips go
        st.answers[step.id] = value;
        st.labels[step.id] = label;
        st.at = i + 1;
        save();
        user(label);
        ask(i + 1);
    }

    // the end: the summary as text, and the two links filled in
    async function done(instant) {
        hideBar();
        const w = chatText(), dl = finish.querySelector(".kalq-m-chat__summary");
        dl.replaceChildren();
        const lines = [];
        steps.forEach((step) => {
            const v = st.answers[step.id];
            if (v == null || v === "") return;
            const q = step.kind === "contact" ? w.contactLabels[["name", "email", "phone", "linkedin"].indexOf(step.id)] : step.li.querySelector(".kalq-m-chat__ask").textContent.trim();
            dl.append(Object.assign(document.createElement("dt"), { textContent: q }), Object.assign(document.createElement("dd"), { textContent: v }));
            lines.push(`${q}: ${v}`);
        });
        const title = sec.querySelector(".kalq-m-chat__title")?.textContent.trim() || w.title;
        const body = `${title}\n\n${lines.join("\n")}`;
        const name = st.answers.name;
        // each destination's link with the inquiry in it (as far as that app takes a text: data-param)
        finish.querySelectorAll(".kalq-m-chat__go").forEach((a) => {
            const base = a.getAttribute("href").split("?")[0];
            const param = a.dataset.param;
            if (param === "mailto") a.href = `${base}?subject=${encodeURIComponent(name ? `${title}: ${name}` : title)}&body=${encodeURIComponent(body)}`;
            else if (param) a.href = `${base}?${param}=${encodeURIComponent(body)}`;
        });
        st.done = true;
        save();
        const m = await bot([para(ui().thanks)], instant);
        m.querySelector(".kalq-m-chat__bubble").append(finish);
        finish.hidden = false;
        const again = chips([{ label: ui().again }], restart);
        finish.append(again);
        if (!instant || wasInside()) scrollToEnd(finish);
    }

    function restart() {
        try { localStorage.removeItem(store); } catch { /* nothing kept */ }
        st = { at: 0, answers: {}, labels: {} };
        finish.hidden = true;
        finish.querySelector(".kalq-m-chat__chips")?.remove();
        sec.querySelector(".kalq-m-chat__window").insertBefore(finish, bar);
        [...log.children].forEach((m) => { if (m !== greeting) m.remove(); });
        ask(0);
    }

    // sending: the visitor's own app opens; a word of thanks here
    finish.addEventListener("click", (e) => { if (e.target.closest(".kalq-m-chat__go")) setTimeout(() => bot([para(ui().sent)]), 300); });

    // the language pill: the site's language (the chat follows it)
    sec.querySelectorAll(".kalq-m-chat__lang").forEach((b) => b.addEventListener("click", async () => (await import("../header.js")).setLanguage(b.dataset.lang)));

    // start when it comes into view; a visitor who was here before may resume
    const begin = () => {
        const saved = load();
        if (saved && saved.at > 0 && steps.length) {
            bot([para(ui().resumeAsk)], true).then((m) => m.querySelector(".kalq-m-chat__bubble").append(chips([{ label: ui().resume, value: "resume" }, { label: ui().restart, value: "restart" }], (v) => {
                m.remove();
                if (v === "restart") return restart();
                st = { labels: {}, ...saved };
                for (let i = 0; i < Math.min(st.at, steps.length); i++) { message("bot", askNodes(steps[i])); message("user", [para(st.labels[steps[i].id] ?? st.answers[steps[i].id] ?? "")]); }
                ask(Math.min(st.at, steps.length), { instant: true });
            })));
        } else ask(0);
    };
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); begin(); }, { threshold: 0.2 });
    io.observe(sec);
    relabelChat(sec);
}

export function relabelChat(sec) {
    const u = ui();
    // the choices in this language (the stored words; the other language where this one has none), and the chips of
    // the question now open
    sec.querySelectorAll("ul[data-choices]").forEach((ul) => {
        const e = storedEntry(ul.dataset.choices);
        const html = e && (e[chatLang()] ?? e[chatLang() === "en" ? "de" : "en"]);
        if (html == null) return;
        const list = html.split(/<br\s*\/?>|\n|<\/p>\s*<p>/i).map((x) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim()).filter(Boolean).slice(0, 8);
        ul.replaceChildren(...list.map((c) => Object.assign(document.createElement("li"), { textContent: c })));
        const row = sec.querySelector(`.kalq-m-chat__log .kalq-m-chat__chips[data-for="${ul.closest("li")?.dataset.q}"]`);
        if (row) [...row.children].forEach((c, k) => { if (list[k]) c.textContent = list[k]; });
    });
    sec.querySelector(".kalq-m-chat__bar label")?.replaceChildren(u.answer);
    sec.querySelector(".kalq-m-chat__input")?.setAttribute("placeholder", u.placeholder);
    const send = sec.querySelector(".kalq-m-chat__sendbtn");
    if (send) send.textContent = u.send;
    sec.querySelector(".kalq-m-chat__cc")?.setAttribute("aria-label", u.country);
    sec.querySelector(".kalq-m-chat__langs")?.setAttribute("aria-label", u.langs);
    sec.querySelectorAll(".kalq-m-chat__lang").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === chatLang())));
    const w = chatText();
    sec.querySelectorAll(".kalq-m-chat__go[data-dest]").forEach((a) => { if (w.send[a.dataset.dest]) a.textContent = w.send[a.dataset.dest]; });
    const t = sec.querySelector(".kalq-m-chat__summary-title");
    if (t) t.textContent = w.summary;
    const note = sec.querySelector(".kalq-m-chat__note");
    if (note) note.textContent = w.note;
    sec.querySelectorAll('.kalq-m-chat__q.is-contact').forEach((li) => { const k = ["name", "email", "phone", "linkedin"].indexOf(li.dataset.q); if (k >= 0) li.querySelector(".kalq-m-chat__ask").textContent = w.contactAsk[k]; });
}
