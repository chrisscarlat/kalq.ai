// The cookie bar: a black pill at the bottom centre with a white cookie, one line of text and a thin white line that
// runs out over 5 seconds. Two modes, both with their own text (editable, in each language):
//   notice  (no data collected): no buttons; when the line has run out the bar folds into its cookie and goes.
//           Shown once per visitor.
//   consent (data collected): Accept and Deny on its left; the line runs out but the bar stays until one is chosen.
//           Nothing non-essential loads before Accept. The choice is kept; Accept reloads the page with it.
// The mode and the texts are site blocks (site.cookie.mode, site.cookie.notice, site.cookie.consent), set in the
// design panel (Notifications). The server writes them into the page (applyCookieSettings, shared with the browser:
// no browser globals at the top level), so the bar's text is the page's own HTML. One unit for the port
// (PORT_NOTES.md): this file, css/components/_cookie-bar.scss and the markup in the page shell.
//
// Non-essential content waits in the page as <script type="text/plain" data-consent src|…> or
// <template data-consent>…</template>; after Accept they run (and window.kalqConsent.granted is true).

export const COOKIE_KEYS = { mode: "site.cookie.mode", notice: "site.cookie.notice", consent: "site.cookie.consent" };
export const MODES = ["notice", "consent"];
const SEEN = "kalq-cookie-notice"; // localStorage: the notice was shown
const CHOICE = "kalq-cookie-consent"; // localStorage: "granted" or "denied"
const SHOW_MS = 5000;
const LABEL = { de: "Cookies", en: "Cookies" };

const plain = (html) => String(html ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Write the stored settings into a document's bar (the server for every page, the browser after an edit).
// get(key) returns a stored entry ({ de, en }) or null; a missing text keeps the HTML's default.
export function applyCookieSettings(doc, get) {
    const bar = doc.querySelector(".kalq-cookie");
    if (!bar) return null;
    const modeEntry = get(COOKIE_KEYS.mode);
    const mode = MODES.includes(plain(modeEntry?.de ?? modeEntry?.en)) ? plain(modeEntry.de ?? modeEntry.en) : "notice";
    bar.setAttribute("data-mode", mode);
    ["notice", "consent"].forEach((m) => {
        const entry = get(COOKIE_KEYS[m]);
        if (!entry) return;
        ["de", "en"].forEach((lang) => {
            const span = bar.querySelector(`.kalq-cookie__text[data-for="${m}"] [lang="${lang}"]`);
            const text = plain(entry[lang]);
            if (span && text) span.textContent = text;
        });
    });
    // a notice informs (a polite status); the consent bar is a labelled region with its two buttons
    if (mode === "notice") { bar.setAttribute("role", "status"); bar.removeAttribute("aria-label"); }
    else { bar.setAttribute("role", "region"); bar.setAttribute("aria-label", LABEL[doc.documentElement.getAttribute("lang") === "en" ? "en" : "de"]); }
    return mode;
}

//=================================== Browser ===================================//
const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage off: asked again next visit */ } };
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Wait for one transition of the element itself (or a little longer, should none run)
const after = (el, prop, ms) => new Promise((resolve) => {
    const done = (e) => { if (e.target === el && (!prop || e.propertyName === prop)) { el.removeEventListener("transitionend", done); resolve(); } };
    el.addEventListener("transitionend", done);
    setTimeout(() => { el.removeEventListener("transitionend", done); resolve(); }, ms);
});

// Run what waited for consent: <script type="text/plain" data-consent> and <template data-consent>
function runOptional(doc = document) {
    doc.querySelectorAll('script[type="text/plain"][data-consent]').forEach((old) => {
        const s = doc.createElement("script");
        [...old.attributes].forEach((a) => { if (a.name !== "type" && a.name !== "data-consent") s.setAttribute(a.name, a.value); });
        if (old.dataset.type) s.type = old.dataset.type;
        s.textContent = old.textContent;
        old.replaceWith(s);
    });
    doc.querySelectorAll("template[data-consent]").forEach((t) => t.replaceWith(t.content.cloneNode(true)));
}

let shown = null; // the bar being shown, and how it leaves

function show(bar, { preview = false } = {}) {
    const mode = bar.dataset.mode === "consent" ? "consent" : "notice";
    const calm = still();
    bar.classList.toggle("is-still", calm);
    bar.classList.remove("is-in", "is-out", "is-folding", "is-gone", "is-run");
    bar.hidden = false;
    // the live region is on the page already: putting its sentence back in now has it announced, politely
    const text = bar.querySelector(`.kalq-cookie__text[data-for="${mode}"]`);
    const parent = text?.parentNode, next = text?.nextSibling;
    text?.remove();
    requestAnimationFrame(() => {
        if (text) parent.insertBefore(text, next);
        bar.classList.add("is-in", "is-run");
    });
    let leaving = false;
    const leave = async () => {
        if (leaving) return;
        leaving = true;
        const focused = bar.contains(document.activeElement);
        if (focused) document.activeElement.blur(); // its buttons go: nothing keeps focus on them
        if (calm) {
            bar.classList.add("is-out"); // a fade
            await after(bar, "opacity", 800);
        } else {
            // the pill folds into its cookie where the cookie sits, then the cookie shrinks away
            const icon = bar.querySelector(".kalq-cookie__icon");
            const box = bar.getBoundingClientRect();
            const iconW = icon ? icon.getBoundingClientRect().width : 0;
            const size = Math.round(iconW + 26);
            const iconLeft = icon ? icon.getBoundingClientRect().left : box.left;
            Object.assign(bar.style, { width: `${box.width}px`, height: `${box.height}px`, marginInline: "0", left: `${box.left}px`, right: "auto", paddingLeft: `${iconLeft - box.left}px` });
            bar.classList.add("is-folding");
            void bar.offsetWidth; // the start size is laid out before the end size is set
            Object.assign(bar.style, { width: `${size}px`, height: `${size}px`, left: `${iconLeft - (size - iconW) / 2}px`, paddingLeft: `${(size - iconW) / 2}px` });
            await after(bar, "width", 900);
            bar.classList.add("is-gone");
            await after(bar, "transform", 800);
        }
        bar.hidden = true;
        bar.classList.remove("is-in", "is-out", "is-folding", "is-gone", "is-run");
        ["width", "height", "margin-inline", "left", "right", "padding-left"].forEach((p) => bar.style.removeProperty(p));
        if (shown?.bar === bar) shown = null;
    };
    shown = { bar, leave };
    if (mode === "notice") {
        // the line runs out (held still under reduced motion), then the notice goes
        const line = bar.querySelector(".kalq-cookie__line");
        if (!calm && line) line.addEventListener("animationend", leave, { once: true });
        setTimeout(leave, SHOW_MS + 400);
    }
    if (mode === "consent") {
        const choose = (granted) => {
            if (preview) return leave(); // the design panel's preview stores nothing
            write(CHOICE, granted ? "granted" : "denied");
            if (granted) location.reload(); // with the choice, what waited for it loads
            else leave();
        };
        bar.querySelector(".kalq-cookie__accept").onclick = () => choose(true);
        bar.querySelector(".kalq-cookie__deny").onclick = () => choose(false);
    }
}

export function initCookieBar(doc = document) {
    const bar = doc.querySelector(".kalq-cookie");
    const mode = bar?.dataset.mode === "consent" ? "consent" : "notice";
    const choice = read(CHOICE);
    const granted = mode === "consent" && choice === "granted";
    window.kalqConsent = { mode, granted, choice: mode === "consent" ? choice : null };
    if (granted) runOptional(doc);
    if (!bar || bar.dataset.ready) return;
    bar.dataset.ready = "true";
    if (mode === "notice") {
        if (read(SEEN) === "seen") return;
        write(SEEN, "seen");
        show(bar);
    } else if (!choice) show(bar); // asked until Accept or Deny
}

// The design panel: show the bar now in its current mode and text, storing nothing
export function previewCookieBar(doc = document) {
    const bar = doc.querySelector(".kalq-cookie");
    if (!bar) return;
    if (shown) { shown.bar.hidden = true; shown = null; }
    show(bar, { preview: true });
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => initCookieBar());
    else initCookieBar();
}
