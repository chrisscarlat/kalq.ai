// Collaboration layer, Phase 3: toolbar, who is online (avatar stack) and live cursors.
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
const t = (key) => TEXT[document.documentElement.lang === "en" ? "en" : "de"][key];

const state = {
    sb: null,
    me: null,
    channel: null,
    page: null,
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
    if (state.channel) await state.sb.removeChannel(state.channel);
    state.cursors.forEach((c) => c.el.remove());
    state.cursors.clear();
    state.page = page;
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
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => moveCursor(payload))
        .subscribe(async (status) => {
            if (status === "SUBSCRIBED") await channel.track({ uid, kind, name, avatar_url, color, emoji, animal, at: Date.now() });
        });
    state.channel = channel;
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
    const out = el("button", "kalq-toolbar__btn", { type: "button" });
    out.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const label = () => { out.setAttribute("aria-label", t("logout")); out.title = t("logout"); };
    label();
    document.addEventListener("kalq:language", () => { label(); renderStack(); });
    out.addEventListener("click", logout);
    bar.append(stack, divider, out);
    document.body.append(bar);
    state.toolbar = bar;
}

//=================================== Start ===================================//
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
    state.layer = el("div", "kalq-cursors", { "aria-hidden": "true" });
    if (reducedMotion) state.layer.classList.add("is-still");
    document.body.append(state.layer);
    state.peers = [{ ...state.me, at: Date.now() }];
    renderStack();

    const cfg = await fetch("/api/config").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!cfg || !window.supabase) return;
    state.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, detectSessionInUrl: false },
    });

    await joinPage();
    window.barba?.hooks.after(() => joinPage());

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
