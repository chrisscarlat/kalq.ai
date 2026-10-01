// Variant viewer: hold the header logo for three seconds (a ring fills) to open a full-screen glass viewer.
// One large card per published variant: the animated Kalq mark (or the variant's own logo, turning in 3D) in its
// colours and fonts, a sample headline and its hero video. Everyone through the gate votes (one vote per person per
// variant, again to take it back), sees who voted and comments. Arrow keys and swipe move between cards.
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { currentLang } from "./i18n.js";
import { logoAnimation } from "./logoAnimation.js";
import { getVariants, loadVariants } from "./variants.js";

const HOLD_MS = 3000;
const DEFAULT_VIDEO = "assets/video-hero-6mb-low.mp4";
const TEXT = {
    de: { title: "Stilvarianten", vote: "Stimme", votes: (n) => (n === 1 ? "1 Stimme" : `${n} Stimmen`), voted: "Abgestimmt", sortVotes: "Nach Stimmen", sortLetter: "Nach Buchstabe", close: "Schließen", comment: "Kommentar schreiben", send: "Senden", noComments: "Noch keine Kommentare.", hint: "← → oder wischen", failed: "Das hat nicht geklappt.", headline: "Ein technischer Kern. Zwei kommerzielle Engines.", body: "Bessere industrielle Entscheidungen." },
    en: { title: "Style variants", vote: "Vote", votes: (n) => (n === 1 ? "1 vote" : `${n} votes`), voted: "Voted", sortVotes: "By votes", sortLetter: "By letter", close: "Close", comment: "Write a comment", send: "Send", noComments: "No comments yet.", hint: "← → or swipe", failed: "That did not work.", headline: "One technical core. Two commercial engines.", body: "Better industrial decisions." },
};
const t = (key) => TEXT[currentLang() === "en" ? "en" : "de"][key];

let collab, root = null, index = 0, sort = "letter", votes = {}, people = {}, comments = [], timelines = [];

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};
const published = () => getVariants().filter((v) => v.status === "published");
const ordered = () => {
    const list = published();
    return sort === "votes" ? list.slice().sort((a, b) => (votes[b.id]?.length || 0) - (votes[a.id]?.length || 0) || a.letter.localeCompare(b.letter)) : list;
};
const fontOf = (font) => (font && font.source !== "default" && font.family ? `"${font.family}", "Clash Grotesk", sans-serif` : "");

function personNode(id) {
    const p = (id === collab.me.uid ? collab.me : null) || collab.peers.find((x) => x.uid === id) || people[id] || {};
    const node = el("span", { className: "kalq-avatar kalq-avatar--mini", title: p.name || "" });
    node.style.setProperty("--c", p.color || "#555");
    node.style.setProperty("--fg", collab.textOn(p.color || "#555555"));
    if (p.avatar_url) node.append(el("img", { src: p.avatar_url, alt: "", referrerPolicy: "no-referrer" }));
    else node.textContent = p.emoji || (p.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return node;
}

//=================================== Data ===================================//
async function load() {
    const [vRes, cRes] = await Promise.all([
        fetch("/api/variants", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/comments?page=variants", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (vRes) { votes = vRes.votes || {}; people = { ...people, ...vRes.people }; }
    if (cRes) { comments = cRes.comments || []; people = { ...people, ...cRes.people }; }
    await loadVariants();
    render();
}

async function vote(variant) {
    const res = await fetch("/api/variants", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "vote", id: variant.id }) }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return collab.toast(t("failed"), "error"); }
    collab.broadcast("variants", { kind: "vote" }, { site: true });
    await load();
}

async function comment(variant, text) {
    const res = await fetch("/api/comments", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "variants", block_key: `variant.${variant.id}`, body: text }) }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); throw new Error("failed"); }
    collab.broadcast("variants", { kind: "comment" }, { site: true });
    await load();
}

//=================================== Cards ===================================//
function logoBox(variant) {
    const box = el("div", { className: "kalq-viewer__logo" });
    const clean = variant.logo_svg ? sanitizeSvg(variant.logo_svg) : "";
    if (clean) {
        const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
        if (!doc.querySelector("parsererror")) { box.classList.add("is-custom"); box.append(document.importNode(doc.documentElement, true)); return box; }
    }
    // The animated Kalq mark, in the variant's light colour
    const mark = document.querySelector(".site-logo__mark")?.cloneNode(true);
    if (mark) {
        mark.removeAttribute("data-animated");
        mark.setAttribute("class", "kalq-viewer__mark");
        mark.style.color = variant.colors?.light || "#fff";
        box.append(mark);
        if (window.gsap) requestAnimationFrame(() => { const tl = logoAnimation(mark, { delay: 0.3 }); if (tl) timelines.push(tl); });
    }
    return box;
}

function card(variant, active) {
    const c = variant.colors || {};
    const node = el("article", { className: "kalq-viewer__card" });
    node.classList.toggle("is-active", active);
    node.style.setProperty("--v-bg", c.dark || "#101010");
    node.style.setProperty("--v-text", c.light || "#fff");
    node.style.setProperty("--v-accent", c.accent || "#3b82f6");
    const video = el("video", { className: "kalq-viewer__video", src: variant.hero_video || DEFAULT_VIDEO, muted: true, loop: true, playsInline: true, autoplay: active });
    video.setAttribute("aria-hidden", "true");
    const headline = el("h3", { className: "kalq-viewer__headline", textContent: t("headline") });
    headline.style.fontFamily = fontOf(variant.fonts?.heading);
    const body = el("p", { className: "kalq-viewer__body", textContent: t("body") });
    body.style.fontFamily = fontOf(variant.fonts?.body);

    const voters = votes[variant.id] || [];
    const mine = voters.includes(collab.me.uid);
    const voteBtn = el("button", { type: "button", className: "kalq-viewer__vote", textContent: mine ? `♥ ${t("voted")}` : `♡ ${t("vote")}` });
    voteBtn.setAttribute("aria-pressed", mine);
    voteBtn.addEventListener("click", () => vote(variant));
    const faces = el("div", { className: "kalq-viewer__faces" }, ...voters.slice(0, 8).map(personNode), voters.length > 8 ? el("span", { className: "kalq-viewer__more", textContent: `+${voters.length - 8}` }) : null);

    const thread = comments.filter((x) => x.block_key === `variant.${variant.id}`);
    const list = el("div", { className: "kalq-viewer__comments" }, ...(thread.length ? thread.map((x) => el("div", { className: "kalq-viewer__comment" }, personNode(x.author_id), el("p", { textContent: x.body }))) : [el("p", { className: "kalq-viewer__empty", textContent: t("noComments") })]));
    const form = el("form", { className: "kalq-viewer__form" });
    const input = el("input", { type: "text", maxLength: 2000, placeholder: t("comment") });
    input.addEventListener("keydown", (e) => e.stopPropagation()); // arrows move the caret, not the cards
    form.append(input, el("button", { type: "submit", className: "kalq-btn kalq-btn--primary", textContent: t("send") }));
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        try { await comment(variant, text); } catch { collab.toast(t("failed"), "error"); }
    });

    node.append(
        el("div", { className: "kalq-viewer__stage" }, video, el("div", { className: "kalq-viewer__shade" }), logoBox(variant),
            el("div", { className: "kalq-viewer__text" }, headline, body)),
        el("div", { className: "kalq-viewer__meta" },
            el("div", { className: "kalq-viewer__name" }, el("span", { className: "kalq-viewer__letter", textContent: variant.letter }), el("strong", { textContent: variant.name || "" })),
            el("div", { className: "kalq-viewer__voting" }, voteBtn, el("span", { className: "kalq-viewer__count", textContent: t("votes")(voters.length) }), faces),
            list, form),
    );
    return node;
}

function render() {
    if (!root) return;
    timelines.forEach((tl) => tl.kill());
    timelines = [];
    const list = ordered();
    index = Math.max(0, Math.min(index, list.length - 1));
    const track = root.querySelector(".kalq-viewer__track");
    track.replaceChildren(...list.map((v, i) => card(v, i === index)));
    track.style.transform = `translateX(calc(${-index} * (min(760px, 86vw) + 2rem)))`;
    root.querySelector(".kalq-viewer__sort").textContent = sort === "votes" ? t("sortLetter") : t("sortVotes");
    root.querySelector(".kalq-viewer__dots").replaceChildren(...list.map((v, i) => {
        const d = el("button", { type: "button", className: "kalq-viewer__dot", textContent: v.letter });
        d.setAttribute("aria-current", i === index);
        d.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        d.addEventListener("click", () => go(i));
        return d;
    }));
}

function go(i) {
    const count = ordered().length;
    if (!count) return;
    index = (i + count) % count;
    render();
}

//=================================== Open, close, navigate ===================================//
function open() {
    if (root) return;
    root = el("div", { className: "kalq-viewer" });
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", t("title"));
    const sortBtn = el("button", { type: "button", className: "kalq-btn kalq-viewer__sort" });
    sortBtn.addEventListener("click", () => { sort = sort === "votes" ? "letter" : "votes"; index = 0; render(); });
    const close = el("button", { type: "button", className: "kalq-viewer__close", innerHTML: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' });
    close.setAttribute("aria-label", t("close"));
    close.addEventListener("click", closeViewer);
    root.append(
        el("header", { className: "kalq-viewer__head" }, el("strong", { textContent: t("title") }), el("span", { className: "kalq-viewer__hint", textContent: t("hint") }), sortBtn, close),
        el("div", { className: "kalq-viewer__viewport" }, el("div", { className: "kalq-viewer__track" })),
        el("div", { className: "kalq-viewer__dots", role: "group" }), // never a <nav>: the template styles every nav a
    );
    // Swipe
    let startX = null;
    root.addEventListener("pointerdown", (e) => { if (!e.target.closest("input, button, form")) startX = e.clientX; });
    root.addEventListener("pointerup", (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
    });
    document.body.append(root);
    document.body.classList.add("kalq-viewer-open");
    index = Math.max(0, ordered().findIndex((v) => v.letter === document.documentElement.dataset.variant));
    render();
    load();
    close.focus();
}

function closeViewer() {
    if (!root) return;
    timelines.forEach((tl) => tl.kill());
    timelines = [];
    root.remove();
    root = null;
    document.body.classList.remove("kalq-viewer-open");
}

document.addEventListener("keydown", (e) => {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeViewer(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
}, true);

// Hold the header logo for three seconds: a ring fills, then the viewer opens (and the logo link does not fire)
function initLongPress() {
    const logo = document.querySelector(".site-logo");
    if (!logo) return;
    const ring = el("div", { className: "kalq-hold", innerHTML: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/></svg>' });
    document.body.append(ring);
    let timer = null, opened = false;
    const reset = () => { clearTimeout(timer); timer = null; ring.classList.remove("is-filling"); };
    logo.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        opened = false;
        const r = logo.querySelector(".site-logo__mark, .site-logo__custom").getBoundingClientRect();
        ring.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px) translate(-50%, -50%)`;
        ring.classList.add("is-filling");
        timer = setTimeout(() => { opened = true; reset(); open(); }, HOLD_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => logo.addEventListener(ev, reset));
    logo.addEventListener("click", (e) => { if (opened) { e.preventDefault(); e.stopImmediatePropagation(); opened = false; } }, true);
    logo.addEventListener("contextmenu", (e) => { if (timer || opened) e.preventDefault(); }); // long press on phones
}

export function initViewer(api) {
    collab = api;
    initLongPress();
    collab.on("variants", () => { if (root) load(); });
    document.addEventListener("kalq:language", () => render());
}
