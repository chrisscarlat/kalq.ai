// media.scroll-steps: a scroll story. A visual (a video that scrubs with the scroll, or an image), a thin progress
// bar and a list of steps; on wide screens with motion allowed the section pins while the reader scrolls through the
// steps and the active step opens. One unit, meant to be ported as is (see PORT_NOTES.md): the definition, the
// template (render, shared by the server and the browser: no browser globals at the top level) and the behaviour
// (setupScrollSteps, browser only, uses the page's GSAP 3.12.5 ScrollTrigger). Styles: css/components/_scroll-steps.scss.
//
// Rules it keeps: every heading and sentence is in the HTML at load, in reading order (an <ol>, each item an h3 and a
// <p>); collapsing is visual only; one h2. Media only from the site's own storage. No inline script or style in the
// markup. Without JavaScript, under reduced motion and below 768px: the poster once, then every step open.
import { L, append, editorField, el, mediaEl, mediaOf, plain, section, slotEl, hrefOf, textOf } from "./kit.js";

export const STEPS_MIN = 2;
export const STEPS_MAX = 8;
export const STEPS_DEFAULT = 4;
export const UPLOAD_WARN_BYTES = 8 * 1024 * 1024;
const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

// Media from the site's own storage only: a path on the site itself, or the project's storage bucket. Anything else
// (YouTube, Vimeo, a CDN, any other host) is refused. (Port: certil.com sets its own storage rule here.)
const OWN_STORAGE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/site-media\/[^?#]+$/;
export const isOwnMedia = (url) => typeof url === "string" && url !== "" && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url) && !/\.\.\//.test(url)
    || OWN_STORAGE.test(url || "");

// The editor's words (the panel only; everything a visitor reads comes from the editor's fields)
const UI = {
    de: {
        step: (n) => `Schritt ${n}`, add: "Schritt hinzufügen", up: "Nach oben", down: "Nach unten", remove: "Schritt entfernen",
        visibility: "Sichtbarkeit", public: "Öffentlich", private: "Nur privater Bereich",
        refused: "Diese Adresse ist nicht aus dem eigenen Speicher und wird nicht gezeigt. Bitte die Datei hochladen.",
        hint: "Video: MP4 (H.264) und dazu WebM, etwa 1920×1080, ohne Ton, 10 bis 20 Sekunden, unter 8 MB, mit sehr kurzem Keyframe-Abstand (z. B. jedes 5. Bild), damit das Scrollen nicht ruckelt.",
        warn: "Die Datei ist größer als 8 MB. Sie wird hochgeladen, lädt für Besucher aber langsam.",
    },
    en: {
        step: (n) => `Step ${n}`, add: "Add a step", up: "Move up", down: "Move down", remove: "Remove step",
        visibility: "Visibility", public: "Public", private: "Private space only",
        refused: "This address is not from the site's own storage and is not shown. Please upload the file.",
        hint: "Video: MP4 (H.264) plus WebM, about 1920×1080, muted, 10 to 20 seconds, under 8 MB, encoded with very short keyframe intervals (e.g. every 5th frame) so scrubbing doesn't stutter.",
        warn: "The file is larger than 8 MB. It uploads, but loads slowly for visitors.",
    },
};
const ui = (ctx) => UI[ctx.lang === "en" ? "en" : "de"];

export const stepItems = (entry) => (Array.isArray(entry?.opts?.items) ? entry.opts.items.filter((x) => x && /^[a-z0-9]{1,12}$/.test(x.id)).slice(0, STEPS_MAX) : []);
const newId = () => Math.random().toString(36).slice(2, 8);
const stepTime = (ctx, id) => { const n = parseFloat(plain(textOf(ctx, `time_${id}`)).replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
const ownMedia = (ctx, slot) => { const u = mediaOf(ctx, slot); return u && isOwnMedia(u) ? u : null; };

// Editors: a media slot with the upload hint and the size warning (js/edit.js shows them)
function mediaSlot(ctx, slot, cls, hint) {
    const box = mediaEl(ctx, slot, cls);
    const node = box?.querySelector("[data-kalq-key]");
    if (node && hint) { node.setAttribute("data-kalq-upload-hint", ui(ctx).hint); node.setAttribute("data-kalq-upload-warn", String(UPLOAD_WARN_BYTES)); node.setAttribute("data-kalq-upload-warn-text", ui(ctx).warn); }
    const url = mediaOf(ctx, slot);
    if (box && url && !isOwnMedia(url)) box.append(el(ctx, "p", "kalq-ss__refused", ui(ctx).refused));
    return box;
}

function stepTools(ctx, id, n, count) {
    const w = ui(ctx);
    const bar = el(ctx, "div", "kalq-ss__tools");
    const btn = (action, label, text, off) => {
        const b = el(ctx, "button", `kalq-ss__tool is-${action}`, text);
        b.setAttribute("type", "button");
        b.setAttribute("data-items-action", action);
        b.setAttribute("data-items-id", id);
        b.setAttribute("aria-label", label);
        if (off) b.setAttribute("disabled", "");
        return b;
    };
    return append(bar, el(ctx, "span", "kalq-ss__num", w.step(n)), btn("up", w.up, "↑", n === 1), btn("down", w.down, "↓", n === count),
        btn("remove", w.remove, "×", count <= STEPS_MIN));
}

function render(ctx) {
    const items = stepItems(ctx.entry);
    const sid = ctx.id;
    const visual = ownMedia(ctx, "visual");
    const isVideo = !!visual && VIDEO.test(visual);
    const webm = isVideo ? ownMedia(ctx, "visual_webm") : null;
    const poster = ownMedia(ctx, "poster") || (!isVideo ? visual : null);
    const description = plain(textOf(ctx, "description"));
    const s = section(ctx, `kalq-ss ${isVideo ? "has-video" : visual ? "has-image" : "has-none"}`);
    if (!ctx.editor) s.setAttribute("data-scroll-steps", ""); // js/modules/scrollSteps.js setupScrollSteps
    const inner = el(ctx, "div", "kalq-m-inner kalq-ss__inner");

    const head = append(el(ctx, "div", "kalq-ss__head"), slotEl(ctx, "heading", "h2", { className: "kalq-ss__title" }),
        slotEl(ctx, "intro", "p", { className: "kalq-ss__intro" }));

    const progress = el(ctx, "div", "kalq-ss__progress", el(ctx, "span", "kalq-ss__bar"));
    progress.setAttribute("aria-hidden", "true");

    // the steps: an ordered list, each item an h3 (a link to its own anchor: the label, then the heading) and a <p>
    const list = el(ctx, "ol", "kalq-ss__steps");
    items.forEach((item, k) => {
        const anchor = `${sid}-step-${k + 1}`;
        const label = slotEl(ctx, `label_${item.id}`, "span", { className: "kalq-ss__label", label: L(`Schritt ${k + 1}: Etikett`, `Step ${k + 1}: label`) });
        const heading = slotEl(ctx, `heading_${item.id}`, "span", { className: "kalq-ss__heading", label: L(`Schritt ${k + 1}: Überschrift`, `Step ${k + 1}: heading`) });
        const text = slotEl(ctx, `text_${item.id}`, "p", { className: "kalq-ss__text", label: L(`Schritt ${k + 1}: ein oder zwei Sätze`, `Step ${k + 1}: one or two sentences`) });
        if (!ctx.editor && !heading) return; // visitors: a step without its heading is left out
        const li = el(ctx, "li", "kalq-ss__step");
        li.setAttribute("id", anchor);
        const t = stepTime(ctx, item.id);
        if (t != null) li.setAttribute("data-time", String(t));
        if (ctx.editor) li.append(stepTools(ctx, item.id, k + 1, items.length));
        const h3 = el(ctx, "h3", "kalq-ss__step-title");
        if (ctx.editor) append(h3, label, " ", heading);
        else { const a = el(ctx, "a", "kalq-ss__link"); a.setAttribute("href", `#${anchor}`); append(a, label, label ? " " : null, heading); h3.append(a); }
        append(li, h3, text);
        if (ctx.editor) li.append(append(el(ctx, "p", "kalq-ss__time"), slotEl(ctx, `time_${item.id}`, "span", { className: "kalq-ss__time-field", label: L(`Schritt ${k + 1}: Startzeit im Video (Sekunden)`, `Step ${k + 1}: start time in the video (seconds)`) })));
        list.append(li);
    });

    // the closing line and the button (both optional)
    const end = append(el(ctx, "div", "kalq-ss__end"), slotEl(ctx, "closing", "p", { className: "kalq-ss__closing" }));
    if (ctx.editor) end.append(append(el(ctx, "p", "kalq-ss__button-edit"), slotEl(ctx, "button", "span", { className: "kalq-ss__button" }), editorField(ctx, "link")));
    else { const label = textOf(ctx, "button"), href = hrefOf(ctx, "link"); if (label && href) { const a = el(ctx, "a", "kalq-ss__button"); a.setAttribute("href", href); a.append(slotEl(ctx, "button", "span", {})); end.append(a); } }

    // the visual, last in the reading order (placed beside or behind the steps by the stylesheet)
    const figure = el(ctx, "figure", "kalq-ss__visual");
    if (ctx.editor) {
        append(figure, mediaSlot(ctx, "visual", "kalq-ss__media", true), mediaSlot(ctx, "visual_webm", "kalq-ss__media is-webm", true), mediaSlot(ctx, "poster", "kalq-ss__media is-poster"),
            slotEl(ctx, "description", "p", { className: "kalq-ss__description-field" }));
    } else {
        const descId = `${sid}-visual-desc`;
        if (poster) {
            const img = el(ctx, "img", "kalq-ss__poster");
            img.setAttribute("src", poster);
            img.setAttribute("alt", isVideo ? "" : description); // with a video, the description stands beside it as text
            img.setAttribute("loading", "lazy");
            img.setAttribute("decoding", "async");
            figure.append(img);
        }
        if (isVideo) {
            const v = el(ctx, "video", "kalq-ss__video");
            ["muted", "playsinline"].forEach((a) => v.setAttribute(a, ""));
            v.setAttribute("preload", "none"); // the script loads it when it scrubs (wide screens, motion allowed)
            if (poster) v.setAttribute("poster", poster);
            if (description) v.setAttribute("aria-describedby", descId); else v.setAttribute("aria-hidden", "true");
            if (webm) { const so = el(ctx, "source"); so.setAttribute("src", webm); so.setAttribute("type", "video/webm"); v.append(so); }
            const so = el(ctx, "source"); so.setAttribute("src", visual); so.setAttribute("type", "video/mp4"); v.append(so);
            figure.append(v);
            if (description) { const d = el(ctx, "p", "kalq-sr", description); d.setAttribute("id", descId); figure.append(d); }
        }
    }

    if (ctx.editor) {
        const add = el(ctx, "button", "kalq-ss__add", `+ ${ui(ctx).add}`);
        add.setAttribute("type", "button");
        add.setAttribute("data-items-action", "add");
        if (items.length >= STEPS_MAX) add.setAttribute("disabled", "");
        const vis = ctx.entry.opts?.visibility === "private" ? "private" : "public";
        const sw = el(ctx, "button", "kalq-ss__visibility", `${ui(ctx).visibility}: ${vis === "private" ? ui(ctx).private : ui(ctx).public}`);
        sw.setAttribute("type", "button");
        sw.setAttribute("data-items-action", "visibility");
        sw.setAttribute("aria-pressed", String(vis === "private"));
        append(inner, head, progress, list, add, end, figure, sw);
    } else {
        if (!list.children.length) return null;
        append(inner, head, progress, list, end.children.length ? end : null, figure.children.length ? figure : null);
    }
    return append(s, inner);
}

// The book: every step open, the poster (or the image) instead of the video
function unit(s, k) {
    return {
        layout: "A", order: "media-text", title: s.querySelector(".kalq-ss__title"), lead: s.querySelector(".kalq-ss__intro"),
        body: [...[...s.querySelectorAll(".kalq-ss__step")].flatMap((li) => [k.textOf(li.querySelector(".kalq-ss__step-title"), "h3", "bk-subtitle"), ...k.parasOf(li.querySelector(".kalq-ss__text"))]),
            ...k.parasOf(s.querySelector(".kalq-ss__closing"))].filter(Boolean),
        actions: [...s.querySelectorAll("a.kalq-ss__button")],
        media: [s.querySelector(".kalq-ss__poster")?.getAttribute("src") || null],
    };
}

export const SCROLL_STEPS_CATEGORY = { id: "media", de: "Medien und Geschichten", en: "Media and stories", after: "content" };

export const SCROLL_STEPS = {
    "media.scroll-steps": {
        category: "media",
        name: L("Geschichte in Schritten", "Scroll story"),
        keywords: "scroll steps schritte story geschichte video pinned scrub",
        slots: {
            heading: { kind: "heading", label: L("Überschrift des Abschnitts", "Section heading"), required: true },
            intro: { kind: "text", label: L("Einleitungszeile (optional)", "Intro line (optional)") },
            visual: { kind: "media", label: L("Video (MP4) oder Bild", "Video (MP4) or image"), required: true },
            visual_webm: { kind: "media", label: L("Dasselbe Video als WebM (optional)", "The same video as WebM (optional)") },
            poster: { kind: "media", label: L("Standbild (Poster)", "Poster image") },
            description: { kind: "text", label: L("Was das Bild zeigt, in einem Satz", "What the visual shows, in one sentence") },
            closing: { kind: "text", label: L("Schlusszeile (optional)", "Closing line (optional)") },
            button: { kind: "button", label: L("Button-Text (optional)", "Button text (optional)") },
            link: { kind: "link", label: L("Button-Link", "Button link") },
        },
        versions: {
            pinned: { name: L("Angeheftet, Schritte neben dem Bild", "Pinned, steps beside the visual"),
                wire: [["heading", 4, 6, 30], ["line", 4, 13, 26], ["media", 40, 6, 56, 48, "play"], ["rule", 4, 22, 30], ["line", 4, 27, 20, "bold"], ["line", 4, 31, 30], ["line", 4, 35, 26], ["line", 4, 41, 16, "bold"], ["line", 4, 47, 16, "bold"], ["line", 4, 53, 16, "bold"]] },
        },
        initialOpts: () => ({ items: Array.from({ length: STEPS_DEFAULT }, () => ({ id: newId() })), visibility: "public" }),
        // steps can be added, moved and removed in the panel (js/sections.js), each one undo step
        itemsEditor: { min: STEPS_MIN, max: STEPS_MAX, make: () => ({ id: newId() }) },
        missing: (entry, page, get) => {
            const has = (slot) => { const e = get(`${page}.${entry.id}.${slot}`); return e && (e.de || e.en); };
            const media = (slot) => get(`${page}.${entry.id}.${slot}`)?.media;
            const out = [];
            const steps = stepItems(entry).filter((it) => has(`heading_${it.id}`));
            if (steps.length < STEPS_MIN) out.push(L(`mindestens ${STEPS_MIN} Schritte mit Überschrift`, `at least ${STEPS_MIN} steps with a heading`));
            const v = media("visual");
            if (v && !isOwnMedia(v)) out.push(L("ein Video oder Bild aus dem eigenen Speicher", "a video or image from the site's own storage"));
            if (v && VIDEO.test(v) && !media("poster")) out.push(L("ein Standbild (Poster) zum Video", "a poster image for the video"));
            return out;
        },
        magazine: { layout: "A", unit },
        render,
    },
};

//=================================== Behaviour (browser) ===================================//
// Wide screens (768px and up), motion allowed and GSAP's ScrollTrigger on the page: the section pins for a length
// that follows the number of steps; the scroll position picks the active step (it opens, aria-current), fills the
// progress bar and scrubs the video (forward and back with the reader, never playing on its own) through each step's
// start time. Otherwise nothing is pinned or scrubbed: the poster, then every step open.
const PER_STEP = 0.8; // the pinned length per step, in viewport heights
const live = new Set();

export function setupScrollSteps(sec) {
    if (typeof window === "undefined") return;
    for (const other of live) if (!other.isConnected) { other.kalqSteps?.kill(); live.delete(other); } // left the page
    if (sec.kalqSteps) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = { trigger: null, raf: 0 };
    sec.kalqSteps = { kill: () => stop(sec, state) };
    live.add(sec);
    const decide = () => {
        stop(sec, state);
        if (wide.matches && !still.matches && window.gsap && window.ScrollTrigger) start(sec, state);
    };
    wide.addEventListener("change", decide);
    still.addEventListener("change", decide);
    links(sec, state);
    decide();
}

const scroller = () => { const c = document.querySelector(".scrollbar-container"); return c && window.Scrollbar ? window.Scrollbar.get(c) : null; };
const scrollToY = (y) => { const sb = scroller(); if (sb) sb.scrollTo(0, y, 700); else window.scrollTo({ top: y, behavior: "smooth" }); };

function start(sec, state) {
    const steps = [...sec.querySelectorAll(".kalq-ss__step")];
    const n = steps.length;
    if (n < 1) return;
    const inner = sec.querySelector(".kalq-ss__inner");
    const video = sec.querySelector(".kalq-ss__video");
    const bar = sec.querySelector(".kalq-ss__bar");
    sec.classList.add("is-pinned");
    if (video) { sec.classList.add("is-scrub"); video.preload = "auto"; video.muted = true; video.pause(); video.load(); }
    let shown = 0, progress = 0;
    const times = () => {
        const d = video && Number.isFinite(video.duration) ? video.duration : 0;
        const own = steps.map((li) => parseFloat(li.dataset.time));
        // the editor's start times where they make sense (rising, within the video); else evenly through it
        const ok = own.every((t, i) => Number.isFinite(t) && t <= d && (i === 0 || t > own[i - 1]));
        return { d, at: ok ? own : steps.map((_, i) => (d * i) / n) };
    };
    const setActive = (i) => steps.forEach((li, k) => {
        li.classList.toggle("is-active", k === i);
        const a = li.querySelector(".kalq-ss__link");
        if (k === i) a?.setAttribute("aria-current", "step"); else a?.removeAttribute("aria-current");
    });
    state.trigger = window.ScrollTrigger.create({
        trigger: sec,
        pin: inner,
        pinType: scroller() ? "transform" : "fixed",
        start: "top top",
        end: () => `+=${Math.round(n * PER_STEP * window.innerHeight)}`,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
            const p = self.progress;
            const i = Math.min(n - 1, Math.floor(p * n));
            setActive(i);
            if (bar) bar.style.transform = `scaleX(${p})`;
            progress = p;
        },
    });
    setActive(0);
    // where the video should be for a scroll position: through each step's start time, the last step to the end
    const targetAt = (p) => {
        const { d, at } = times();
        if (!d) return 0;
        const i = Math.min(n - 1, Math.floor(p * n));
        const to = i + 1 < n ? at[i + 1] : d;
        return Math.min(d - 0.05, at[i] + (p * n - i) * (to - at[i]));
    };
    // the video follows smoothly, frame by frame (it is never played); from the last scroll position, so it also
    // finds its place once the video has loaded
    const tick = () => {
        const target = video && video.readyState >= 1 ? targetAt(progress) : 0;
        if (video && video.readyState >= 1 && !video.seeking && Math.abs(target - shown) > 0.01) { // one seek at a time
            shown += (target - shown) * 0.3;
            video.currentTime = shown;
        }
        state.raf = requestAnimationFrame(tick);
    };
    if (video) state.raf = requestAnimationFrame(tick);
    window.ScrollTrigger.refresh();
}

function stop(sec, state) {
    state.trigger?.kill(true);
    state.trigger = null;
    cancelAnimationFrame(state.raf);
    sec.classList.remove("is-pinned", "is-scrub");
    sec.querySelectorAll(".kalq-ss__step").forEach((li) => li.classList.remove("is-active"));
    sec.querySelectorAll(".kalq-ss__link[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    const bar = sec.querySelector(".kalq-ss__bar");
    if (bar) bar.style.removeProperty("transform");
}

// Each step's link goes to that step: pinned, to its place in the scroll; otherwise to the step in the list. A step
// reached with Tab is brought into place as well, so the open step is the focused one.
function links(sec, state) {
    const go = (li) => {
        const steps = [...sec.querySelectorAll(".kalq-ss__step")];
        const i = steps.indexOf(li);
        const st = state.trigger;
        if (st && i >= 0) scrollToY(st.start + ((i + 0.5) / steps.length) * (st.end - st.start));
        else { const sb = scroller(); if (sb) sb.scrollIntoView(li, { offsetTop: 80 }); else li.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
    sec.addEventListener("click", (e) => {
        const a = e.target.closest(".kalq-ss__link");
        if (!a) return;
        e.preventDefault();
        go(a.closest(".kalq-ss__step"));
        history.replaceState(null, "", a.getAttribute("href"));
    });
    sec.addEventListener("focusin", (e) => { const a = e.target.closest(".kalq-ss__link"); if (a && state.trigger && a.matches(":focus-visible")) go(a.closest(".kalq-ss__step")); });
}
