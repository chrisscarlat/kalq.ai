// Styles panel (admins only): create and edit style variants. Colours with pickers and hex fields, fonts (built-in,
// Google Fonts or an uploaded woff2), logo as SVG file or pasted code (sanitised, previewed on dark and light),
// hero video and per-image replacements uploaded to Supabase Storage. Draft or published, one default, every save
// is a version that can be restored. The settings are in tabs, each with a small title saying what it controls:
// Images, Logos, Menu, Navigation, Notifications (the cookie bar: site-wide blocks, saved on their own), Colours and
// fonts.
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { EDITOR_LANG } from "./i18n.js";
import { progressLine, showDone, uploadMedia } from "./upload.js";
import { applyVariant, endPreview, getActive, loadVariants, logoNode } from "./variants.js";
import { setLocalContent, storedEntry } from "./content.js";
import { COOKIE_KEYS, applyCookieSettings, previewCookieBar } from "./cookieBar.js";
import { cookiePreview, footerPreview, menuPreview } from "./stylePreview.js";

const TEXT = {
    de: {
        title: "Stile", open: "Stile (S)", create: "Neue Variante", letter: "Buchstabe", name: "Name", status: "Status",
        draft: "Entwurf", published: "Veröffentlicht", isDefault: "Standard", logo: "Logo", logoFile: "SVG-Datei", logoCode: "oder SVG-Code einfügen",
        logoStripped: "Unsichere Teile wurden entfernt.", logoInvalid: "Kein gültiges SVG.", colors: "Farben",
        c_bg: "Hintergrund", c_text: "Text", c_accent: "Akzent", c_light: "Hell", c_dark: "Dunkel",
        fonts: "Schriften", heading: "Hauptschrift: Logo, H1 bis H3", body: "Zweitschrift: Unterzeilen, H4, H5, Text", builtIn: "Clash Grotesk (Standard)", google: "Google Fonts", upload: "Eigene woff2",
        family: "Schriftname", fontFile: "woff2-Datei", hero: "Hero-Video", images: "Bilder", imagesHint: "Leer lassen für das Standardbild.",
        upload: "Hochladen", clear: "Entfernen", duplicate: "Duplizieren", copyOf: (n) => `${n} (Kopie)`, inherited: "Standard",
        builtInLogo: "Standard: Kalq-Logo", effects: "Effekte", reveal: "Flüssige Enthüllung (folgt der Maus)", revealOff: "Aus", revealHero: "Nur Hero", revealAll: "Hero und Bilder", menu: "Menü", menuDropdown: "Dropdown", menuPanels: "Panels", menuMinimal: "Leiste mit Button", menuPlain: "Leiste", menuMega: "Mega-Menü", menuOverlay: "Vollbild",
        footer: "Footer", footerClassic: "Klassisch", footerHarbor: "Kontakt und Links", footerWordmark: "Großer Schriftzug", footerGradient: "Bewegter Verlauf",
        heroMark: "Mitte im Hero (Start)", heroMarkLogo: "Logo", heroMarkLine: "Linie", heroLine: "Form der Linie",
        lines: { back: "Diagonal \\", forward: "Diagonal /", vertical: "Senkrecht", horizontal: "Waagerecht", circle: "Kreis" }, loadFailed: "Die Stile konnten nicht geladen werden.",
        sitemap: "Seiten", replaceSlot: "Ersetzen", uploading: "Wird hochgeladen", spreadImages: "Auf alle Bildplätze übertragen", spreadHero: "Als Hero auf allen Seiten",
        spreadDone: (n) => `Auf ${n} Plätze übertragen.`, addMedia: "+ Bild oder Video", resetSlot: "Zurück zum Standard",
        fillAll: "Alles füllen", fillHint: "Ein Video wird überall zum Hero, ein Bild füllt jeden Bildplatz. Danach einzeln ersetzbar.",
        filledHero: (n) => `Video ist jetzt Hero auf ${n} Seiten.`, filledImages: (n) => `Bild in ${n} Bildplätzen.`,
        peek: "Seite ansehen", unsaved: "Nicht gespeichert",
        pages: { home: "Start", platform: "Plattform", company: "Unternehmen", impressum: "Impressum", datenschutz: "Datenschutz" }, preview: "Vorschau", endPreview: "Vorschau beenden", save: "Speichern", remove: "Löschen",
        history: "Versionen", restore: "Wiederherstellen", saved: "Gespeichert", failed: "Speichern fehlgeschlagen", confirmDelete: "Diese Variante löschen? Sie bleibt in den Versionen.",
        tabs: { images: "Bilder", logos: "Logos", menu: "Menü", navigation: "Navigation", notifications: "Benachrichtigungen", look: "Farben und Schrift" },
        tabTitles: { images: "Hero-Video, die Bildplätze aller Seiten und die Enthüllung über den Bildern", logos: "Das Logo der Variante und was in der Mitte des Heros steht",
            menu: "Wie das Hauptmenü aussieht und sich öffnet", navigation: "Der Footer: Kontakt, Links und Schriftzug am Ende jeder Seite",
            notifications: "Der Cookie-Hinweis unten auf jeder Seite. Gilt für die ganze Website, in jeder Variante gleich.", look: "Die Stile: hinzufügen, wechseln, Name und Status; die Farben und Schriften des gewählten Stils" },
        wirePreview: "Vorschau", wireMenu: (n) => `Vorschau: Menü ${n}`, wireFooter: (n) => `Vorschau: Footer ${n}`, wireCookie: (n) => `Vorschau: Cookie-Hinweis, ${n}`,
        styles: "Stile", editing: "Bearbeitet:", stylesOpen: "Stile hinzufügen, wechseln und bearbeiten",
        tabsLabel: "Bereiche", cookieMode: "Art", cookieNotice: "Hinweis", cookieConsent: "Einwilligung",
        cookieNoticeHint: "Es werden keine Daten erhoben: eine Zeile ohne Buttons, nach 5 Sekunden verschwindet sie von selbst.",
        cookieConsentHint: "Es werden Daten erhoben: mit Akzeptieren und Ablehnen; bleibt, bis gewählt wird. Optionales lädt erst nach Akzeptieren.",
        cookieTextNotice: "Text des Hinweises", cookieTextConsent: "Text der Einwilligung", lang_de: "Deutsch", lang_en: "Englisch",
        cookiePreview: "Vorschau zeigen", cookieSave: "Hinweis speichern", cookieSaved: "Cookie-Hinweis gespeichert", cookieEmpty: "Bitte beide Sprachen ausfüllen.",
        errors: { letter_taken: "Dieser Buchstabe ist vergeben.", default_must_be_published: "Die Standard-Variante muss veröffentlicht sein.", choose_another_default: "Erst eine andere Variante zum Standard machen.", default_cannot_be_deleted: "Die Standard-Variante kann nicht gelöscht werden." },
    },
    en: {
        title: "Styles", open: "Styles (S)", create: "New variant", letter: "Letter", name: "Name", status: "Status",
        draft: "Draft", published: "Published", isDefault: "Default", logo: "Logo", logoFile: "SVG file", logoCode: "or paste SVG code",
        logoStripped: "Unsafe parts were removed.", logoInvalid: "Not a valid SVG.", colors: "Colours",
        c_bg: "Background", c_text: "Text", c_accent: "Accent", c_light: "Light", c_dark: "Dark",
        fonts: "Fonts", heading: "Main font: logo, H1 to H3", body: "Secondary font: sub-lines, H4, H5, text", builtIn: "Clash Grotesk (default)", google: "Google Fonts", upload: "Own woff2",
        family: "Font name", fontFile: "woff2 file", hero: "Hero video", images: "Images", imagesHint: "Leave empty for the default image.",
        upload: "Upload", clear: "Remove", duplicate: "Duplicate", copyOf: (n) => `${n} (copy)`, inherited: "Default",
        builtInLogo: "Default: Kalq logo", effects: "Effects", reveal: "Liquid reveal (follows the pointer)", revealOff: "Off", revealHero: "Hero only", revealAll: "Hero and images", menu: "Menu", menuDropdown: "Dropdown", menuPanels: "Panels", menuMinimal: "Bar with button", menuPlain: "Bar", menuMega: "Mega menu", menuOverlay: "Fullscreen",
        footer: "Footer", footerClassic: "Classic", footerHarbor: "Contact and links", footerWordmark: "Large wordmark", footerGradient: "Moving gradient",
        heroMark: "Centre of the hero (Home)", heroMarkLogo: "Logo", heroMarkLine: "Line", heroLine: "Line shape",
        lines: { back: "Diagonal \\", forward: "Diagonal /", vertical: "Vertical", horizontal: "Horizontal", circle: "Circle" }, loadFailed: "The styles could not be loaded.",
        sitemap: "Pages", replaceSlot: "Replace", uploading: "Uploading", spreadImages: "Copy to all image slots", spreadHero: "Use as hero on every page",
        spreadDone: (n) => `Copied to ${n} slots.`, addMedia: "+ Image or video", resetSlot: "Back to default",
        fillAll: "Fill all", fillHint: "A video becomes the hero everywhere, an image fills every image slot. Replace single slots afterwards.",
        filledHero: (n) => `The video is now the hero on ${n} pages.`, filledImages: (n) => `Image in ${n} image slots.`,
        peek: "View page", unsaved: "Not saved",
        pages: { home: "Home", platform: "Platform", company: "Company", impressum: "Legal notice", datenschutz: "Privacy" }, preview: "Preview", endPreview: "End preview", save: "Save", remove: "Delete",
        history: "Versions", restore: "Restore", saved: "Saved", failed: "Could not save", confirmDelete: "Delete this variant? It stays in the versions.",
        tabs: { images: "Images", logos: "Logos", menu: "Menu", navigation: "Navigation", notifications: "Notifications", look: "Colours & fonts" },
        tabTitles: { images: "Hero video, the image slots of every page and the reveal over the images", logos: "The variant's logo and what sits in the middle of the hero",
            menu: "How the main menu looks and opens", navigation: "The footer: contact, links and wordmark at the end of every page",
            notifications: "The cookie notice at the bottom of every page. For the whole site, the same in every variant.", look: "The styles: add, switch, name and status; the colours and fonts of the selected style" },
        wirePreview: "Preview", wireMenu: (n) => `Preview: menu ${n}`, wireFooter: (n) => `Preview: footer ${n}`, wireCookie: (n) => `Preview: cookie notice, ${n}`,
        styles: "Styles", editing: "Editing:", stylesOpen: "Add, switch and edit styles",
        tabsLabel: "Sections", cookieMode: "Kind", cookieNotice: "Notice", cookieConsent: "Consent",
        cookieNoticeHint: "No data is collected: one line, no buttons; after 5 seconds it goes by itself.",
        cookieConsentHint: "Data is collected: with Accept and Deny; it stays until one is chosen. Optional content loads only after Accept.",
        cookieTextNotice: "Notice text", cookieTextConsent: "Consent text", lang_de: "German", lang_en: "English",
        cookiePreview: "Show preview", cookieSave: "Save notice", cookieSaved: "Cookie notice saved", cookieEmpty: "Please fill in both languages.",
        errors: { letter_taken: "That letter is taken.", default_must_be_published: "The default variant must be published.", choose_another_default: "Make another variant the default first.", default_cannot_be_deleted: "The default variant cannot be deleted." },
    },
};
const t = (key) => TEXT[EDITOR_LANG][key];
const COLORS = ["bg", "text", "accent", "light", "dark"];
const GOOGLE_SUGGESTIONS = ["Inter", "Space Grotesk", "Manrope", "DM Sans", "Sora", "Outfit", "Archivo", "IBM Plex Sans", "Work Sans", "Syne", "Playfair Display", "Fraunces", "Instrument Serif", "JetBrains Mono"];

let collab, button, root, data = null, variants = [], slots = [], defaults = {}, selectedId = null, draft = null, previewOn = false;
let activeTab = "images"; // the settings tab shown (kept while the panel is open)
const DEFAULT_HERO = "assets/video-hero-6mb-low.mp4";
const DEFAULT_COLORS = { bg: "#ffffff", text: "#101010", accent: "#3b82f6", light: "#ffffff", dark: "#101010" };

// Every field present, whatever the server sent: empty means "the site's own" (logo, fonts, video, images)
function normalize(v) {
    const font = (f) => (f && f.source && f.source !== "default" ? { ...f } : { source: "default", family: "" });
    return {
        ...v,
        name: v.name || `Variant ${v.letter}`,
        status: v.status || "published",
        sort: Number.isInteger(v.sort) ? v.sort : 50,
        logo_svg: v.logo_svg || "",
        hero_mark: v.hero_mark === "logo" ? "logo" : "line",
        hero_line: ["back", "forward", "vertical", "horizontal", "circle"].includes(v.hero_line) ? v.hero_line : "back",
        reveal: ["off", "hero", "all"].includes(v.reveal) ? v.reveal : v.hero_reveal === true ? "hero" : "off",
        menu_style: ["dropdown", "panels", "minimal", "plain", "mega", "overlay"].includes(v.menu_style) ? v.menu_style : "dropdown",
        footer_style: v.footer_style === "harbor" ? "harbor" : "classic",
        footer_wordmark: v.footer_wordmark === true,
        footer_gradient: v.footer_gradient === true,
        colors: { ...DEFAULT_COLORS, ...(v.colors || {}) },
        fonts: { heading: font(v.fonts?.heading), body: font(v.fonts?.body) },
        hero_video: v.hero_video || "",
        images: { ...(v.images || {}) },
    };
}

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};
const field = (label, input) => el("label", { className: "kalq-styles__field" }, el("span", { textContent: label }), input);
const clone = (v) => JSON.parse(JSON.stringify(v));

async function api(body) {
    const res = await fetch("/api/variants", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || "failed"), { info: out });
    return out;
}
const errorText = (error) => t("errors")[error.message] || (error.info?.field ? `${t("failed")}: ${error.info.field}` : t("failed"));

// Into this variant's folder in Storage, with progress (js/upload.js)
function upload(file, kind, onProgress) {
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
    return uploadMedia(collab.sb, `variants/${selectedId}/${kind}/${Date.now()}-${safe}`, file, onProgress);
}

async function refresh() {
    try {
        const res = await fetch("/api/variants", { credentials: "same-origin", cache: "no-store" });
        data = await res.json();
    } catch (error) {
        return showError(error);
    }
    variants = (data.variants || []).map(normalize);
    dirty = false;
    slots = data.slots || [];
    defaults = data.defaults || {};
    if (!variants.find((v) => v.id === selectedId)) selectedId = (variants.find((v) => v.id === getActive()?.id) || variants[0])?.id || null;
    draft = selectedId ? clone(variants.find((v) => v.id === selectedId)) : null;
    render();
}

const changed = () => { if (previewOn) applyVariant(draft, { preview: true }); if (root) { dirty = true; markDirty(); } };

//=================================== Sections ===================================//
function headerSection() {
    const used = new Set(variants.filter((v) => v.id !== draft.id).map((v) => v.letter));
    const letter = el("select", {}, ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((l) => !used.has(l)).map((l) => el("option", { value: l, textContent: l, selected: l === draft.letter })));
    letter.addEventListener("change", () => { draft.letter = letter.value; });
    const name = el("input", { type: "text", value: draft.name || "", maxLength: 40 });
    name.addEventListener("input", () => { draft.name = name.value; });
    // Switches: published (Save then puts it live) and default
    const toggle = (label, on, onChange) => {
        const input = el("input", { type: "checkbox", className: "kalq-switch__input", checked: on });
        input.setAttribute("role", "switch");
        input.addEventListener("change", () => { onChange(input.checked); changed(); });
        return el("label", { className: "kalq-switch" }, input, el("span", { className: "kalq-switch__track", ariaHidden: "true" }), el("span", { textContent: label }));
    };
    return el("div", { className: "kalq-styles__row" }, field(t("letter"), letter), field(t("name"), name),
        el("div", { className: "kalq-styles__switches" },
            toggle(t("published"), draft.status === "published", (on) => { draft.status = on ? "published" : "draft"; }),
            toggle(t("isDefault"), !!draft.is_default, (on) => { draft.is_default = on; })));
}

function logoSection() {
    const previews = el("div", { className: "kalq-styles__logos" });
    const note = el("p", { className: "kalq-styles__note" });
    const code = el("textarea", { rows: 4, placeholder: "<svg …>…</svg>", value: draft.logo_svg || "", spellcheck: false });
    const show = (raw) => {
        const clean = raw ? sanitizeSvg(raw) : "";
        note.textContent = raw && !clean ? t("logoInvalid") : raw && clean.length < raw.replace(/\s+/g, " ").length * 0.98 && /script|on\w+=|href=|url\(|foreignObject|style/i.test(raw) ? t("logoStripped") : "";
        // Live preview on dark and light, in the variant's colours
        previews.replaceChildren(...["dark", "light"].map((tone) => {
            const tile = el("div", { className: `kalq-styles__logo is-${tone}` });
            tile.style.background = tone === "dark" ? draft.colors.dark : draft.colors.bg;
            const node = clean ? logoNode(clean) : builtInMark(tone === "dark" ? draft.colors.light : draft.colors.text);
            tile.append(node || el("span", { textContent: "KALQ" }));
            return tile;
        }));
        return clean;
    };
    code.addEventListener("input", () => { const clean = show(code.value); draft.logo_svg = clean; changed(); });
    code.addEventListener("keydown", (e) => e.stopPropagation());
    const file = el("input", { type: "file", accept: ".svg,image/svg+xml" });
    file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        code.value = await f.text(); // same sanitiser as pasted code
        code.dispatchEvent(new Event("input"));
    });
    show(draft.logo_svg);
    const inherited = el("p", { className: "kalq-styles__inherited", textContent: draft.logo_svg ? "" : t("builtInLogo") });
    code.addEventListener("input", () => { inherited.textContent = code.value.trim() ? "" : t("builtInLogo"); });
    return el("section", {}, el("h4", { textContent: t("logo") }), field(t("logoFile"), file), field(t("logoCode"), code), note, inherited, previews);
}

// What moves behind the title on Home: a line (toggle Linie) in one of five shapes, or the logo
function heroMarkSection() {
    const seg = (items, current, onPick, extra = "") => {
        const box = el("div", { className: `kalq-seg ${extra}`, role: "group" });
        const draw = (value) => box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === value));
        items.forEach(([value, label, icon]) => {
            const b = el("button", { type: "button", className: "kalq-seg__item", title: label });
            b.dataset.value = value;
            if (icon) { b.innerHTML = icon; b.setAttribute("aria-label", label); } else b.textContent = label;
            b.addEventListener("click", () => { onPick(value); draw(value); });
            box.append(b);
        });
        draw(current);
        return box;
    };
    const icon = (inner) => `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
    const shapes = seg([
        ["back", t("lines").back, icon('<line x1="4" y1="4" x2="16" y2="16"/>')],
        ["forward", t("lines").forward, icon('<line x1="16" y1="4" x2="4" y2="16"/>')],
        ["vertical", t("lines").vertical, icon('<line x1="10" y1="3" x2="10" y2="17"/>')],
        ["horizontal", t("lines").horizontal, icon('<line x1="3" y1="10" x2="17" y2="10"/>')],
        ["circle", t("lines").circle, icon('<circle cx="10" cy="10" r="6.5"/>')],
    ], draft.hero_line, (v) => { draft.hero_line = v; changed(); }, "is-icons");
    // A div, not a <label>: a click on the label text would press the first shape
    const shapeField = el("div", { className: "kalq-styles__field" }, el("span", { textContent: t("heroLine") }), shapes);
    shapeField.hidden = draft.hero_mark === "logo";
    const mode = seg([["line", t("heroMarkLine")], ["logo", t("heroMarkLogo")]], draft.hero_mark,
        (v) => { draft.hero_mark = v; shapeField.hidden = v === "logo"; changed(); });
    return el("section", {}, el("h4", { textContent: t("heroMark") }), mode, shapeField);
}

// A row of choices, one pressed
function seg(items, current, onPick) {
    const box = el("div", { className: "kalq-seg", role: "group" });
    items.forEach(([value, label]) => {
        const b = el("button", { type: "button", className: "kalq-seg__item", textContent: label });
        b.dataset.value = value;
        b.setAttribute("aria-pressed", value === current);
        b.addEventListener("click", () => { onPick(value); box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
        box.append(b);
    });
    return box;
}

// Images: the liquid reveal over the hero and images (off, hero, hero and images)
function revealSection() {
    const reveal = seg([["off", t("revealOff")], ["hero", t("revealHero")], ["all", t("revealAll")]], draft.reveal, (v) => { draft.reveal = v; delete draft.hero_reveal; changed(); });
    return el("section", {}, el("h4", { textContent: t("effects") }), el("div", { className: "kalq-styles__field" }, el("span", { textContent: t("reveal") }), reveal));
}

// Menu: the main menu's style
function menuSection() {
    const menu = seg([["dropdown", t("menuDropdown")], ["panels", t("menuPanels")], ["minimal", t("menuMinimal")], ["plain", t("menuPlain")], ["mega", t("menuMega")], ["overlay", t("menuOverlay")]],
        draft.menu_style, (v) => { draft.menu_style = v; changed(); drawPreview(); });
    menu.classList.add("is-wrap");
    return el("section", {}, el("h4", { textContent: t("menu") }), menu);
}

// Navigation: the footer for the whole site, the classic one or the library's (contact, links, social, legal line),
// with an optional large wordmark and a slowly moving gradient behind it
function footerSection() {
    const toggle = (key, label) => {
        const b = el("button", { type: "button", className: "kalq-seg__item", textContent: label });
        b.setAttribute("aria-pressed", draft[key] === true);
        b.addEventListener("click", () => { draft[key] = !draft[key]; b.setAttribute("aria-pressed", draft[key]); changed(); drawPreview(); });
        return b;
    };
    const footer = seg([["classic", t("footerClassic")], ["harbor", t("footerHarbor")]], draft.footer_style, (v) => { draft.footer_style = v; extras.hidden = v !== "harbor"; changed(); drawPreview(); });
    const extras = el("div", { className: "kalq-seg", role: "group" }, toggle("footer_wordmark", t("footerWordmark")), toggle("footer_gradient", t("footerGradient")));
    extras.hidden = draft.footer_style !== "harbor";
    return el("section", {}, el("h4", { textContent: t("footer") }), footer, extras);
}

// Notifications: the cookie bar. Not part of a variant: its mode and texts are site blocks (js/cookieBar.js), saved
// here on their own, as a version like any edited text; the server writes them into every page.
let cookieDraft = null;
function cookieSection() {
    const plainOf = (key, lang) => { const e = storedEntry(key); return String((e && (e[lang] ?? (lang === "de" ? e.en : e.de))) || "").replace(/<[^>]+>/g, "").trim(); };
    const bar = document.querySelector(".kalq-cookie");
    const builtIn = (mode, lang) => bar?.querySelector(`.kalq-cookie__text[data-for="${mode}"] [lang="${lang}"]`)?.textContent.trim() || "";
    if (!cookieDraft) {
        cookieDraft = { mode: plainOf(COOKIE_KEYS.mode, "de") === "consent" ? "consent" : "notice", texts: {} };
        ["notice", "consent"].forEach((m) => ["de", "en"].forEach((l) => { cookieDraft.texts[`${m}.${l}`] = plainOf(COOKIE_KEYS[m], l) || builtIn(m, l); }));
    }
    const hint = el("p", { className: "kalq-styles__inherited" });
    const showHint = () => { hint.textContent = cookieDraft.mode === "consent" ? t("cookieConsentHint") : t("cookieNoticeHint"); };
    const mode = seg([["notice", t("cookieNotice")], ["consent", t("cookieConsent")]], cookieDraft.mode, (v) => { cookieDraft.mode = v; showHint(); drawPreview(); });
    showHint();
    const text = (m, l) => {
        const id = `kalq-cookie-${m}-${l}`;
        const area = el("textarea", { id, className: "kalq-styles__prose", rows: 2, maxLength: 200, value: cookieDraft.texts[`${m}.${l}`] || "", spellcheck: true });
        area.addEventListener("input", () => { cookieDraft.texts[`${m}.${l}`] = area.value; });
        area.addEventListener("keydown", (e) => e.stopPropagation());
        return el("label", { className: "kalq-styles__field", htmlFor: id }, el("span", { textContent: `${t(m === "notice" ? "cookieTextNotice" : "cookieTextConsent")} · ${t(`lang_${l}`)}` }), area);
    };
    // the page's bar shows what is set here (before saving too)
    const toPage = () => applyCookieSettings(document, (key) => {
        if (key === COOKIE_KEYS.mode) return { de: cookieDraft.mode, en: cookieDraft.mode };
        const m = key === COOKIE_KEYS.notice ? "notice" : "consent";
        return { de: cookieDraft.texts[`${m}.de`], en: cookieDraft.texts[`${m}.en`] };
    });
    const preview = el("button", { type: "button", className: "kalq-btn", textContent: t("cookiePreview") });
    preview.addEventListener("click", () => { toPage(); minimize(); previewCookieBar(); });
    const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("cookieSave") });
    save.addEventListener("click", async () => {
        const m = cookieDraft.mode;
        if (!cookieDraft.texts[`${m}.de`]?.trim() || !cookieDraft.texts[`${m}.en`]?.trim()) return collab.toast(t("cookieEmpty"), "error");
        save.disabled = true;
        try { await saveCookieBlocks(); toPage(); collab.toast(t("cookieSaved")); }
        catch (error) { console.error("cookie", error); collab.toast(t("failed"), "error"); }
        finally { save.disabled = false; }
    });
    return el("section", {}, el("h4", { textContent: t("tabs").notifications }),
        el("div", { className: "kalq-styles__field" }, el("span", { textContent: t("cookieMode") }), mode), hint,
        text("notice", "de"), text("notice", "en"), text("consent", "de"), text("consent", "en"),
        el("div", { className: "kalq-styles__cookie-actions" }, preview, save));
}

// One batch of site blocks: the mode (both languages alike) and the two texts per language
async function saveCookieBlocks() {
    const { data } = await collab.sb.auth.getSession();
    const session = data?.session;
    if (!session) throw new Error("relogin");
    const rows = [
        ...["de", "en"].map((lang) => ({ key: COOKIE_KEYS.mode, lang, content: cookieDraft.mode })),
        ...["notice", "consent"].flatMap((m) => ["de", "en"].map((lang) => ({ key: COOKIE_KEYS[m], lang, content: cookieDraft.texts[`${m}.${lang}`].trim() }))),
    ].filter((r) => r.content);
    const keys = [...new Set(rows.map((r) => r.key))];
    const { error: blockError } = await collab.sb.from("blocks").upsert(keys.map((key) => ({ key, page: "site", type: "text" })), { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const { error } = await collab.sb.from("revisions").insert(rows.map((r) => ({ block_key: r.key, page: "site", lang: r.lang, content: r.content, author_id: session.user.id,
        batch_id: batch, batch_scope: "site", batch_label: "Edited cookie notice" })));
    if (error) throw error;
    rows.forEach((r) => setLocalContent(r.key, r.lang, r.content, "text"));
    collab.broadcast("content", { keys, color: collab.me.color });
}

// The site's own Kalq mark, for variants without their own logo
function builtInMark(color) {
    const mark = document.querySelector(".site-logo__mark")?.cloneNode(true);
    if (!mark) return null;
    mark.removeAttribute("data-animated");
    mark.setAttribute("class", "kalq-styles__mark");
    mark.style.color = color;
    return mark;
}

function colorSection() {
    const rows = COLORS.map((name) => {
        const picker = el("input", { type: "color", value: draft.colors[name] });
        const hex = el("input", { type: "text", value: draft.colors[name], maxLength: 7, spellcheck: false, className: "kalq-styles__hex" });
        const set = (value) => { draft.colors[name] = value.toLowerCase(); changed(); };
        picker.addEventListener("input", () => { hex.value = picker.value; set(picker.value); });
        hex.addEventListener("input", () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { picker.value = hex.value; set(hex.value); } });
        hex.addEventListener("keydown", (e) => e.stopPropagation());
        return el("div", { className: "kalq-styles__color" }, picker, hex, el("span", { textContent: t(`c_${name}`) }));
    });
    return el("section", {}, el("h4", { textContent: t("colors") }), ...rows);
}

function fontRow(part) {
    const font = draft.fonts[part] || { source: "default" };
    draft.fonts[part] = font;
    const source = el("select", {}, ...[["default", t("builtIn")], ["google", t("google")], ["upload", t("upload")]].map(([v, l]) => el("option", { value: v, textContent: l, selected: font.source === v })));
    const family = el("input", { type: "text", value: font.family || "", maxLength: 40, placeholder: "Space Grotesk" });
    family.setAttribute("list", "kalq-google-fonts");
    const file = el("input", { type: "file", accept: ".woff2,font/woff2" });
    // The main font sample includes the wordmark it will set
    const sample = el("p", { className: "kalq-styles__sample", textContent: part === "heading" ? "KALQ · Ein technischer Kern." : "Bessere industrielle Entscheidungen." });
    const sync = () => {
        family.hidden = font.source === "default";
        file.hidden = font.source !== "upload";
        sample.style.fontFamily = font.family ? `"${font.family}"` : "";
    };
    source.addEventListener("change", () => { font.source = source.value; if (source.value === "default") { font.family = ""; delete font.url; } sync(); changed(); });
    family.addEventListener("input", () => { font.family = family.value.trim(); sync(); changed(); });
    family.addEventListener("keydown", (e) => e.stopPropagation());
    file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        try {
            font.url = await upload(f, "fonts");
            if (!font.family) { font.family = f.name.replace(/\.woff2$/i, "").replace(/[^A-Za-z0-9 ]+/g, " ").trim().slice(0, 40); family.value = font.family; }
            sync(); changed();
        } catch (error) { collab.toast(errorText(error), "error"); }
    });
    sync();
    return el("div", { className: "kalq-styles__font" }, el("strong", { textContent: t(part) }), source, family, file, sample);
}

//=================================== Sitemap ===================================//
// Every page side by side as a schematic in its real arrangement: hero on top, image slots as they sit on the
// page (one full width, two or three side by side, list rows), text as grey lines. Slots are live thumbnails.
const HERO_KEYS = ["home.hero.video", "platform.hero.media", "company.hero.media"];
const CARDS = ["should-cost", "machine-intelligence", "supplier-fit", "manufacturing-cost", "rfq-award", "price-quote"]; // two columns, row by row
const SITEMAP = [
    { page: "home", items: [{ hero: "home.hero.video" }, { text: 4 }, { list: CARDS.map((c) => `home.platform.${c}.image`) }, { text: 3 }] },
    { page: "platform", items: [{ hero: "platform.hero.media" }, { text: 2 }, { full: "platform.header.image" }, { text: 3 }, { grid: CARDS.map((c) => `platform.cards.${c}.image`), cols: 2 }] },
    { page: "company", items: [{ hero: "company.hero.media" }, { text: 2 }, { full: "company.header.image" }, { text: 3 }, { grid: ["company.why.image1", "company.why.image2"], cols: 2 }, { text: 3 }, { full: "company.shared.image" }, { text: 2 }, { full: "company.prices.image" }] },
    { page: "impressum", items: [{ text: 9 }] },
    { page: "datenschutz", items: [{ text: 5 }] },
];
const isVideo = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url || "");
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm";

// The home hero video is its own field, every other slot lives in images
const slotUrl = (key) => (key === "home.hero.video" ? draft.hero_video : draft.images[key]) || "";
function setSlot(key, url) {
    if (key === "home.hero.video") draft.hero_video = url;
    else if (url) draft.images[key] = url;
    else delete draft.images[key];
    dirty = true;
}
const inheritedUrl = (key) => defaults[key] || (key === "home.hero.video" ? DEFAULT_HERO : "");
const imageKeys = () => [...new Set([...SITEMAP.flatMap((p) => p.items.flatMap((i) => i.list || i.grid || (i.full ? [i.full] : []))), ...slots.map((x) => x.key)])]
    .filter((k) => !HERO_KEYS.includes(k));

let dirty = false;
let lastUpload = null; // { key, url }: offers to copy the newest upload to every slot of its kind


// After an upload: copy the same file to every hero (hero slot) or every image slot (any other slot)
function spreadChip(key, url) {
    const hero = HERO_KEYS.includes(key);
    const chip = el("button", { type: "button", className: "kalq-map__spread", textContent: `✓ ${hero ? t("spreadHero") : t("spreadImages")}` });
    chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const keys = hero ? HERO_KEYS : imageKeys();
        keys.forEach((k) => setSlot(k, url));
        lastUpload = null;
        changed();
        render();
        collab.toast(t("spreadDone")(keys.length));
        document.querySelectorAll(".kalq-map__slot").forEach((slot) => { if (keys.includes(slot.dataset.key)) showDone(slot); });
    });
    return chip;
}

function pickFile(onFile) {
    const input = el("input", { type: "file", accept: ACCEPT });
    input.addEventListener("change", () => input.files[0] && onFile(input.files[0]));
    input.click();
}

function slotNode(key, shape) {
    const node = el("button", { type: "button", className: `kalq-map__slot is-${shape}` });
    node.dataset.key = key;
    const draw = () => {
        const own = slotUrl(key);
        const url = own || inheritedUrl(key);
        node.classList.toggle("is-inherited", !own);
        node.classList.toggle("is-empty", !url);
        const media = !url ? el("span", { className: "kalq-map__add", textContent: t("addMedia") })
            : isVideo(url) ? el("video", { src: url, muted: true, loop: true, autoplay: true, playsInline: true }) : el("img", { src: url, alt: "", loading: "lazy" });
        const children = [media, el("span", { className: "kalq-map__hover", textContent: t("replaceSlot") })];
        if (!own && url) children.push(el("span", { className: "kalq-styles__tag", textContent: t("inherited") }));
        if (own) {
            const reset = el("span", { className: "kalq-map__reset", textContent: "×", title: t("resetSlot") });
            reset.setAttribute("role", "button");
            reset.addEventListener("click", (e) => { e.stopPropagation(); setSlot(key, ""); draw(); changed(); markDirty(); });
            children.push(reset);
        }
        node.replaceChildren(...children);
        node.title = `${key}${own ? "" : ` · ${t("inherited")}`}`;
    };
    node.addEventListener("click", () => pickFile(async (file) => {
        node.classList.add("is-busy");
        const progress = progressLine(node);
        try {
            const url = await upload(file, "media", progress.set);
            setSlot(key, url);
            lastUpload = { key, url };
            draw(); changed(); markDirty();
            showDone(node);
            document.querySelectorAll(".kalq-map__spread").forEach((chip) => chip.remove());
            wrap.append(spreadChip(key, url));
        }
        catch (error) { collab.toast(errorText(error), "error"); }
        finally { progress.done(); node.classList.remove("is-busy"); }
    }));
    draw();
    // The slot sits in a wrapper so the "copy to all" chip can follow it
    const wrap = el("div", { className: `kalq-map__cell is-${shape}` }, node);
    if (lastUpload?.key === key && slotUrl(key) === lastUpload.url) wrap.append(spreadChip(key, lastUpload.url));
    return wrap;
}

const lines = (n) => el("div", { className: "kalq-map__text" }, ...Array.from({ length: n }, (_, i) => {
    const line = el("span");
    line.style.width = `${[92, 78, 86, 64, 88, 70, 95, 58, 82][i % 9]}%`;
    return line;
}));

function pageNode({ page, items }) {
    const body = el("div", { className: "kalq-map__page" });
    items.forEach((item) => {
        if (item.hero) body.append(slotNode(item.hero, "hero"));
        else if (item.text) body.append(lines(item.text));
        else if (item.full) body.append(slotNode(item.full, "full"));
        else if (item.grid) {
            const grid = el("div", { className: "kalq-map__grid" }, ...item.grid.map((k) => slotNode(k, "card")));
            grid.style.gridTemplateColumns = `repeat(${item.cols}, 1fr)`;
            body.append(grid);
        } else if (item.list) {
            body.append(el("div", { className: "kalq-map__list" }, ...item.list.map((k) => el("div", { className: "kalq-map__row" }, lines(1), slotNode(k, "thumb")))));
        }
    });
    return el("section", { className: "kalq-map__col" }, el("h5", { textContent: t("pages")[page] }), body);
}

function sitemapNode() {
    return el("div", { className: "kalq-map" }, ...SITEMAP.map(pageNode));
}

// One upload fills the whole look: a video becomes every hero, an image every image slot
function fillAllSection() {
    const btn = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("fillAll") });
    btn.addEventListener("click", () => pickFile(async (file) => {
        btn.disabled = true;
        const progress = progressLine(btn);
        try {
            const url = await upload(file, "media", progress.set);
            if (isVideo(url)) { HERO_KEYS.forEach((k) => setSlot(k, url)); collab.toast(t("filledHero")(HERO_KEYS.length)); }
            else { const keys = imageKeys(); keys.forEach((k) => setSlot(k, url)); collab.toast(t("filledImages")(keys.length)); }
            changed();
            render();
        } catch (error) { collab.toast(errorText(error), "error"); }
        finally { progress.done(); btn.disabled = false; }
    }));
    return el("section", {}, el("h4", { textContent: t("fillAll") }), el("p", { className: "kalq-styles__inherited", textContent: t("fillHint") }), btn);
}

function markDirty() {
    root.querySelector(".kalq-styles__dirty")?.removeAttribute("hidden");
}

async function historySection(box) {
    const res = await fetch(`/api/variants?history=${encodeURIComponent(draft.id)}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const { versions = [] } = await res.json();
    box.replaceChildren(el("h4", { textContent: t("history") }), ...versions.map((v, i) => {
        const row = el("div", { className: "kalq-styles__version" },
            el("span", { textContent: `${new Date(v.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${v.label || ""}` }));
        if (i > 0) {
            const restore = el("button", { type: "button", className: "kalq-btn", textContent: t("restore") });
            restore.addEventListener("click", async () => {
                try { await api({ action: "restore", id: draft.id, batch_id: v.batch_id }); await after(); } catch (error) { collab.toast(errorText(error), "error"); }
            });
            row.append(restore);
        }
        return row;
    }));
}

//=================================== Panel ===================================//
async function after() {
    collab.broadcast("variants", { at: Date.now() }, { site: true });
    await loadVariants();
    await refresh();
    collab.toast(t("saved"));
}

function showError(error) {
    console.error("styles", error);
    root?.querySelector(".kalq-styles__settings")?.replaceChildren(el("p", { className: "kalq-styles__note", textContent: t("loadFailed") }));
}

function render() {
    if (!root) return;
    try { renderPanel(); } catch (error) { showError(error); }
}

function renderPanel() {
    const list = el("div", { className: "kalq-styles__list" }, ...variants.map((v) => {
        const b = el("button", { type: "button", className: "kalq-styles__card" }, el("span", { className: "kalq-styles__letter", textContent: v.letter }), el("span", { textContent: v.name || "" }),
            el("small", { textContent: `${v.status === "published" ? t("published") : t("draft")}${v.is_default ? ` · ${t("isDefault")}` : ""}` }));
        b.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        b.setAttribute("aria-pressed", v.id === selectedId);
        b.addEventListener("click", () => { selectedId = v.id; draft = clone(v); dirty = false; if (previewOn) applyVariant(draft, { preview: true }); render(); });
        return b;
    }));
    // A new variant starts from the default one (A: today's look)
    const create = el("button", { type: "button", className: "kalq-btn kalq-styles__create", textContent: `+ ${t("create")}` });
    create.addEventListener("click", () => { const base = variants.find((v) => v.is_default) || variants[0]; createFrom(base || normalize({ letter: "A" }), null, { menu_style: "minimal" }); });
    // The head names the style being edited; a click opens its editor (Colours & fonts: the styles, add, switch, edit)
    const current = variants.find((v) => v.id === selectedId);
    const chip = current ? el("button", { type: "button", className: "kalq-styles__current", title: t("stylesOpen") },
        el("span", { className: "kalq-styles__letter", textContent: current.letter }), el("span", { textContent: `${t("editing")} ${current.name || ""}` })) : null;
    if (chip) {
        chip.style.setProperty("--dot", current.colors?.accent || "#3b82f6");
        chip.addEventListener("click", () => { activeTab = "look"; render(); root.querySelector("#kalq-styles-tab-look")?.focus(); });
    }
    root.querySelector(".kalq-styles__variants").replaceChildren(...(chip ? [chip] : []));

    const settings = root.querySelector(".kalq-styles__settings");
    const map = root.querySelector(".kalq-styles__map");
    // no style yet: the editor still offers to make the first one
    if (!draft) { settings.replaceChildren(el("section", { className: "kalq-styles__styles" }, el("h4", { textContent: t("styles") }), list, create)); map.replaceChildren(); return; }

    const history = el("section", { className: "kalq-styles__history" });
    const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary kalq-btn--save", textContent: t("save") });
    save.addEventListener("click", async () => {
        save.disabled = true;
        try { await api({ action: "save", id: draft.id, data: draft }); dirty = false; if (previewOn) togglePreview(false); await after(); }
        catch (error) { collab.toast(errorText(error), "error"); }
        finally { save.disabled = false; }
    });
    const preview = el("button", { type: "button", className: "kalq-btn", textContent: previewOn ? t("endPreview") : t("preview") });
    preview.addEventListener("click", () => { togglePreview(!previewOn); render(); });
    const peek = el("button", { type: "button", className: "kalq-btn", textContent: t("peek") });
    peek.addEventListener("click", () => { if (!previewOn) togglePreview(true); minimize(); });
    const dup = el("button", { type: "button", className: "kalq-btn", textContent: t("duplicate") });
    dup.addEventListener("click", () => createFrom(draft, t("copyOf")(draft.name)));
    const del = el("button", { type: "button", className: "kalq-btn kalq-btn--quiet", textContent: t("remove") });
    del.addEventListener("click", async () => {
        if (!window.confirm(t("confirmDelete"))) return;
        try { await api({ action: "delete", id: draft.id }); selectedId = null; await after(); } catch (error) { collab.toast(errorText(error), "error"); }
    });
    const unsaved = el("span", { className: "kalq-styles__dirty", textContent: t("unsaved") });
    unsaved.hidden = !dirty;

    // The tabs: each with a small title saying what it controls; the page map belongs to Images
    const SECTIONS = {
        images: () => [fillAllSection(), revealSection()],
        logos: () => [logoSection(), heroMarkSection()],
        menu: () => [menuSection()],
        navigation: () => [footerSection()],
        notifications: () => [cookieSection()],
        // the style editor: every style (switch by a click), a new one, this one's letter, name and switches; then its look
        look: () => [el("section", { className: "kalq-styles__styles" }, el("h4", { textContent: t("styles") }), list, create, headerSection()),
            colorSection(), el("section", {}, el("h4", { textContent: t("fonts") }), fontRow("heading"), fontRow("body"))],
    };
    const ids = Object.keys(SECTIONS);
    if (!ids.includes(activeTab)) activeTab = "images";
    const tablist = el("div", { className: "kalq-styles__tabs", role: "tablist" });
    tablist.setAttribute("aria-label", t("tabsLabel"));
    ids.forEach((id) => {
        const tab = el("button", { type: "button", className: "kalq-styles__tab", id: `kalq-styles-tab-${id}`, textContent: t("tabs")[id] });
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", id === activeTab);
        tab.setAttribute("aria-controls", "kalq-styles-tabpanel");
        tab.tabIndex = id === activeTab ? 0 : -1;
        tab.addEventListener("click", () => { activeTab = id; render(); root.querySelector(`#kalq-styles-tab-${id}`)?.focus(); });
        tablist.append(tab);
    });
    tablist.addEventListener("keydown", (e) => {
        const i = ids.indexOf(activeTab);
        const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        activeTab = ids[(j + ids.length) % ids.length];
        render();
        root.querySelector(`#kalq-styles-tab-${activeTab}`)?.focus();
    });
    const panel = el("div", { className: "kalq-styles__tabpanel", id: "kalq-styles-tabpanel" },
        el("p", { className: "kalq-styles__tabtitle", textContent: t("tabTitles")[activeTab] }), ...SECTIONS[activeTab]());
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `kalq-styles-tab-${activeTab}`);

    settings.replaceChildren(tablist, panel, history,
        el("div", { className: "kalq-styles__actions" },
            el("div", { className: "kalq-styles__actions-view" }, preview, peek, dup),
            el("div", { className: "kalq-styles__actions-main" }, del, unsaved, save)),
        el("datalist", { id: "kalq-google-fonts" }, ...GOOGLE_SUGGESTIONS.map((f) => el("option", { value: f }))));
    drawPreview();
    historySection(history);
}

// Beside the settings: the page map (every image slot) for Images; for Menu, Navigation and Notifications a wireframe
// of what is selected (js/stylePreview.js), redrawn on every choice. The other tabs take the full width.
function drawPreview() {
    const map = root?.querySelector(".kalq-styles__map");
    if (!map || !draft) return;
    const MENUS = { dropdown: "menuDropdown", panels: "menuPanels", minimal: "menuMinimal", plain: "menuPlain", mega: "menuMega", overlay: "menuOverlay" };
    const name = (key) => t(key).toLowerCase();
    let preview = null;
    if (activeTab === "menu") preview = menuPreview(draft.menu_style, t("wireMenu")(name(MENUS[draft.menu_style] || "menuDropdown")));
    else if (activeTab === "navigation") {
        const extras = draft.footer_style === "harbor" ? [draft.footer_wordmark && name("footerWordmark"), draft.footer_gradient && name("footerGradient")].filter(Boolean) : [];
        preview = footerPreview({ style: draft.footer_style, wordmark: !!draft.footer_wordmark, gradient: !!draft.footer_gradient },
            t("wireFooter")([name(draft.footer_style === "harbor" ? "footerHarbor" : "footerClassic"), ...extras].join(", ")));
    } else if (activeTab === "notifications") {
        const mode = cookieDraft?.mode === "consent" ? "consent" : "notice";
        preview = cookiePreview(mode, t("wireCookie")(name(mode === "consent" ? "cookieConsent" : "cookieNotice")));
    }
    root.querySelector(".kalq-styles__content").classList.toggle("is-single", activeTab !== "images" && !preview);
    if (activeTab === "images") map.replaceChildren(el("h4", { textContent: t("sitemap") }), sitemapNode());
    else if (preview) map.replaceChildren(el("h4", { textContent: t("wirePreview") }), el("div", { className: "kalq-styles__wire" }, preview),
        el("p", { className: "kalq-styles__inherited", textContent: preview.getAttribute("aria-label").replace(/^[^:]+:\s*/, "") }));
    else map.replaceChildren();
}

// New draft from an existing variant: same look, next free letter, never the default. A new style (not a duplicate)
// starts with menu A, the minimal bar (old/KALQ_MODULE_LIBRARY_SPEC.md 1.2)
async function createFrom(source, name, overrides = {}) {
    const free = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !variants.some((v) => v.letter === l));
    if (!free) return;
    const { id, updated_at, ...data } = normalize(clone(source));
    try {
        const { variant } = await api({ action: "save", data: { ...data, ...overrides, letter: free, name: name || `Variant ${free}`, status: "draft", is_default: false, sort: Math.max(0, ...variants.map((v) => v.sort || 0)) + 1 } });
        selectedId = variant.id;
        await after();
        // Stored as a draft until saved; the switch starts on, so Save puts it live
        if (draft?.id === variant.id) { draft.status = "published"; dirty = true; render(); }
    } catch (error) { collab.toast(errorText(error), "error"); }
}

function togglePreview(on) {
    previewOn = on;
    if (on && draft) applyVariant(draft, { preview: true });
    else endPreview();
}

function setOpen(open, { keepPreview = false } = {}) {
    const wasMinimized = root.classList.contains("is-minimized");
    root.classList.toggle("is-open", open);
    root.classList.remove("is-minimized");
    root.toggleAttribute("inert", !open);
    document.documentElement.classList.toggle("kalq-scroll-lock", open); // the page stays put underneath
    button.setAttribute("aria-pressed", open);
    if (open && !wasMinimized) { cookieDraft = null; refresh(); }
    else if (open) render();
    else if (previewOn && !keepPreview) togglePreview(false);
}

// "View page": the panel steps aside, the preview stays on; S or the palette brings it back as it was
function minimize() {
    setOpen(false, { keepPreview: true });
    root.classList.add("is-minimized");
}

export function initStyles(api_) {
    collab = api_;
    root = el("aside", { className: "kalq-styles" });
    root.setAttribute("inert", "");
    root.setAttribute("aria-label", t("title"));
    const close = el("button", { type: "button", className: "kalq-panel__close", innerHTML: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' });
    close.addEventListener("click", () => setOpen(false));
    root.append(
        el("div", { className: "kalq-styles__head" }, el("strong", { textContent: t("title") }), el("div", { className: "kalq-styles__variants" }), close),
        el("div", { className: "kalq-styles__content" }, el("div", { className: "kalq-styles__settings" }), el("div", { className: "kalq-styles__map" })),
    );
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    document.body.append(root);

    button = el("button", { type: "button", className: "kalq-toolbar__btn" });
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.8-1.8 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.1a3.9 3.9 0 0 0 3.9-3.9C20.5 6.6 16.7 3.5 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7.6" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.4" r="1.2" fill="currentColor"/><circle cx="15" cy="7.6" r="1.2" fill="currentColor"/></svg>';
    button.title = t("open");
    button.setAttribute("aria-label", t("open"));
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => setOpen(!root.classList.contains("is-open")));
    collab.addTool(button, 35);
    collab.on("key:s", () => button.click());
    collab.on("variants", () => { if (root.classList.contains("is-open") && !previewOn) refresh(); });
    document.addEventListener("kalq:language", () => { if (root.classList.contains("is-open")) render(); });
}
