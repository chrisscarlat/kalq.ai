import { refreshContent } from "./content.js";
import { EDITOR_LANG } from "./i18n.js";

// Collaboration layer: toolbar, who is online (avatar stack), live cursors, and the hooks the editing,
// comment and history modules plug into (see `collab` below).
// One Supabase Realtime channel per page, presence:<page>:<key>. Initialised once, rejoins after each Barba page change.
// Everything lives outside the blended header and is not a <nav>.

const PALETTE = ["#FF5A5F", "#FFB400", "#00A699", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316"];
const SEND_EVERY_MS = 50; // about 20 cursor updates per second
const IDLE_MS = 5000;
const STACK_MAX = 5;

const TEXT = {
    de: { logout: "Abmelden", online: "Online", you: "Sie" },
    en: { logout: "Log out", online: "Online", you: "You" },
};
const t = (key) => TEXT[EDITOR_LANG][key];

const state = {
    sb: null,
    me: null,
    channel: null,
    page: null,
    locks: new Map(), // uid -> { key, until }: blocks others are editing right now
    peers: [], // decorated presence list, self included
    cursors: new Map(), // uid -> { el, x_pct, y_doc, idle }
    toolbar: null,
    layer: null,
};

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scrollbar = () => {
    const container = document.querySelector(".scrollbar-container");
    return container && window.Scrollbar ? Scrollbar.get(container) : null;
};
const scrollY = () => scrollbar()?.offset.y ?? window.scrollY;

const currentPage = () => {
    const containers = document.querySelectorAll('[data-barba="container"]');
    return containers.length ? containers[containers.length - 1].dataset.page : null;
};

// Readable label text on each palette colour
const textOn = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? "#101010" : "#fff";
};

const initials = (name) => name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

const el = (tag, className, attrs = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
};

function avatar(person, size = "") {
    const node = el("span", `kalq-avatar ${size}`.trim(), { title: person.name });
    node.style.setProperty("--c", person.color);
    node.style.setProperty("--fg", textOn(person.color));
    if (person.avatar_url) {
        const img = el("img", "", { src: person.avatar_url, alt: "", referrerpolicy: "no-referrer" });
        img.addEventListener("error", () => { img.remove(); node.textContent = initials(person.name); });
        node.append(img);
    } else {
        node.textContent = person.emoji || initials(person.name);
        if (person.emoji) node.classList.add("is-emoji");
    }
    return node;
}

//=================================== Presence ===================================//
// Same order and colours on every screen: earliest arrival keeps its colour, later ones take the next free one.
// Two guests with the same animal become "Guest Fox" and "Guest Fox 2".
function decorate(presence) {
    const people = Object.values(presence).map((metas) => metas[0]).filter(Boolean)
        .sort((a, b) => (a.at - b.at) || a.uid.localeCompare(b.uid));
    const used = new Set();
    const animals = {};
    return people.map((p) => {
        let color = p.color;
        if (used.has(color)) color = PALETTE.find((c) => !used.has(c)) || color;
        used.add(color);
        let name = p.name;
        if (p.kind === "guest") {
            animals[p.animal] = (animals[p.animal] || 0) + 1;
            if (animals[p.animal] > 1) name = `${p.name} ${animals[p.animal]}`;
        }
        return { ...p, color, name };
    });
}

function renderStack() {
    const stack = state.toolbar.querySelector(".kalq-stack");
    const people = [...state.peers].sort((a, b) => (b.uid === state.me.uid) - (a.uid === state.me.uid));
    stack.replaceChildren(...people.slice(0, STACK_MAX).map((p) => {
        const node = avatar(p);
        if (p.uid === state.me.uid) node.title = `${p.name} (${t("you")})`;
        return node;
    }));
    if (people.length > STACK_MAX) {
        const more = el("span", "kalq-avatar kalq-avatar--more", { title: people.slice(STACK_MAX).map((p) => p.name).join(", ") });
        more.textContent = `+${people.length - STACK_MAX}`;
        stack.append(more);
    }
    stack.setAttribute("aria-label", `${t("online")}: ${people.map((p) => p.name).join(", ")}`);

    // Cursors follow presence: new colours and names, gone when someone leaves
    const present = new Set(state.peers.map((p) => p.uid));
    state.cursors.forEach((cursor, uid) => {
        if (!present.has(uid)) { cursor.el.remove(); state.cursors.delete(uid); }
        else styleCursor(cursor, state.peers.find((p) => p.uid === uid));
    });
}

async function joinPage() {
    const page = currentPage();
    if (!page || page === state.page || !state.sb) return;
    const old = state.channel;
    state.channel = null; // so its closing does not trigger a rejoin
    if (old) await state.sb.removeChannel(old);
    state.cursors.forEach((c) => c.el.remove());
    state.cursors.clear();
    state.page = page;
    state.joinedAt = null;
    state.locks.clear();
    emit("locks", []);
    state.peers = [{ ...state.me, at: Date.now() }];
    renderStack();

    const { uid, kind, name, avatar_url, color, emoji, animal } = state.me;
    const channel = state.sb.channel(`presence:${page}:${state.me.channelKey}`, {
        config: { presence: { key: uid }, broadcast: { self: false } },
    });
    channel
        .on("presence", { event: "sync" }, () => {
            state.peers = decorate(channel.presenceState());
            renderStack();
            emit("peers", state.peers);
            emitLocks(); // someone who left no longer holds a lock
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => moveCursor(payload))
        .on("broadcast", { event: "content" }, ({ payload }) => emit("content", payload))
        .on("broadcast", { event: "lock" }, ({ payload }) => receiveLock(payload))
        .on("broadcast", { event: "comments" }, ({ payload }) => emit("comments", payload))
        .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                state.joinedAt = state.joinedAt || Date.now();
                state.subscribedAt = Date.now();
                await channel.track(presenceMeta()); // the only presence update per page visit
                if (myLock) sendLock();
            } else if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status) && state.channel === channel) {
                // Closed by the server (rate limit, network): join again, waiting longer if it keeps happening
                const unstable = Date.now() - (state.subscribedAt || 0) < 30000;
                state.rejoins = unstable ? (state.rejoins || 0) + 1 : 0;
                const delay = [1500, 5000, 15000, 30000][Math.min(state.rejoins, 3)];
                setTimeout(() => {
                    if (state.channel !== channel) return;
                    state.page = null;
                    joinPage();
                }, delay);
            }
        });
    state.channel = channel;
    emit("page", page);
}

const presenceMeta = () => {
    const { uid, kind, name, avatar_url, color, emoji, animal } = state.me;
    return { uid, kind, name, avatar_url, color, emoji, animal, at: state.joinedAt || Date.now() };
};

//=================================== Soft locks ===================================//
// Presence allows only 5 updates per client in 30 s, so "I am editing X" is a broadcast instead,
// repeated while editing and expiring when it stops (closed tab, lost connection).
const LOCK_BEAT_MS = 4000;
const LOCK_TTL_MS = 10000;
let myLock = null;
let lockBeat = null;

const sendLock = () => collab.broadcast("lock", { key: myLock });

function receiveLock({ uid, key }) {
    if (!uid || uid === state.me.uid) return;
    if (typeof key === "string") state.locks.set(uid, { key, until: Date.now() + LOCK_TTL_MS });
    else state.locks.delete(uid);
    emitLocks();
}

function emitLocks() {
    const now = Date.now();
    const list = [];
    state.locks.forEach((lock, uid) => {
        const person = state.peers.find((p) => p.uid === uid);
        if (lock.until < now || !person) state.locks.delete(uid);
        else list.push({ key: lock.key, person });
    });
    emit("locks", list);
}
setInterval(emitLocks, 2000);

// One channel for the whole site (no presence): style variants, votes and variant comments reach everyone,
// whichever page they are on
function joinSite() {
    state.site = state.sb.channel(`site:${state.me.channelKey}`, { config: { broadcast: { self: false } } });
    state.site
        .on("broadcast", { event: "variants" }, ({ payload }) => {
            emit("variants", payload);
            document.dispatchEvent(new CustomEvent("kalq:variants", { detail: payload }));
        })
        .subscribe((status) => {
            if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) setTimeout(() => { state.sb.removeChannel(state.site); joinSite(); }, 5000);
        });
}

//=================================== Cursors ===================================//
let lastSent = 0;
let sendTimer = null;
let lastPointer = null;

function sendCursor() {
    sendTimer = null;
    if (!state.channel || !lastPointer) return;
    lastSent = performance.now();
    state.channel.send({
        type: "broadcast",
        event: "cursor",
        payload: { uid: state.me.uid, x_pct: lastPointer.x / window.innerWidth, y_doc: scrollY() + lastPointer.y },
    });
}

function queueCursor() {
    const wait = SEND_EVERY_MS - (performance.now() - lastSent);
    if (wait <= 0) sendCursor();
    else if (!sendTimer) sendTimer = setTimeout(sendCursor, wait);
}

function styleCursor(cursor, person) {
    if (!person) return;
    cursor.el.style.setProperty("--c", person.color);
    cursor.el.style.setProperty("--fg", textOn(person.color));
    const label = cursor.el.querySelector(".kalq-cursor__label");
    label.replaceChildren(avatar(person, "kalq-avatar--mini"), document.createTextNode(person.name));
}

function placeCursor(cursor) {
    const x = cursor.x_pct * window.innerWidth;
    const y = cursor.y_doc - scrollY();
    cursor.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function moveCursor({ uid, x_pct, y_doc }) {
    if (uid === state.me.uid || typeof x_pct !== "number" || typeof y_doc !== "number") return;
    let cursor = state.cursors.get(uid);
    if (!cursor) {
        const node = el("div", "kalq-cursor", { "aria-hidden": "true" });
        node.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18"><path d="M1 1l5.5 14 2.1-5.9L14.5 7z" fill="var(--c)" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg><span class="kalq-cursor__label"></span>';
        cursor = { el: node, idle: null };
        state.layer.append(node);
        state.cursors.set(uid, cursor);
        styleCursor(cursor, state.peers.find((p) => p.uid === uid) || { name: "", color: PALETTE[0] });
    }
    cursor.x_pct = x_pct;
    cursor.y_doc = y_doc;
    placeCursor(cursor);
    cursor.el.classList.remove("is-idle");
    clearTimeout(cursor.idle);
    cursor.idle = setTimeout(() => cursor.el.classList.add("is-idle"), IDLE_MS);
}

const placeAll = () => state.cursors.forEach(placeCursor);

//=================================== Toolbar ===================================//
async function logout() {
    try { await state.sb?.auth.signOut(); } catch (e) { }
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => { });
    location.href = "/gate.html";
}

function buildToolbar() {
    const bar = el("div", "kalq-toolbar", { role: "toolbar", "aria-label": "Kalq" });
    const stack = el("div", "kalq-stack", { role: "group" });
    const divider = el("span", "kalq-toolbar__divider", { "aria-hidden": "true" });
    const out = el("button", "kalq-toolbar__btn kalq-toolbar__logout", { type: "button" });
    out.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const label = () => { out.setAttribute("aria-label", t("logout")); out.title = t("logout"); };
    label();
    document.addEventListener("kalq:language", () => { label(); renderStack(); });
    out.addEventListener("click", logout);
    const tools = el("div", "kalq-tools", { role: "group" });
    bar.append(stack, divider, tools, out);
    document.body.append(bar);
    state.toolbar = bar;
}

//=================================== API for the other modules ===================================//
const listeners = {};
const emit = (event, data) => (listeners[event] || []).forEach((fn) => fn(data));

let toastTimer = null;
export const collab = {
    get me() { return state.me; },
    get sb() { return state.sb; },
    get page() { return state.page; },
    get peers() { return state.peers; },
    on(event, fn) { (listeners[event] ||= []).push(fn); },
    // Presence fields others can see, e.g. the block someone is editing
    // Tell the others which block I am editing (null when done)
    setLock(key) {
        myLock = key || null;
        clearInterval(lockBeat);
        sendLock();
        if (myLock) lockBeat = setInterval(sendLock, LOCK_BEAT_MS);
    },
    // Important messages (not cursors) are retried until Realtime accepts them. site: true goes to every page.
    async broadcast(event, payload, { site = false } = {}) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const channel = site ? state.site : state.channel;
            if (!channel) break;
            const result = await channel.send({ type: "broadcast", event, payload: { ...payload, uid: state.me.uid } }).catch(() => "error");
            if (result === "ok") return true;
            console.warn(`broadcast ${event}: ${result}, retrying`);
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
        console.warn(`broadcast ${event} not delivered`);
        return false;
    },
    // Tools keep a fixed order (edit, comment, history) however late their module loads
    addTool(button, order = 50) {
        button.dataset.order = order;
        const tools = state.toolbar.querySelector(".kalq-tools");
        const after = [...tools.children].find((b) => Number(b.dataset.order) > order);
        tools.insertBefore(button, after || null);
    },
    // Edit and comment mode exclude each other
    setActiveMode(mode) { emit("mode", mode); },
    // onClick: the message is itself a link to where it is fixed (it stays longer, to be clicked)
    toast(text, kind = "info", { onClick } = {}) {
        let node = document.querySelector(".kalq-toast");
        if (!node) { node = el("div", "kalq-toast", { role: "status", "aria-live": "polite" }); document.body.append(node); }
        node.dataset.kind = kind;
        node.classList.toggle("has-link", !!onClick);
        if (onClick) {
            const link = el("button", "kalq-toast__link", { type: "button" });
            link.textContent = `${text} →`;
            link.addEventListener("click", () => { node.classList.remove("is-shown"); onClick(); });
            node.replaceChildren(link);
        } else node.textContent = text;
        node.classList.add("is-shown");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => node.classList.remove("is-shown"), onClick ? 9000 : 3200);
    },
    textOn,
};

// Single-letter shortcuts, never while typing
document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target.closest?.("input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "Escape") return emit("escape", e);
    if (/^[a-z]$/i.test(e.key)) emit(`key:${e.key.toLowerCase()}`, e);
});

//=================================== Start ===================================//
//=================================== Panel scrolling ===================================//
// smooth-scrollbar takes every wheel and touch move on the document for the page. Over a panel the event is stopped
// before it gets there, so the panel scrolls natively under the pointer. While html.kalq-scroll-lock is set (the
// Styles panel is open) the page underneath does not move at all.
const PANELS = ".kalq-styles, .kalq-panel, .kalq-viewer, .kalq-thread, .kalq-picker";
function initPanelScroll() {
    const guard = (e) => {
        // The magazine handles its own pointer and touch input (pages follow the finger): leave it alone
        if (e.target instanceof Element && e.target.closest(".kalq-magazine")) return;
        const inPanel = e.target instanceof Element && e.target.closest(PANELS);
        if (inPanel) { e.stopPropagation(); return; }
        if (document.documentElement.classList.contains("kalq-scroll-lock")) { e.stopPropagation(); e.preventDefault(); }
    };
    window.addEventListener("wheel", guard, { capture: true, passive: false });
    window.addEventListener("touchmove", guard, { capture: true, passive: false });
    // The panel scrollbars grow a little while they move
    const timers = new WeakMap();
    document.addEventListener("scroll", (e) => {
        const box = e.target instanceof Element && e.target.closest(PANELS) ? e.target : null;
        if (!box) return;
        box.classList.add("is-scrolling");
        clearTimeout(timers.get(box));
        timers.set(box, setTimeout(() => box.classList.remove("is-scrolling"), 700));
    }, { capture: true, passive: true });
}

async function init() {
    if (document.body.dataset.collab) return;
    document.body.dataset.collab = "on";

    // Outside the gate (public legal pages) there is nobody to show
    const meRes = await fetch("/api/me", { credentials: "same-origin" }).catch(() => null);
    if (!meRes?.ok) {
        meRes?.body?.cancel(); // close the unread response
        return;
    }
    state.me = await meRes.json();

    buildToolbar();
    initPanelScroll();
    state.layer = el("div", "kalq-cursors", { "aria-hidden": "true" });
    if (reducedMotion) state.layer.classList.add("is-still");
    document.body.append(state.layer);
    state.peers = [{ ...state.me, at: Date.now() }];
    renderStack();

    const cfg = await fetch("/api/config").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!cfg || !window.supabase) return;
    state.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, detectSessionInUrl: false },
        // The client drops anything above 10 messages a second by default; cursors alone send up to 20
        realtime: { params: { eventsPerSecond: 40 } },
    });

    await joinPage();
    joinSite();
    window.barba?.hooks.before(() => emit("leave"));
    window.barba?.hooks.after(() => joinPage());

    // Someone saved: everyone, guests included, reloads those blocks from the server and sees a highlight
    collab.on("content", ({ keys = [], uid }) => {
        const author = state.peers.find((p) => p.uid === uid);
        refreshContent(keys.filter((k) => typeof k === "string"), author?.color);
    });

    // Comments and history for everyone, edit mode and invites only for editors
    const [{ initPanel }, { initComments }, { initHistory }] = await Promise.all([import("./panel.js"), import("./comments.js"), import("./history.js")]);
    const sidePanel = initPanel(collab);
    initHistory(collab, sidePanel);
    initComments(collab, sidePanel);
    import("./viewer.js").then((m) => m.initViewer(collab)).catch((e) => console.error("viewer", e));
    if (state.me.kind === "editor") {
        import("./edit.js").then((m) => m.initEditing(collab)).catch((e) => console.error("edit", e));
        import("./sections.js").then((m) => m.initSections(collab)).catch((e) => console.error("sections", e));
        import("./invite.js").then((m) => m.initInvite(collab)).catch((e) => console.error("invite", e));
        if (state.me.is_admin) import("./styles.js").then((m) => m.initStyles(collab)).catch((e) => console.error("styles", e));
    }

    // Touch devices only show the stack, they do not send cursors
    if (finePointer) {
        document.addEventListener("pointermove", (e) => { lastPointer = { x: e.clientX, y: e.clientY }; queueCursor(); }, { passive: true });
    }
    scrollbar()?.addListener(() => { placeAll(); if (lastPointer) queueCursor(); });
    window.addEventListener("resize", placeAll);
}

// After main.js has set up Barba and the scrollbar (its DOMContentLoaded handler is registered first)
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
