// Module library for the page builder. Shared by the server render (lib/render-page.js, on a linkedom document) and
// the browser (insert, edit, live changes), so no browser globals at the top level.
//
// A module has versions; all versions of a module share its slots, so switching version never loses content.
// Every slot is a block "<page>.<sectionId>.<slot>" (text per language, or one image/video for both).
// A placeholder is a slot without any revision: editors see a labelled empty block, the public page never gets it.
// Placeholder labels name the kind of content ("Frage", "Antwort"); they never invent claims, numbers or quotes.
import { LIBRARY, LIBRARY_CATEGORIES } from "./library.js";
import { SCROLL_STEPS, SCROLL_STEPS_CATEGORY } from "./scrollSteps.js";
import { L, append, buttonEl, linkButton, mediaEl, mediaOf, plain, rangeEl, rangeOf, section, slotEl, hrefOf, textOf } from "./kit.js";

const BASE_CATEGORIES = [
    { id: "heroes", de: "Heroes", en: "Heroes", note: { de: "Ein Hero ersetzt den Hero oben auf der Seite: jede Seite hat genau einen.", en: "A hero replaces the hero at the top of the page: every page has exactly one." } },
    { id: "navigation", de: "Navigation", en: "Navigation", note: { de: "Die Navigation wird im Stil gewählt (Stile: Menü), für alle Seiten.", en: "The navigation is chosen in the style (Styles: menu), for every page." } },
    { id: "logos", de: "Logos", en: "Logos" },
    { id: "content", de: "Inhalt", en: "Content" },
    { id: "cards", de: "Karten", en: "Cards" },
    { id: "cta", de: "Handlungsaufrufe", en: "Calls to action" },
    { id: "interaction", de: "Kontakt und Anfrage", en: "Contact and inquiry" },
    { id: "faq", de: "FAQ", en: "FAQs" },
    { id: "footers", de: "Footer", en: "Footers", note: { de: "Der Footer wird im Stil gewählt (Stile: Footer), für die ganze Website.", en: "The footer is chosen in the style (Styles: footer), for the whole site." } },
];
// the library's categories, each after its anchor
export const CATEGORIES = BASE_CATEGORIES.flatMap((c) => [c, ...[...LIBRARY_CATEGORIES, SCROLL_STEPS_CATEGORY].filter((x) => x.after === c.id)]);

// Slot kinds: heading (h2), eyebrow, text (paragraphs), button (label) + link (address), media (image or video),
// range (a number setting with a slider in edit mode), alt (a picture's description, its alt text)
// magazine: how the module reads as a spread in the magazine (js/book/layouts.js), like its versions for the page:
//   layout A (picture | text, order per version), C (picture across), F (questions | answer); media: which slot is the
//   spread's picture
const FAQ_ITEMS = 6;
const LOGOS = 12;

export const MODULES = {
    "content.split": {
        category: "content",
        name: L("Bild und Text nebeneinander", "Image and text side by side"),
        keywords: "split image text bild text zwei spalten two columns",
        slots: {
            eyebrow: { kind: "eyebrow", label: L("Kleine Überschrift", "Eyebrow") },
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            text: { kind: "text", label: L("Text", "Text"), required: true },
            button: { kind: "button", label: L("Button-Text", "Button label") },
            link: { kind: "link", label: L("Button-Link (z. B. platform.html)", "Button link (e.g. platform.html)") },
            media: { kind: "media", label: L("Bild oder Video", "Image or video"), required: true },
        },
        versions: {
            "image-left": { name: L("Bild links, Text rechts", "Image left, text right"),
                wire: [["media", 4, 6, 44, 48], ["eyebrow", 54, 16, 14], ["heading", 54, 22, 36], ["heading", 54, 28, 26], ["line", 54, 36, 38], ["line", 54, 40, 34], ["line", 54, 44, 30], ["button", 54, 50, 14]] },
            "text-left": { name: L("Text links, Bild rechts", "Text left, image right"),
                wire: [["eyebrow", 4, 16, 14], ["heading", 4, 22, 36], ["heading", 4, 28, 26], ["line", 4, 36, 38], ["line", 4, 40, 34], ["line", 4, 44, 30], ["button", 4, 50, 14], ["media", 52, 6, 44, 48]] },
        },
        magazine: { layout: "A", order: { "image-left": "media-text", "text-left": "text-media" } },
        render: renderSplit,
    },
    "content.media-center": {
        category: "content",
        name: L("Bild oder Video in der Mitte", "Central image or video"),
        keywords: "central centre center image video bild video mitte",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading") },
            media: { kind: "media", label: L("Bild oder Video", "Image or video"), required: true },
            caption: { kind: "text", label: L("Bildunterschrift", "Caption") },
        },
        versions: {
            image: { name: L("Zentrales Bild", "Central image"),
                wire: [["heading", 30, 6, 40], ["media", 10, 13, 80, 36], ["line", 30, 53, 40]] },
            video: { name: L("Zentrales Video", "Central video"),
                wire: [["heading", 30, 6, 40], ["media", 4, 13, 92, 36, "play"], ["line", 30, 53, 40]] },
        },
        magazine: { layout: "C" },
        render: renderMediaCenter,
    },
    "cta.band": {
        category: "cta",
        name: L("Aufruf-Band", "Call to action band"),
        keywords: "call to action cta band banner aufruf button",
        slots: {
            heading: { kind: "heading", label: L("Aufruf", "Call to action"), required: true },
            text: { kind: "text", label: L("Text", "Text") },
            button: { kind: "button", label: L("Button-Text", "Button label"), required: true },
            link: { kind: "link", label: L("Button-Link", "Button link"), required: true },
            media2: { kind: "media", label: L("Bild für zwei Bildschirme (optional)", "Picture for two screens (optional)") },
        },
        versions: {
            centered: { name: L("Zentriert", "Centred"),
                wire: [["band", 0, 8, 100, 44], ["heading", 22, 20, 56, "light"], ["heading", 30, 27, 40, "light"], ["line", 32, 36, 36, "light"], ["button", 43, 43, 14, "light"]] },
            split: { name: L("Text links, Button rechts", "Text left, button right"),
                wire: [["band", 0, 14, 100, 32], ["heading", 6, 23, 50, "light"], ["line", 6, 31, 40, "light"], ["button", 78, 26, 16, "light"]] },
        },
        magazine: { layout: "A", order: "text-media", media: "media2" }, // the text facing its picture for two screens
        render: renderCtaBand,
    },
    "logos.belt": {
        category: "logos",
        name: L("Logo-Laufband", "Logo belt"),
        keywords: "logos partner kunden clients belt ticker band laufband",
        slots: {
            label: { kind: "eyebrow", label: L("Kleine Überschrift über der Reihe", "Small label above the row") },
            ...Object.fromEntries(Array.from({ length: LOGOS }, (_, i) => [
                [`logo${i + 1}`, { kind: "media", label: L(`Logo ${i + 1}`, `Logo ${i + 1}`), required: i === 0 }],
                [`name${i + 1}`, { kind: "text", label: L(`Firmenname ${i + 1} (auch der Alternativtext)`, `Company name ${i + 1} (also the alt text)`), required: i === 0 }],
                [`link${i + 1}`, { kind: "link", label: L(`Link ${i + 1} (optional)`, `Link ${i + 1} (optional)`) }],
            ]).flat()),
        },
        versions: {
            original: { name: L("Logos in Originalfarben", "Logos in their own colours"),
                wire: [["eyebrow", 40, 18, 20], ...[6, 24, 42, 60, 78].map((x) => ["band", x, 28, 14, 8])] },
            mono: { name: L("Logos einfarbig (folgt Hell/Dunkel)", "Logos in one tone (follows light/dark)"),
                wire: [["eyebrow", 40, 18, 20], ...[6, 24, 42, 60, 78].map((x) => ["rule", x, 32, 14])] },
        },
        magazine: { layout: "L" },
        render: renderBelt,
    },
    "hero.harbor": {
        category: "heroes",
        name: L("Hero", "Hero"),
        keywords: "hero header titel title start bild video glas glass",
        slots: {
            heading: { kind: "heading", label: L("Titel der Seite (die eine Überschrift h1)", "The page's title (its one h1)"), required: true },
            words: { kind: "text", label: L("Wechselndes Wort (optional): das erste steht im Titel, weitere je eine Zeile", "Rotating word (optional): the first is in the title, others one per line") },
            media: { kind: "media", label: L("Hintergrund: Bild oder Video (optional)", "Background: image or video (optional)") },
            shade: { kind: "range", label: L("Abdunkelung über Bild oder Video", "Darkening over the image or video"), min: 0, max: 100, step: 5, initial: 60, unit: "%" },
            button: { kind: "button", label: L("Button-Text", "Button label") },
            link: { kind: "link", label: L("Button-Link", "Button link") },
            button2: { kind: "button", label: L("Zweiter Button (optional)", "Second button (optional)") },
            link2: { kind: "link", label: L("Zweiter Button-Link", "Second button link") },
            glass_media: { kind: "media", label: L("Glas-Karte: Bild (optional)", "Glass card: image (optional)") },
            glass_text: { kind: "text", label: L("Glas-Karte: eine Zeile", "Glass card: one line") },
            glass_button: { kind: "button", label: L("Glas-Karte: Button-Text", "Glass card: button label") },
            glass_link: { kind: "link", label: L("Glas-Karte: Button-Link", "Glass card: button link") },
            caption1: { kind: "text", label: L("Unten links (optional)", "Bottom left (optional)") },
            caption2: { kind: "text", label: L("Unten Mitte (optional)", "Bottom centre (optional)") },
            caption3: { kind: "text", label: L("Unten rechts (optional)", "Bottom right (optional)") },
        },
        versions: {
            fit: { name: L("Titel füllt die Breite", "Title fills the width"),
                wire: [["band", 0, 0, 100, 60], ["heading", 4, 36, 92, "light"], ["heading", 4, 42, 92, "light"], ["button", 4, 50, 16, "light"], ["line", 70, 55, 24, "light"]] },
            standard: { name: L("Titel in großer Schrift", "Title in large type"),
                wire: [["band", 0, 0, 100, 60], ["heading", 4, 40, 56, "light"], ["line", 4, 46, 40, "light"], ["button", 4, 51, 16, "light"], ["media", 70, 30, 24, 22]] },
        },
        magazine: { layout: "opener", cover: true },
        render: renderHero,
    },
    "faq.single": {
        category: "faq",
        name: L("Fragen und Antworten", "Questions and answers"),
        keywords: "faq questions answers fragen antworten accordion akkordeon",
        slots: {
            heading: { kind: "heading", label: L("Überschrift", "Heading"), required: true },
            ...Object.fromEntries(Array.from({ length: FAQ_ITEMS }, (_, i) => [
                [`q${i + 1}`, { kind: "question", label: L(`Frage ${i + 1}`, `Question ${i + 1}`), required: i === 0 }],
                [`a${i + 1}`, { kind: "answer", label: L(`Antwort ${i + 1}`, `Answer ${i + 1}`), required: i === 0 }],
            ]).flat()),
        },
        versions: {
            single: { name: L("Eine Spalte, aufklappbar", "One column, expandable"),
                wire: [["heading", 30, 6, 40], ...[16, 26, 36, 46].flatMap((y) => [["line", 18, y, 56, "bold"], ["plus", 80, y], ["rule", 18, y + 5, 66]])] },
            split: { name: L("Überschrift links, Fragen rechts", "Heading left, questions right"),
                wire: [["heading", 4, 10, 28], ["heading", 4, 16, 20], ...[10, 20, 30, 40].flatMap((y) => [["line", 42, y, 44, "bold"], ["plus", 92, y], ["rule", 42, y + 5, 54]])] },
        },
        magazine: { layout: "F" },
        render: renderFaq,
    },
};

Object.assign(MODULES, LIBRARY); // batch 2 (js/modules/library.js)
Object.assign(MODULES, SCROLL_STEPS); // media.scroll-steps (js/modules/scrollSteps.js)

export const moduleVersion = (module, version) => MODULES[module]?.versions[version] ? MODULES[module].versions[version] : null;

//=================================== Rendering ===================================//
function renderSplit(ctx) {
    const s = section(ctx, `kalq-m-split is-${ctx.entry.version === "text-left" ? "text-left" : "image-left"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const text = ctx.doc.createElement("div");
    text.className = "kalq-m-split__text";
    append(text, slotEl(ctx, "eyebrow", "p", { className: "kalq-m-eyebrow" }), slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }),
        slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }), buttonEl(ctx));
    append(inner, mediaEl(ctx, "media", "kalq-m-split__media"), text);
    return append(s, inner);
}

function renderMediaCenter(ctx) {
    const s = section(ctx, `kalq-m-center is-${ctx.entry.version === "video" ? "video" : "image"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const figure = ctx.doc.createElement("figure");
    figure.className = "kalq-m-center__figure";
    append(figure, mediaEl(ctx, "media", "kalq-m-center__media"));
    const caption = slotEl(ctx, "caption", "figcaption", { className: "kalq-m-caption" });
    if (caption) figure.append(caption);
    append(inner, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }), figure);
    return append(s, inner);
}

function renderCtaBand(ctx) {
    const s = section(ctx, `kalq-m-cta is-${ctx.entry.version === "split" ? "split" : "centered"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const text = ctx.doc.createElement("div");
    text.className = "kalq-m-cta__text";
    append(text, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }), slotEl(ctx, "text", "div", { className: "kalq-m-text", format: "paragraphs" }));
    append(inner, text, buttonEl(ctx, "kalq-m-button is-light"), screen2(ctx));
    return append(s, inner);
}

// The right screen on a two-screen device: the optional picture for two screens; without one, the server (and the
// browser after an edit) put in the page's first video, else its first image, else the panel stays calm in the band's
// colour. Hidden everywhere else; editors see it to set the picture.
function screen2(ctx) {
    const box = ctx.doc.createElement("div");
    box.className = "kalq-m-cta__screen2";
    box.setAttribute("aria-hidden", "true");
    const own = mediaEl(ctx, "media2", "kalq-m-cta__screen2-media");
    if (own) box.append(own);
    if (!mediaOf(ctx, "media2")) box.setAttribute("data-auto", "");
    return box;
}

// The page's first video, else its first image, outside call-to-action bands (for their right screen)
export function firstPageMedia(container) {
    const outside = (n) => !n.closest(".kalq-m-cta, .kalq-picker, .kalq-device");
    const video = [...container.querySelectorAll("video")].find((v) => outside(v) && (v.getAttribute("src") || v.querySelector("source")?.getAttribute("src")));
    if (video) return { kind: "video", src: video.getAttribute("src") || video.querySelector("source").getAttribute("src") };
    const img = [...container.querySelectorAll("img[src]")].find((i) => outside(i) && !/\.svg(\?|$)/i.test(i.getAttribute("src")));
    return img ? { kind: "img", src: img.getAttribute("src") } : null;
}

// Fill the call-to-action panels that have no picture of their own; decorative, loaded only when shown
export function fillScreen2(container, doc) {
    const media = firstPageMedia(container);
    container.querySelectorAll(".kalq-m-cta__screen2[data-auto]").forEach((box) => {
        if (box.querySelector(".kalq-auto") || !media) return;
        const el = doc.createElement(media.kind === "video" ? "video" : "img");
        el.className = "kalq-auto";
        el.setAttribute("src", media.src);
        el.setAttribute("aria-hidden", "true");
        if (media.kind === "video") ["muted", "loop", "playsinline"].forEach((a) => el.setAttribute(a, "")), el.setAttribute("preload", "none");
        else el.setAttribute("alt", ""), el.setAttribute("loading", "lazy");
        box.append(el);
    });
}

// Logo belt: one row of logos drifting slowly to the left, seamless (a second, hidden copy follows the first), the
// edges fading out. Each logo is an image named by its company (the alt text), a link when it has one. A logo shows
// only with both its image and its name. Pauses on hover, on focus and with its button; still when off screen and
// under reduced motion (a centred row that wraps). Editors see every slot, still.
function renderBelt(ctx) {
    const s = section(ctx, `kalq-m-belt is-${ctx.entry.version === "mono" ? "mono" : "original"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    append(inner, slotEl(ctx, "label", "p", { className: "kalq-m-eyebrow kalq-m-belt__label" }));
    const list = ctx.doc.createElement("ul");
    list.className = "kalq-m-belt__list";
    let empty = 0;
    for (let i = 1; i <= LOGOS; i++) {
        const url = mediaOf(ctx, `logo${i}`), name = plain(textOf(ctx, `name${i}`));
        const li = ctx.doc.createElement("li");
        li.className = "kalq-m-belt__item";
        if (ctx.editor) {
            if (!url && !name && ++empty > 2) continue; // the filled ones and two empty ones to fill next
            append(li, mediaEl(ctx, `logo${i}`, "kalq-m-belt__logo"), slotEl(ctx, `name${i}`, "span", { className: "kalq-m-belt__name" }),
                slotEl(ctx, `link${i}`, "span", { className: "kalq-m-link-field" }));
            list.append(li);
            continue;
        }
        if (!url || !name) continue;
        const img = ctx.doc.createElement("img");
        img.setAttribute("src", url);
        img.setAttribute("alt", name);
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        const href = hrefOf(ctx, `link${i}`);
        if (href) { const a = ctx.doc.createElement("a"); a.setAttribute("href", href); a.append(img); li.append(a); } else li.append(img);
        list.append(li);
    }
    if (!list.children.length) return ctx.editor ? append(s, append(inner, list)) : null;
    const viewport = ctx.doc.createElement("div");
    viewport.className = "kalq-m-belt__viewport";
    const track = ctx.doc.createElement("div");
    track.className = "kalq-m-belt__track";
    track.append(list);
    if (!ctx.editor) {
        // the copy that makes the loop seamless: a picture of the first, out of reach
        const copy = list.cloneNode(true);
        copy.classList.add("is-copy");
        copy.setAttribute("aria-hidden", "true");
        copy.setAttribute("inert", "");
        copy.querySelectorAll("img").forEach((img) => img.setAttribute("alt", ""));
        copy.querySelectorAll("a").forEach((a) => a.setAttribute("tabindex", "-1"));
        track.append(copy);
        const pause = ctx.doc.createElement("button");
        pause.setAttribute("type", "button");
        pause.className = "kalq-m-belt__pause";
        pause.setAttribute("aria-pressed", "false");
        pause.setAttribute("aria-label", ctx.lang === "en" ? "Pause the logos" : "Laufband anhalten");
        pause.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
        viewport.append(track);
        append(inner, viewport, pause);
    } else append(inner, append(viewport, track));
    return append(s, inner);
}

// Hero: the page's one h1, at least a screen tall, its content at the foot. Behind: an image, a video (muted, looping,
// with a pause control) or the section's colour, with a soft shade for legibility. Options by content: a rotating
// word (the first word stays in the h1, the others are listed there as hidden text), a glass card (image, a line, a
// button), a row of up to three captions with a link to the next section, up to two buttons (the first the round
// arrow button). The title rises in word by word (js/moduleBehaviour.js); everything is still under reduced motion.
function renderHero(ctx) {
    const fit = ctx.entry.version === "fit";
    const s = section(ctx, `kalq-m-hero is-${fit ? "fit" : "standard"}`);
    const media = mediaEl(ctx, "media", "kalq-m-hero__media");
    if (media) {
        media.setAttribute("aria-hidden", "true");
        const shade = ctx.doc.createElement("div");
        shade.className = "kalq-m-hero__shade";
        shade.setAttribute("aria-hidden", "true");
        shade.setAttribute("style", `opacity: ${rangeOf(ctx, "shade") / 100}`);
        append(s, media, shade);
        s.classList.add("has-media");
    }
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner kalq-m-hero__content";
    // the h1: the sentence (its own block, edited in place) and, after it, the rotating word's others as hidden text
    const sentence = slotEl(ctx, "heading", "span", { className: "kalq-m-hero__sentence" });
    const title = sentence ? append(Object.assign(ctx.doc.createElement("h1"), { className: "kalq-m-hero__title" }), sentence) : null;
    // one short title across the width: its size follows its length (css: --chars)
    if (title && fit) title.setAttribute("style", `--chars: ${Math.max(4, Math.min(40, plain(textOf(ctx, "heading")).length || 10))}`);
    const words = plain(textOf(ctx, "words")).split(/\n|<br>|,/).map((w) => w.trim()).filter(Boolean);
    if (title && words.length > 1 && !ctx.editor) {
        // the first word is in the title; the others named once, for machines, as hidden text (js turns them)
        title.setAttribute("data-rotate", JSON.stringify(words.slice(0, 8)));
        const alts = ctx.doc.createElement("span");
        alts.className = "kalq-sr kalq-m-hero__alts";
        alts.textContent = ` (${words.slice(1, 8).join(", ")})`;
        title.append(alts);
    }
    const actions = ctx.doc.createElement("div");
    actions.className = "kalq-m-hero__actions";
    append(actions, linkButton(ctx, "button", "link", "kalq-btn-round"), linkButton(ctx, "button2", "link2", "kalq-m-hero__button2"));
    append(inner, title, ctx.editor ? slotEl(ctx, "words", "p", { className: "kalq-m-hero__words-field" }) : null, actions.children.length ? actions : null,
        ctx.editor && media ? rangeEl(ctx, "shade", ".kalq-m-hero__shade") : null);
    // the glass card
    const glassMedia = mediaEl(ctx, "glass_media", "kalq-m-hero__glass-media");
    const glassText = slotEl(ctx, "glass_text", "p", { className: "kalq-m-hero__glass-text" });
    const glassButton = linkButton(ctx, "glass_button", "glass_link", "kalq-m-hero__glass-button");
    if (glassMedia || glassText || glassButton) {
        const glass = ctx.doc.createElement("aside");
        glass.className = "kalq-m-hero__glass";
        if (glassMedia) glassMedia.querySelector("img")?.setAttribute("alt", plain(textOf(ctx, "glass_text")) || "");
        append(glass, glassMedia, append(ctx.doc.createElement("div"), glassText, glassButton));
        inner.append(glass);
    }
    // the bottom row: captions and the way to the next section (its href set by js/layout.js)
    const row = ctx.doc.createElement("div");
    row.className = "kalq-m-hero__row";
    [1, 2, 3].forEach((n) => append(row, slotEl(ctx, `caption${n}`, "p", { className: `kalq-m-hero__caption is-${n}` })));
    const next = ctx.doc.createElement("a");
    next.className = "kalq-m-hero__next";
    next.setAttribute("href", "#main");
    next.setAttribute("data-next-section", "");
    next.setAttribute("aria-label", ctx.lang === "en" ? "To the next section" : "Zum nächsten Abschnitt");
    next.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    row.append(next);
    // the pause control, when something moves on its own (a video, a rotating word)
    if (!ctx.editor && (s.querySelector("video") || (title && title.hasAttribute("data-rotate")))) {
        const pause = ctx.doc.createElement("button");
        pause.setAttribute("type", "button");
        pause.className = "kalq-m-hero__pause";
        pause.setAttribute("aria-pressed", "false");
        pause.setAttribute("aria-label", ctx.lang === "en" ? "Pause the motion" : "Bewegung anhalten");
        pause.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
        row.append(pause);
    }
    inner.append(row);
    return append(s, inner);
}

// Real headings and buttons: each question is a <button> that opens its answer (works as plain text without JS:
// the answers are in the HTML and only hidden once the script runs)
function renderFaq(ctx) {
    const s = section(ctx, `kalq-m-faq is-${ctx.entry.version === "split" ? "split" : "single"}`);
    const inner = ctx.doc.createElement("div");
    inner.className = "kalq-m-inner";
    const head = ctx.doc.createElement("div");
    head.className = "kalq-m-faq__head";
    append(head, slotEl(ctx, "heading", "h2", { className: "kalq-m-heading" }));
    const list = ctx.doc.createElement("div");
    list.className = "kalq-m-faq__list";
    for (let i = 1; i <= FAQ_ITEMS; i++) {
        const q = slotEl(ctx, `q${i}`, "span", { className: "kalq-m-faq__q" });
        const a = slotEl(ctx, `a${i}`, "div", { className: "kalq-m-faq__a", format: "paragraphs" });
        if (!q || (!a && !ctx.editor)) continue;
        const item = ctx.doc.createElement("div");
        item.className = "kalq-m-faq__item";
        const h = ctx.doc.createElement("h3");
        h.className = "kalq-m-faq__title";
        if (ctx.editor) h.append(q); // editors edit the question text in place
        else {
            // visitors: the question is a button that opens its answer (js/moduleBehaviour.js); without the script the
            // answers simply stay open
            const b = ctx.doc.createElement("button");
            b.type = "button";
            b.className = "kalq-m-faq__toggle";
            b.setAttribute("aria-expanded", "true");
            b.setAttribute("aria-controls", `${ctx.id}-a${i}`);
            b.append(q);
            h.append(b);
            a.setAttribute("id", `${ctx.id}-a${i}`);
        }
        item.append(h);
        if (a) item.append(a);
        list.append(item);
    }
    append(inner, head, list);
    // FAQPage structured data, for the questions visibly on this page (visitors' page only; drafts never reach it)
    if (!ctx.editor && list.children.length) {
        const ld = ctx.doc.createElement("script");
        ld.setAttribute("type", "application/ld+json");
        ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage",
            mainEntity: [...list.querySelectorAll(".kalq-m-faq__item")].map((it) => ({ "@type": "Question", name: it.querySelector(".kalq-m-faq__q").textContent.trim(),
                acceptedAnswer: { "@type": "Answer", text: it.querySelector(".kalq-m-faq__a")?.textContent.replace(/\s+/g, " ").trim() || "" } })) }).replace(/</g, "\\u003c");
        inner.append(ld);
    }
    return append(s, inner);
}

// The entry point used by js/layout.js: an element for a registry module, or null for an unknown one
// A module this code does not know (added by a newer version of the site): visitors never see it, editors get a stub
// so they can still move or remove it. Its stored entry and blocks stay untouched either way.
export function renderModule(entry, ctx) {
    const def = MODULES[entry.module];
    if (def?.versions[entry.version]) return def.render({ ...ctx, entry, def, id: entry.id });
    if (!ctx.editor) return null;
    const stub = ctx.doc.createElement("section");
    stub.className = "kalq-m-unknown";
    stub.setAttribute("data-module", `${entry.module}:${entry.version || ""}`);
    const note = ctx.doc.createElement("p");
    note.textContent = `Unknown module: ${entry.module} (${entry.version || "–"}), not shown on the page`; // editors only: in English
    stub.append(note);
    return stub;
}

// Required slots that are still placeholders (a section with any cannot go live)
export function missingRequired(entry, page, store) {
    const def = MODULES[entry.module];
    if (!def) return [];
    return [...Object.entries(def.slots).filter(([slot, s]) => {
        if (!s.required) return false;
        const e = store(`${page}.${entry.id}.${slot}`);
        return !e || (s.kind === "media" ? !e.media : e.de == null && e.en == null);
    }).map(([slot, s]) => s.label), ...(def.missing ? def.missing(entry, page, store) : [])]; // the module's own checks (e.g. the chat's questions)
}
