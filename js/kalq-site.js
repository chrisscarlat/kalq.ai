// Kalq's own additions on top of Q-Site, on every page (tools/build_pages.py), public so the legal pages have them too
// (site.config.json publicScripts). Each one is also written up for the engine in docs/engine-patches/.

// 1. Modules drawn again start working again (docs/engine-patches/02-modules-redrawn.md). For visitors the engine
// draws the page's library modules afresh whenever it applies content, the language or the style (js/content.js
// applyStoredLayout, fresh), but announces qs:layout, on which the modules start (js/main.js initModules), only when
// the sections' order or options change. The style is known only after the page has started, so the redrawn modules
// stayed without their scroll effects, swipes, belts and videos. Every section with a module added to a page's
// container now announces it once, the way the engine does for an inserted module.
let announced = false;
const announce = () => {
    if (announced) return;
    announced = true;
    requestAnimationFrame(() => { announced = false; document.dispatchEvent(new CustomEvent("qs:layout", { detail: { redrawn: true } })); });
};
new MutationObserver((records) => {
    for (const r of records) {
        if (!r.target.matches?.('[data-barba="container"]')) continue;
        if ([...r.addedNodes].some((n) => n.nodeType === 1 && n.matches("section[data-module]"))) return announce();
    }
}).observe(document.body, { childList: true, subtree: true });

// 2. The horizontal card row (scroll.horizontal) follows the hand as well as the scroll
// (docs/engine-patches/03-horizontal-drag.md). While it is pinned, its row moves one pixel for each pixel scrolled
// (js/modules/scrollEffects.js: the pin lasts as long as the row is wider than the screen), so dragging the row
// sideways scrolls the page by the same distance, back and forth within the pin, and the row moves with the hand.
// A drag never becomes a click on a card's link. On a touch screen only a sideways move drags; up and down scroll.
const bar = () => { const c = document.querySelector(".scrollbar-container"); return c && window.Scrollbar ? window.Scrollbar.get(c) : null; };
const scrollY = () => bar()?.offset.y ?? window.scrollY;
const setScroll = (y) => { const b = bar(); if (b) b.setPosition(0, y); else window.scrollTo(0, y); window.ScrollTrigger?.update(); };
let drag = null, suppressClick = false;

document.addEventListener("pointerdown", (e) => {
    const track = e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track");
    if (!track || e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0) || document.body.classList.contains("qs-edit")) return;
    const sec = track.closest("section");
    const top = scrollY() + sec.getBoundingClientRect().top; // where the pin starts
    const dist = Math.max(0, track.scrollWidth - track.clientWidth); // how far the pin lasts
    if (!dist) return;
    drag = { track, id: e.pointerId, x: e.clientX, y: e.clientY, from: scrollY(), min: top, max: top + dist, axis: null };
}, true);

document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (drag.axis === "y") { drag = null; return; } // up and down: the page scrolls as always
        drag.track.setPointerCapture?.(e.pointerId);
        drag.track.classList.add("is-dragging");
    }
    e.preventDefault();
    setScroll(Math.min(drag.max, Math.max(drag.min, drag.from - dx)));
}, { capture: true, passive: false });

const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.axis === "x") { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    drag.track.classList.remove("is-dragging");
    drag = null;
};
document.addEventListener("pointerup", end, true);
document.addEventListener("pointercancel", end, true);
document.addEventListener("click", (e) => {
    if (suppressClick && e.target.closest?.(".qs-f-hs__track")) { e.preventDefault(); e.stopPropagation(); }
}, true);
// the browser's own dragging of a card's picture or link would take the pointer away
document.addEventListener("dragstart", (e) => { if (e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track")) e.preventDefault(); }, true);

// A finger: the touch events (the browser cancels a touch's pointer events as soon as the page's smooth scroller takes
// the gesture). Once a move is clearly sideways it is the row's alone: the scroller never sees it.
const startDrag = (track, x, y) => {
    const sec = track.closest("section");
    const dist = Math.max(0, track.scrollWidth - track.clientWidth);
    if (!dist) return null;
    const top = scrollY() + sec.getBoundingClientRect().top;
    return { track, x, y, from: scrollY(), min: top, max: top + dist, axis: null };
};
let touch = null;
document.addEventListener("touchstart", (e) => {
    const track = e.target.closest?.(".qs-f-hs.is-armed .qs-f-hs__track");
    touch = track && e.touches.length === 1 && !document.body.classList.contains("qs-edit") ? startDrag(track, e.touches[0].clientX, e.touches[0].clientY) : null;
}, { capture: true, passive: true });
document.addEventListener("touchmove", (e) => {
    if (!touch || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
    if (!touch.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        touch.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (touch.axis === "y") { touch = null; return; }
        touch.track.classList.add("is-dragging");
    }
    e.preventDefault();
    e.stopPropagation();
    setScroll(Math.min(touch.max, Math.max(touch.min, touch.from - dx)));
}, { capture: true, passive: false });
const endTouch = (e) => {
    if (!touch) return;
    if (touch.axis === "x") { e.stopPropagation(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); }
    touch.track.classList.remove("is-dragging");
    touch = null;
};
document.addEventListener("touchend", endTouch, true);
document.addEventListener("touchcancel", endTouch, true);

// 3. The chat only for editors until it has a WhatsApp number (the Design panel's Chat: site.chat.whatsapp). Visitors
// see no chat; editors see it with a small note saying the number is missing. Hidden by css/_site.scss until this
// decides (html.kalq-chat-shown), so it never flashes for visitors.
import { storedEntry } from "./content.js";
const whatsapp = () => { const e = storedEntry("site.chat.whatsapp"); return String(e?.de ?? e?.en ?? "").replace(/<[^>]+>/g, "").trim(); };
let isEditor = false;
// The chat's photo is Manfred Esser (the Design panel's Chat: site.chat.avatar); the engine draws it with an empty alt
const AVATAR_ALT = "Manfred Esser";
// The chat speaks the site's language: its own DE/EN switch is hidden (css/_site.scss) and set to the page's language
// whenever the chat is drawn or the site's language changes, so the conversation so far is said again in it too
function chatFollowsSite() {
    const lang = document.documentElement.lang === "en" ? "en" : "de";
    const item = document.querySelector(`.qs-chat:not(.is-preview) .qs-chat__head .qs-chat__langs [data-lang="${lang}"]`);
    if (item && !item.classList.contains("is-active")) item.click();
}
function chatAccess() {
    chatFollowsSite();
    document.querySelectorAll(".qs-chat__avatar img, .qs-chat__toggle-photo img").forEach((img) => { if (img.alt !== AVATAR_ALT) img.alt = AVATAR_ALT; });
    const missing = !whatsapp();
    document.documentElement.classList.toggle("kalq-chat-shown", !missing || isEditor);
    document.querySelectorAll(".qs-chat__window").forEach((win) => {
        let note = win.querySelector(".kalq-chat-note");
        if (missing && isEditor) {
            if (note) return;
            note = Object.assign(document.createElement("p"), { className: "kalq-chat-note", textContent: "WhatsApp number missing" });
            const head = win.querySelector(".qs-chat__head");
            if (head) head.after(note); else win.prepend(note);
        } else note?.remove();
    });
}
fetch("/api/me", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((me) => { isEditor = me?.kind === "editor"; chatAccess(); });
["qs:content", "qs:site-settings", "qs:language"].forEach((ev) => document.addEventListener(ev, () => requestAnimationFrame(chatAccess)));
window.addEventListener("load", chatAccess);
// the chat draws its window again on a language change or a settings change: the note goes back in; every new
// message and the toggle draw the photo again: its alt goes back on
const CHAT_PARTS = ".qs-chat, .qs-chat__window, .qs-chat__avatar, .qs-chat__toggle-photo";
new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1 && (n.matches(CHAT_PARTS) || n.querySelector?.(CHAT_PARTS))))) chatAccess();
}).observe(document.body, { childList: true, subtree: true });

// 4. The "under construction" pill steps aside while text of the page is under it (a heading that starts high on a
// short screen, text scrolling past) and comes back once the spot is clear; pictures and video under it are fine.
const pill = () => document.querySelector(".kalq-construction");
const TEXT = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, a, button, label, [data-qs-key]";
function textUnderPill() {
    const el = pill();
    if (!el) return false;
    const r = el.getBoundingClientRect();
    for (const y of [r.top + 3, r.top + r.height / 2, r.bottom - 3]) {
        for (const x of [r.left + 6, r.left + r.width * 0.25, r.left + r.width / 2, r.left + r.width * 0.75, r.right - 6]) {
            // the topmost thing of the page at this point (the pill lets the pointer through, so it is not in the list)
            const top = document.elementsFromPoint(x, y).find((e) => !el.contains(e) && e.closest('[data-barba="container"]'));
            if (!top) continue;
            const text = top.closest(TEXT);
            if (text && text.closest('[data-barba="container"]') && text.textContent.trim()) return true;
        }
    }
    return false;
}
let pillQueued = false;
const placePill = () => {
    if (pillQueued) return;
    pillQueued = true;
    requestAnimationFrame(() => { pillQueued = false; document.documentElement.classList.toggle("kalq-pill-aside", textUnderPill()); });
};
window.addEventListener("load", () => {
    placePill();
    const c = document.querySelector(".scrollbar-container");
    const sb = c && window.Scrollbar ? window.Scrollbar.get(c) : null;
    if (sb) sb.addListener(placePill);
});
["scroll", "resize"].forEach((ev) => window.addEventListener(ev, placePill, { passive: true }));
["qs:layout", "qs:content", "qs:language"].forEach((ev) => document.addEventListener(ev, placePill));
document.addEventListener("click", () => setTimeout(placePill, 400)); // a page change (Barba) or an opened panel
setInterval(placePill, 1500); // and now and then, for anything that moves without telling (a page change, an animation)

// 5. The magazine's cover (two screens, js/magazine.js): the pill steps aside while the magazine is open
// (css/_site.scss); the cover gets a round sticker instead, slightly over the KALQ wordmark: the notice round its edge
// in the page's language (the pill's own words), a construction cone in the middle.
const CONE = '<svg class="kalq-sticker__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M20.6 6h6.8l11.3 34H9.3z" fill="currentColor"/>'
    + '<path d="M17.8 16.6h12.4l1.9 5.6H15.9zM14.5 26.5h19l1.9 5.7H12.6z" fill="#fff4cf" opacity="0.92"/><rect x="5" y="39.5" width="38" height="4.5" rx="1.6" fill="currentColor"/></svg>';
function stickerFor(title) {
    const words = (document.querySelector(".kalq-construction__text")?.textContent || "").trim();
    if (!words) return;
    let s = title.querySelector(":scope > .kalq-sticker");
    if (!s) { s = document.createElement("span"); s.className = "kalq-sticker"; s.setAttribute("aria-hidden", "true"); title.append(s); }
    if (s.dataset.words === words) return;
    s.dataset.words = words;
    // the words twice round the ring if they are short, separated by dots
    const ring = (words.replace(/\.\s*$/, "").replace(/\.\s+/g, " · ") + " · ").toUpperCase();
    const id = `kalq-ring-${Math.random().toString(36).slice(2, 7)}`;
    s.innerHTML = `<svg class="kalq-sticker__ring" viewBox="0 0 120 120"><defs><path id="${id}" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>`
        + `<text><textPath href="#${id}" textLength="276" lengthAdjust="spacingAndGlyphs">${ring.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textPath></text></svg>${CONE}`;
}
function stickers() { document.querySelectorAll(".is-front-cover .bk-cover__title").forEach(stickerFor); }
new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1 && (n.matches?.(".qs-magazine, .is-front-cover, .bk-cover__title") || n.querySelector?.(".bk-cover__title"))))) stickers();
}).observe(document.body, { childList: true, subtree: true });
["qs:language", "qs:content"].forEach((ev) => document.addEventListener(ev, () => setTimeout(stickers, 50)));

// 6. The footer's contacts row (tools/build_pages.py contacts_row): the links' addresses follow their fields. E-Mail
// writes to the email field's address; the address opens Google Maps for the address field's text, in a new tab (a
// plain link: nothing loads from Google before the click); LinkedIn shows only with a LinkedIn address filled in, so it
// never points anywhere unchecked. The fields are the page's own text, so every copy of the row (the "Pages and
// wordmark" footer copies it) follows, as soon as an edit lands or the content arrives.
const fieldText = (link) => (link.querySelector(".kalq-contact__field, [data-qs-key$='.contact.address']")?.textContent || "").replace(/\s+/g, " ").trim();
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const LINKEDIN_URL = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s<>"]+$/i;
function contacts() {
    document.querySelectorAll(".kalq-contact--email").forEach((a) => { const v = fieldText(a); if (EMAIL.test(v)) a.href = `mailto:${v}`; });
    document.querySelectorAll(".kalq-contact--address").forEach((a) => { const v = fieldText(a); if (v) a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`; });
    document.querySelectorAll(".kalq-contact--linkedin").forEach((a) => {
        const v = fieldText(a);
        if (LINKEDIN_URL.test(v)) { a.href = v; a.hidden = false; } else { a.removeAttribute("href"); a.hidden = true; }
    });
}
contacts();
["qs:content", "qs:language", "qs:layout"].forEach((ev) => document.addEventListener(ev, () => requestAnimationFrame(contacts)));
window.addEventListener("load", contacts);
// an edit in place changes the field's text without an event of its own
new MutationObserver((records) => { if (records.some((r) => (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest?.(".kalq-contacts"))) contacts(); })
    .observe(document.body, { childList: true, characterData: true, subtree: true });

// 7. Signed in, the header's avatar opens the login card (js/loginKey.js: the name, the role, Log out). For an editor
// the card also has Dashboard: it closes the card and switches the page into edit mode (the editor's pencil, "Edit"),
// unless it is in edit mode already. Signing in and out only from the header (css/_site.scss: no entry in the menus).
const DASHBOARD = { de: "Dashboard", en: "Dashboard" };
const penButton = () => document.querySelector('.qs-toolbar__btn[aria-label="Edit (E)"], .qs-toolbar__btn[aria-label="Edit page"]');
function dashboardEntry(card) {
    const out = card.querySelector(".qs-login__logout");
    const editor = card.querySelector(".qs-login__role.is-editor");
    let entry = card.querySelector(".kalq-login__dashboard");
    if (!out || !editor) return entry?.remove();
    if (!entry) {
        entry = Object.assign(document.createElement("button"), { type: "button", className: "qs-login__logout kalq-login__dashboard" });
        entry.addEventListener("click", () => {
            const pen = penButton();
            if (pen && pen.getAttribute("aria-pressed") !== "true") pen.click();
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); // the card closes
        });
        out.before(entry);
    }
    entry.textContent = DASHBOARD[document.documentElement.lang === "en" ? "en" : "de"];
}
function watchLoginCard() {
    const card = document.querySelector(".qs-login-card");
    if (!card || card.dataset.kalqWatched) return !!card;
    card.dataset.kalqWatched = "1";
    new MutationObserver(() => dashboardEntry(card)).observe(card, { childList: true });
    dashboardEntry(card);
    return true;
}
if (!watchLoginCard()) {
    const waiting = new MutationObserver(() => { if (watchLoginCard()) waiting.disconnect(); });
    waiting.observe(document.body, { childList: true });
}
