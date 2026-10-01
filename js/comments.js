// Comments for everyone (guests too): C or the bubble button turns on comment mode, a click drops a pin.
// Pins attach to the nearest data-kalq-key block (position as % inside it), otherwise to the page (% of the page).
// Threads have replies and can be resolved by editors or the author. Everything goes through /api/comments.
import { currentLang } from "./i18n.js";

const TEXT = {
    de: {
        mode: "Kommentieren (C)", tab: "Kommentare", placeholder: "Kommentar schreiben", reply: "Antworten",
        send: "Senden", cancel: "Abbrechen", resolve: "Erledigt", reopen: "Wieder öffnen", resolved: "Erledigt",
        showResolved: "Erledigte anzeigen", empty: "Noch keine offenen Kommentare auf dieser Seite.",
        failed: "Kommentar konnte nicht gespeichert werden.", rate: "Zu viele Kommentare. Bitte kurz warten.",
        by: (n) => `Kommentar von ${n}`, replies: (n) => (n === 1 ? "1 Antwort" : `${n} Antworten`), close: "Schließen",
    },
    en: {
        mode: "Comment (C)", tab: "Comments", placeholder: "Write a comment", reply: "Reply",
        send: "Send", cancel: "Cancel", resolve: "Resolve", reopen: "Reopen", resolved: "Resolved",
        showResolved: "Show resolved", empty: "No open comments on this page yet.",
        failed: "The comment could not be saved.", rate: "Too many comments. Please wait a moment.",
        by: (n) => `Comment by ${n}`, replies: (n) => (n === 1 ? "1 reply" : `${n} replies`), close: "Close",
    },
};
const lang = () => (currentLang() === "en" ? "en" : "de");
const t = (key) => TEXT[lang()][key];

let collab, panel;
let on = false;
let button;
let comments = [];
let commentsPage = null; // the page `comments` belongs to
let people = {};
let showResolved = false;
let openThread = null; // root id, or "draft"
let draft = null; // { block_key, anchor_selector, x_pct, y_pct }
let layer = null;
let resizeObserver = null;
let focusComposer = false; // only when the user opens a thread, never on a live refresh
let typing = null; // { for, value, start, end, focused }: kept across re-renders

const container = () => {
    const all = document.querySelectorAll('[data-barba="container"]');
    return all[all.length - 1];
};
const roots = () => comments.filter((c) => !c.parent_id);
const repliesOf = (id) => comments.filter((c) => c.parent_id === id);
const visibleRoots = () => roots().filter((c) => showResolved || !c.resolved_at);
const canResolve = (c) => collab.me.kind === "editor" || c.author_id === collab.me.uid;

function person(uid) {
    if (uid === collab.me.uid) return collab.me;
    const live = collab.peers.find((p) => p.uid === uid);
    if (live) return live;
    const p = people[uid];
    if (p) return { uid, name: p.name || (p.kind === "guest" ? "Guest" : "Editor"), avatar_url: p.avatar_url, color: p.color || "#3B82F6", emoji: null, kind: p.kind };
    return { uid, name: uid.startsWith("guest-") ? "Guest" : "Editor", color: "#8B5CF6" };
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

function when(iso) {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(lang(), { numeric: "auto" });
    const steps = [[60, "second"], [3600, "minute"], [86400, "hour"], [604800, "day"], [Infinity, "week"]];
    let divisor = 1;
    for (const [limit, unit] of steps) {
        if (Math.abs(seconds) < limit) return rtf.format(Math.round(seconds / divisor), unit);
        divisor = limit;
    }
    return "";
}
const fullDate = (iso) => new Date(iso).toLocaleString(lang() === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" });

//=================================== Data ===================================//
async function load() {
    const page = collab.page;
    const res = await fetch(`/api/comments?page=${encodeURIComponent(page)}`, { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return; }
    const data = await res.json();
    if (page !== collab.page) return;
    comments = data.comments || [];
    commentsPage = page;
    people = { ...people, ...data.people };
    render();
}

async function send(payload) {
    const res = await fetch("/api/comments", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: collab.page, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "failed");
    comments.push(data.comment);
    people = { ...people, ...data.people };
    collab.broadcast("comments", { page: collab.page });
    return data.comment;
}

async function setResolved(root, resolved) {
    const res = await fetch("/api/comments", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: root.id, resolved }),
    });
    if (!res.ok) { res.body?.cancel(); return collab.toast(t("failed"), "error"); }
    const { comment } = await res.json();
    Object.assign(root, comment);
    if (resolved && !showResolved) openThread = null;
    collab.broadcast("comments", { page: collab.page });
    render();
}

//=================================== Positions ===================================//
function cssPath(node, stop) {
    const parts = [];
    while (node && node !== stop && node.nodeType === 1 && parts.length < 6) {
        let part = node.tagName.toLowerCase();
        // The template repeats ids (id="container"), so only a unique id ends the path
        if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) { parts.unshift(`${part}#${CSS.escape(node.id)}`); break; }
        const cls = [...node.classList].filter((c) => !c.startsWith("kalq-")).slice(0, 2);
        if (cls.length) part += "." + cls.map((c) => CSS.escape(c)).join(".");
        const siblings = node.parentElement ? [...node.parentElement.children].filter((s) => s.tagName === node.tagName) : [];
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        parts.unshift(part);
        node = node.parentElement;
    }
    return parts.join(" > ");
}

// Where a comment sits inside the page container, in px
function point(c) {
    const box = container();
    const cr = box.getBoundingClientRect();
    if (c.block_key) {
        const target = box.querySelector(`[data-kalq-key="${CSS.escape(c.block_key)}"]`);
        if (target && target.getClientRects().length) {
            const r = target.getBoundingClientRect();
            return { x: r.left - cr.left + c.x_pct * r.width, y: r.top - cr.top + c.y_pct * r.height };
        }
    }
    return { x: c.x_pct * cr.width, y: c.y_pct * cr.height };
}

function anchorFor(e) {
    const box = container();
    const cr = box.getBoundingClientRect();
    const target = e.target.closest("[data-kalq-key]");
    if (target && box.contains(target)) {
        const r = target.getBoundingClientRect();
        return { block_key: target.dataset.kalqKey, anchor_selector: null, x_pct: (e.clientX - r.left) / r.width, y_pct: (e.clientY - r.top) / r.height };
    }
    return { block_key: null, anchor_selector: cssPath(e.target, box), x_pct: (e.clientX - cr.left) / cr.width, y_pct: (e.clientY - cr.top) / cr.height };
}

//=================================== Rendering ===================================//
function ensureLayer() {
    const box = container();
    if (layer && box.contains(layer)) return layer;
    layer = document.createElement("div");
    layer.className = "kalq-pins";
    box.append(layer);
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => place());
    resizeObserver.observe(box);
    return layer;
}

function pinNode(c, author) {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "kalq-pin";
    if (c.resolved_at) pin.classList.add("is-resolved");
    pin.dataset.id = c.id || "draft";
    pin.style.setProperty("--c", author.color);
    pin.setAttribute("aria-label", t("by")(author.name));
    pin.append(avatarNode(author));
    const n = c.id ? repliesOf(c.id).length : 0;
    if (n) {
        const badge = document.createElement("span");
        badge.className = "kalq-pin__count";
        badge.textContent = n;
        pin.append(badge);
    }
    pin.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openThread = openThread === pin.dataset.id ? null : pin.dataset.id;
        focusComposer = true;
        if (pin.dataset.id !== "draft") draft = null;
        render();
    });
    return pin;
}

function messageNode(c) {
    const author = person(c.author_id);
    const item = document.createElement("div");
    item.className = "kalq-thread__msg";
    const head = document.createElement("div");
    head.className = "kalq-thread__head";
    const name = document.createElement("strong");
    name.textContent = author.name;
    const time = document.createElement("time");
    time.dateTime = c.created_at;
    time.title = fullDate(c.created_at);
    time.textContent = when(c.created_at);
    head.append(avatarNode(author), name, time);
    const text = document.createElement("p");
    text.textContent = c.body; // plain text only
    item.append(head, text);
    return item;
}

function composer(onSend, placeholder) {
    const form = document.createElement("form");
    form.className = "kalq-thread__form";
    const input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = 2000;
    input.placeholder = placeholder;
    const actions = document.createElement("div");
    actions.className = "kalq-thread__actions";
    const sendBtn = document.createElement("button");
    sendBtn.type = "submit";
    sendBtn.className = "kalq-btn kalq-btn--primary";
    sendBtn.textContent = t("send");
    actions.append(sendBtn);
    form.append(input, actions);
    const submit = async () => {
        const text = input.value.trim();
        if (!text) return;
        sendBtn.disabled = true;
        try { typing = null; await onSend(text); }
        catch (error) { collab.toast(error.message === "rate_limited" ? t("rate") : t("failed"), "error"); sendBtn.disabled = false; }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    input.addEventListener("keydown", (e) => {
        e.stopPropagation(); // keep shortcuts and smooth-scrollbar out of the text
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.preventDefault(); openThread = null; draft = null; render(); }
    });
    // Keep what was typed (and the cursor) when a live update re-renders the thread
    const forId = openThread;
    // Focus is set by render() right after the box is in the page, so no keystroke reaches the page shortcuts
    if (typing && typing.for === forId) {
        input.value = typing.value;
        if (typing.focused) input.dataset.focus = `${typing.start},${typing.end}`;
    } else if (focusComposer) {
        input.dataset.focus = "end";
    }
    focusComposer = false;
    input.addEventListener("input", () => { typing = { for: forId, value: input.value, start: input.selectionStart, end: input.selectionEnd, focused: true }; });
    input.addEventListener("blur", () => { if (typing?.for === forId) typing.focused = false; });
    return { form, actions };
}

function threadNode(root) {
    const card = document.createElement("div");
    card.className = "kalq-thread";
    card.addEventListener("click", (e) => e.stopPropagation());
    card.addEventListener("pointerdown", (e) => e.stopPropagation());

    const close = document.createElement("button");
    close.type = "button";
    close.className = "kalq-thread__close";
    close.setAttribute("aria-label", t("close"));
    close.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => { openThread = null; draft = null; render(); });
    card.append(close);

    if (!root) {
        // New comment
        const { form, actions } = composer(async (text) => {
            const created = await send({ ...draft, body: text });
            draft = null;
            openThread = created.id;
            setMode(false);
            render();
        }, t("placeholder"));
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "kalq-btn";
        cancel.textContent = t("cancel");
        cancel.addEventListener("click", () => { draft = null; openThread = null; render(); });
        actions.prepend(cancel);
        card.append(form);
        return card;
    }

    const list = document.createElement("div");
    list.className = "kalq-thread__list";
    list.append(messageNode(root), ...repliesOf(root.id).map(messageNode));
    card.append(list);

    if (root.resolved_at) {
        const note = document.createElement("p");
        note.className = "kalq-thread__resolved";
        note.textContent = `${t("resolved")} · ${person(root.resolved_by || "").name} · ${when(root.resolved_at)}`;
        card.append(note);
    }
    const { form, actions } = composer(async (text) => { await send({ parent_id: root.id, body: text }); render(); }, t("reply"));
    if (canResolve(root)) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "kalq-btn";
        toggle.textContent = root.resolved_at ? t("reopen") : t("resolve");
        toggle.addEventListener("click", () => setResolved(root, !root.resolved_at));
        actions.prepend(toggle);
    }
    card.append(form);
    return card;
}

function place() {
    if (!layer) return;
    const width = container().getBoundingClientRect().width;
    layer.querySelectorAll(".kalq-pin").forEach((pin) => {
        const c = pin.dataset.id === "draft" ? draft : comments.find((x) => x.id === pin.dataset.id);
        if (!c) return;
        const { x, y } = point(c);
        pin.style.transform = `translate(${x}px, ${y}px)`;
        const card = layer.querySelector(`.kalq-thread[data-for="${pin.dataset.id}"]`);
        if (card) {
            const left = x + 300 + 40 > width ? Math.max(8, x - 300 - 16) : x + 24; // flip near the right edge
            card.style.transform = `translate(${left}px, ${Math.max(0, y - 12)}px)`;
        }
    });
}

function render() {
    if (!collab.page) return;
    // During a page change, never draw the previous page's pins into the new page
    if (commentsPage !== container()?.dataset.page) { document.querySelectorAll(".kalq-pins").forEach((l) => l.replaceChildren()); return; }
    const active = document.activeElement;
    if (active?.matches?.(".kalq-thread textarea") && typing) Object.assign(typing, { start: active.selectionStart, end: active.selectionEnd, focused: true });
    ensureLayer();
    layer.replaceChildren();
    visibleRoots().forEach((c) => layer.append(pinNode(c, person(c.author_id))));
    if (draft) layer.append(pinNode(draft, collab.me));

    const target = openThread === "draft" ? null : comments.find((c) => c.id === openThread);
    if (openThread === "draft" && draft) {
        const card = threadNode(null);
        card.dataset.for = "draft";
        layer.append(card);
    } else if (target && (showResolved || !target.resolved_at)) {
        const card = threadNode(target);
        card.dataset.for = target.id;
        layer.append(card);
    }
    place();
    const input = layer.querySelector(".kalq-thread textarea[data-focus]");
    if (input) {
        input.focus({ preventScroll: true });
        const [start, end] = input.dataset.focus === "end" ? [input.value.length, input.value.length] : input.dataset.focus.split(",").map(Number);
        input.setSelectionRange(start, end);
    }
    panel.refresh("comments");
}

//=================================== Panel tab ===================================//
function renderTab(body) {
    const bar = document.createElement("label");
    bar.className = "kalq-panel__toggle";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = showResolved;
    check.addEventListener("change", () => { showResolved = check.checked; render(); });
    bar.append(check, document.createTextNode(` ${t("showResolved")}`));
    body.append(bar);

    const items = visibleRoots().slice().reverse();
    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "kalq-panel__empty";
        empty.textContent = t("empty");
        body.append(empty);
        return;
    }
    items.forEach((c) => {
        const author = person(c.author_id);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "kalq-panel__row";
        if (c.resolved_at) row.classList.add("is-resolved");
        const meta = document.createElement("span");
        meta.className = "kalq-panel__meta";
        const name = document.createElement("strong");
        name.textContent = author.name;
        const time = document.createElement("span");
        time.textContent = when(c.created_at);
        meta.append(avatarNode(author), name, time);
        const text = document.createElement("span");
        text.className = "kalq-panel__text";
        text.textContent = c.body;
        row.append(meta, text);
        const n = repliesOf(c.id).length;
        if (n) {
            const replies = document.createElement("span");
            replies.className = "kalq-panel__sub";
            replies.textContent = t("replies")(n);
            row.append(replies);
        }
        row.addEventListener("click", () => {
            openThread = c.id;
            render();
            const pin = layer.querySelector(`.kalq-pin[data-id="${c.id}"]`);
            const bar = window.Scrollbar && Scrollbar.get(document.querySelector(".scrollbar-container"));
            if (pin && bar) bar.scrollIntoView(pin, { offsetTop: window.innerHeight / 3 });
            else pin?.scrollIntoView({ block: "center" });
        });
        body.append(row);
    });
}

//=================================== Mode ===================================//
function setMode(next) {
    on = next;
    document.body.classList.toggle("kalq-commenting", on);
    button.setAttribute("aria-pressed", on);
    if (on) collab.setActiveMode("comment");
    if (!on && draft) { draft = null; if (openThread === "draft") openThread = null; render(); }
}

// In comment mode a click anywhere in the page drops a pin; links and Barba do not fire
function onClick(e) {
    if (!on) return;
    if (e.target.closest(".kalq-toolbar, .kalq-panel, .kalq-pin, .kalq-thread, .site-header, .site-menu, .kalq-toast")) return;
    const box = container();
    if (!box || !box.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    draft = anchorFor(e);
    openThread = "draft";
    focusComposer = true;
    render();
}

export function initComments(api, sidePanel) {
    collab = api;
    panel = sidePanel;
    panel.addTab({ id: "comments", label: () => t("tab"), render: renderTab });

    button = document.createElement("button");
    button.type = "button";
    button.className = "kalq-toolbar__btn";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 2.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const label = () => { button.title = t("mode"); button.setAttribute("aria-label", t("mode")); };
    label();
    button.addEventListener("click", () => setMode(!on));
    collab.addTool(button, 20);

    document.addEventListener("click", onClick, true); // capture: before links and Barba
    document.addEventListener("kalq:language", () => { label(); render(); });
    collab.on("key:c", () => button.click());
    collab.on("escape", () => { if (draft || openThread) { draft = null; openThread = null; render(); } else if (on) setMode(false); });
    collab.on("mode", (mode) => { if (mode !== "comment" && on) setMode(false); });
    collab.on("comments", ({ page }) => { if (page === collab.page) load(); });
    collab.on("content", () => setTimeout(place, 50)); // edited text can move pins
    collab.on("page", () => {
        comments = []; commentsPage = null; draft = null; openThread = null;
        document.querySelectorAll(".kalq-pins").forEach((l) => l.remove());
        layer = null;
        load();
    });
    window.addEventListener("resize", place);
    load();
}
