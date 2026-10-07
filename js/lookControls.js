// The site's look, for good: the logo (and what moves behind the hero's title), the menu, the footer (Navigation), the
// colours and the fonts. Their controls live here and are used twice: by the editor's whole-site group (js/picker.js),
// where each is a panel of its own with its Save, and by the Styles panel of the multi-style phase (js/styles.js). When
// the winning style is locked and Styles goes, these panels stay: they edit the style the page shows (then the only
// one). Saved through /api/variants like every style (admins only; other editors are told so).
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { EDITOR_LANG } from "./i18n.js";
import { uploadMedia } from "./upload.js";
import { getActive, loadVariants, logoNode } from "./variants.js";
import { footerPreview, menuPreview } from "./stylePreview.js";

const TEXT = {
    de: {
        logo: "Logo", logoFile: "SVG-Datei", logoCode: "oder SVG-Code einfügen", logoStripped: "Unsichere Teile wurden entfernt.", logoInvalid: "Kein gültiges SVG.",
        builtInLogo: "Standard: Kalq-Logo", heroMark: "Mitte im Hero (Start)", heroMarkLogo: "Logo", heroMarkLine: "Linie", heroLine: "Form der Linie",
        lines: { back: "Diagonal \\", forward: "Diagonal /", vertical: "Senkrecht", horizontal: "Waagerecht", circle: "Kreis" },
        menu: "Menü", menuDropdown: "Dropdown", menuPanels: "Panels", menuMinimal: "Leiste mit Button", menuPlain: "Leiste", menuMega: "Mega-Menü", menuOverlay: "Vollbild",
        footer: "Footer", footerClassic: "Klassisch", footerHarbor: "Kontakt und Links", footerWordmark: "Großer Schriftzug", footerGradient: "Bewegter Verlauf",
        colors: "Farben", c_bg: "Hintergrund", c_text: "Text", c_accent: "Akzent", c_light: "Hell", c_dark: "Dunkel",
        fonts: "Schriften", heading: "Hauptschrift: Logo, H1 bis H3", body: "Zweitschrift: Unterzeilen, H4, H5, Text", builtIn: "Clash Grotesk (Standard)", google: "Google Fonts", ownFont: "Eigene woff2",
        wirePreview: "Vorschau", wireMenu: (n) => `Vorschau: Menü ${n}`, wireFooter: (n) => `Vorschau: Footer ${n}`, sample: "Vorschau",
        panels: {
            logo: ["Logo", "Das Logo oben links auf jeder Seite und was in der Mitte des Heros auf der Startseite steht."],
            navigation: ["Menü", "Wie das Hauptmenü aussieht und sich öffnet, auf jeder Seite."],
            footers: ["Navigation", "Der Footer am Ende jeder Seite: Kontakt, Links und Schriftzug."],
            style: ["Farben und Schrift", "Die Farben und Schriften der ganzen Website."],
        },
        forStyle: (l, n) => `Gilt für Stil ${l} (${n}), den die Seite gerade zeigt.`, save: "Speichern", saved: "Gespeichert", failed: "Speichern fehlgeschlagen",
        loading: "Wird geladen …", loadFailed: "Konnte nicht geladen werden.", adminsOnly: "Das stellen Admins ein.", none: "Noch kein Stil angelegt.",
    },
    en: {
        logo: "Logo", logoFile: "SVG file", logoCode: "or paste SVG code", logoStripped: "Unsafe parts were removed.", logoInvalid: "Not a valid SVG.",
        builtInLogo: "Default: Kalq logo", heroMark: "Centre of the hero (Home)", heroMarkLogo: "Logo", heroMarkLine: "Line", heroLine: "Line shape",
        lines: { back: "Diagonal \\", forward: "Diagonal /", vertical: "Vertical", horizontal: "Horizontal", circle: "Circle" },
        menu: "Menu", menuDropdown: "Dropdown", menuPanels: "Panels", menuMinimal: "Bar with button", menuPlain: "Bar", menuMega: "Mega menu", menuOverlay: "Fullscreen",
        footer: "Footer", footerClassic: "Classic", footerHarbor: "Contact and links", footerWordmark: "Large wordmark", footerGradient: "Moving gradient",
        colors: "Colours", c_bg: "Background", c_text: "Text", c_accent: "Accent", c_light: "Light", c_dark: "Dark",
        fonts: "Fonts", heading: "Main font: logo, H1 to H3", body: "Secondary font: sub-lines, H4, H5, text", builtIn: "Clash Grotesk (default)", google: "Google Fonts", ownFont: "Own woff2",
        wirePreview: "Preview", wireMenu: (n) => `Preview: menu ${n}`, wireFooter: (n) => `Preview: footer ${n}`, sample: "Preview",
        panels: {
            logo: ["Logo", "The logo at the top left of every page and what sits in the middle of Home's hero."],
            navigation: ["Menu", "How the main menu looks and opens, on every page."],
            footers: ["Navigation", "The footer at the end of every page: contact, links and wordmark."],
            style: ["Colours & fonts", "The colours and fonts of the whole site."],
        },
        forStyle: (l, n) => `For style ${l} (${n}), the one the page shows.`, save: "Save", saved: "Saved", failed: "Could not save",
        loading: "Loading …", loadFailed: "Could not be loaded.", adminsOnly: "Admins set this.", none: "No style yet.",
    },
};
const t = (key) => TEXT[EDITOR_LANG][key];

export const COLORS = ["bg", "text", "accent", "light", "dark"];
export const DEFAULT_COLORS = { bg: "#ffffff", text: "#101010", accent: "#3b82f6", light: "#ffffff", dark: "#101010" };
export const GOOGLE_SUGGESTIONS = ["Inter", "Space Grotesk", "Manrope", "DM Sans", "Sora", "Outfit", "Archivo", "IBM Plex Sans", "Work Sans", "Syne", "Playfair Display", "Fraunces", "Instrument Serif", "JetBrains Mono"];
const MENUS = [["dropdown", "menuDropdown"], ["panels", "menuPanels"], ["minimal", "menuMinimal"], ["plain", "menuPlain"], ["mega", "menuMega"], ["overlay", "menuOverlay"]];

// Every field present, whatever the server sent: empty means "the site's own" (logo, fonts, video, images)
export function normalize(v) {
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
        menu_style: MENUS.some(([m]) => m === v.menu_style) ? v.menu_style : "dropdown",
        footer_style: v.footer_style === "harbor" ? "harbor" : "classic",
        footer_wordmark: v.footer_wordmark === true,
        footer_gradient: v.footer_gradient === true,
        colors: { ...DEFAULT_COLORS, ...(v.colors || {}) },
        fonts: { heading: font(v.fonts?.heading), body: font(v.fonts?.body) },
        hero_video: v.hero_video || "",
        images: { ...(v.images || {}) },
    };
}

export const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};
const field = (label, input) => el("label", { className: "kalq-styles__field" }, el("span", { textContent: label }), input);

// A row of choices, one pressed (icons: [value, label, svg])
function seg(items, current, onPick, extra = "") {
    const box = el("div", { className: `kalq-seg ${extra}`.trim(), role: "group" });
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
}

// The site's own Kalq mark, for a style without its own logo
function builtInMark(color) {
    const mark = document.querySelector(".site-logo__mark")?.cloneNode(true);
    if (!mark) return null;
    mark.removeAttribute("data-animated");
    mark.setAttribute("class", "kalq-styles__mark");
    mark.style.color = color;
    return mark;
}

//=================================== The controls ===================================//
// ctx: { draft, changed() (an edit), redraw() (a wireframe follows), upload(file, kind) → url, toast(text, kind) }

// The logo: an SVG file or pasted code (sanitised), previewed on dark and light in the style's colours
export function logoControls(ctx) {
    const { draft } = ctx;
    const previews = el("div", { className: "kalq-styles__logos" });
    const note = el("p", { className: "kalq-styles__note" });
    const code = el("textarea", { rows: 4, placeholder: "<svg …>…</svg>", value: draft.logo_svg || "", spellcheck: false });
    const show = (raw) => {
        const clean = raw ? sanitizeSvg(raw) : "";
        note.textContent = raw && !clean ? t("logoInvalid") : raw && clean.length < raw.replace(/\s+/g, " ").length * 0.98 && /script|on\w+=|href=|url\(|foreignObject|style/i.test(raw) ? t("logoStripped") : "";
        previews.replaceChildren(...["dark", "light"].map((tone) => {
            const tile = el("div", { className: `kalq-styles__logo is-${tone}` });
            tile.style.background = tone === "dark" ? draft.colors.dark : draft.colors.bg;
            const node = clean ? logoNode(clean) : builtInMark(tone === "dark" ? draft.colors.light : draft.colors.text);
            tile.append(node || el("span", { textContent: "KALQ" }));
            return tile;
        }));
        return clean;
    };
    const inherited = el("p", { className: "kalq-styles__inherited", textContent: draft.logo_svg ? "" : t("builtInLogo") });
    code.addEventListener("input", () => { draft.logo_svg = show(code.value); inherited.textContent = code.value.trim() ? "" : t("builtInLogo"); ctx.changed(); });
    code.addEventListener("keydown", (e) => e.stopPropagation());
    const file = el("input", { type: "file", accept: ".svg,image/svg+xml" });
    file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        code.value = await f.text(); // the same sanitiser as pasted code
        code.dispatchEvent(new Event("input"));
    });
    show(draft.logo_svg);
    return el("section", {}, el("h4", { textContent: t("logo") }), field(t("logoFile"), file), field(t("logoCode"), code), note, inherited, previews);
}

// What moves behind the title on Home: a line in one of five shapes, or the logo
export function heroMarkControls(ctx) {
    const { draft } = ctx;
    const icon = (inner) => `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
    const shapes = seg([
        ["back", t("lines").back, icon('<line x1="4" y1="4" x2="16" y2="16"/>')],
        ["forward", t("lines").forward, icon('<line x1="16" y1="4" x2="4" y2="16"/>')],
        ["vertical", t("lines").vertical, icon('<line x1="10" y1="3" x2="10" y2="17"/>')],
        ["horizontal", t("lines").horizontal, icon('<line x1="3" y1="10" x2="17" y2="10"/>')],
        ["circle", t("lines").circle, icon('<circle cx="10" cy="10" r="6.5"/>')],
    ], draft.hero_line, (v) => { draft.hero_line = v; ctx.changed(); }, "is-icons");
    // a div, not a <label>: a click on the label text would press the first shape
    const shapeField = el("div", { className: "kalq-styles__field" }, el("span", { textContent: t("heroLine") }), shapes);
    shapeField.hidden = draft.hero_mark === "logo";
    const mode = seg([["line", t("heroMarkLine")], ["logo", t("heroMarkLogo")]], draft.hero_mark, (v) => { draft.hero_mark = v; shapeField.hidden = v === "logo"; ctx.changed(); });
    return el("section", {}, el("h4", { textContent: t("heroMark") }), mode, shapeField);
}

// The main menu's style
export function menuControls(ctx) {
    const { draft } = ctx;
    const menu = seg(MENUS.map(([v, k]) => [v, t(k)]), draft.menu_style, (v) => { draft.menu_style = v; ctx.changed(); ctx.redraw?.(); });
    menu.classList.add("is-wrap");
    return el("section", {}, el("h4", { textContent: t("menu") }), menu);
}

// The footer for the whole site: the classic one or the library's (contact, links, social, legal line), with an
// optional large wordmark and a slowly moving gradient behind it
export function footerControls(ctx) {
    const { draft } = ctx;
    const toggle = (key, label) => {
        const b = el("button", { type: "button", className: "kalq-seg__item", textContent: label });
        b.setAttribute("aria-pressed", draft[key] === true);
        b.addEventListener("click", () => { draft[key] = !draft[key]; b.setAttribute("aria-pressed", draft[key]); ctx.changed(); ctx.redraw?.(); });
        return b;
    };
    const extras = el("div", { className: "kalq-seg", role: "group" }, toggle("footer_wordmark", t("footerWordmark")), toggle("footer_gradient", t("footerGradient")));
    const footer = seg([["classic", t("footerClassic")], ["harbor", t("footerHarbor")]], draft.footer_style, (v) => { draft.footer_style = v; extras.hidden = v !== "harbor"; ctx.changed(); ctx.redraw?.(); });
    extras.hidden = draft.footer_style !== "harbor";
    return el("section", {}, el("h4", { textContent: t("footer") }), footer, extras);
}

// The five colours, each with a picker and a hex field
export function colourControls(ctx) {
    const { draft } = ctx;
    const rows = COLORS.map((name) => {
        const picker = el("input", { type: "color", value: draft.colors[name] });
        const hex = el("input", { type: "text", value: draft.colors[name], maxLength: 7, spellcheck: false, className: "kalq-styles__hex" });
        const set = (value) => { draft.colors[name] = value.toLowerCase(); ctx.changed(); ctx.redraw?.(); };
        picker.addEventListener("input", () => { hex.value = picker.value; set(picker.value); });
        hex.addEventListener("input", () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { picker.value = hex.value; set(hex.value); } });
        hex.addEventListener("keydown", (e) => e.stopPropagation());
        return el("div", { className: "kalq-styles__color" }, picker, hex, el("span", { textContent: t(`c_${name}`) }));
    });
    return el("section", {}, el("h4", { textContent: t("colors") }), ...rows);
}

// One font: built in, from Google Fonts by name, or an own woff2 uploaded
export function fontControl(ctx, part) {
    const { draft } = ctx;
    const font = draft.fonts[part] || { source: "default" };
    draft.fonts[part] = font;
    const source = el("select", {}, ...[["default", t("builtIn")], ["google", t("google")], ["upload", t("ownFont")]].map(([v, l]) => el("option", { value: v, textContent: l, selected: font.source === v })));
    const family = el("input", { type: "text", value: font.family || "", maxLength: 40, placeholder: "Space Grotesk" });
    family.setAttribute("list", "kalq-google-fonts");
    const file = el("input", { type: "file", accept: ".woff2,font/woff2" });
    // the main font's sample includes the wordmark it will set
    const sample = el("p", { className: "kalq-styles__sample", textContent: part === "heading" ? "KALQ · Ein technischer Kern." : "Bessere industrielle Entscheidungen." });
    const sync = () => {
        family.hidden = font.source === "default";
        file.hidden = font.source !== "upload";
        sample.style.fontFamily = font.family ? `"${font.family}"` : "";
    };
    source.addEventListener("change", () => { font.source = source.value; if (source.value === "default") { font.family = ""; delete font.url; } sync(); ctx.changed(); });
    family.addEventListener("input", () => { font.family = family.value.trim(); sync(); ctx.changed(); });
    family.addEventListener("keydown", (e) => e.stopPropagation());
    file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        try {
            font.url = await ctx.upload(f, "fonts");
            if (!font.family) { font.family = f.name.replace(/\.woff2$/i, "").replace(/[^A-Za-z0-9 ]+/g, " ").trim().slice(0, 40); family.value = font.family; }
            sync(); ctx.changed();
        } catch (error) { ctx.toast(error?.message || t("failed"), "error"); }
    });
    sync();
    return el("div", { className: "kalq-styles__font" }, el("strong", { textContent: t(part) }), source, family, file, sample);
}
export const fontControls = (ctx) => el("section", {}, el("h4", { textContent: t("fonts") }), fontControl(ctx, "heading"), fontControl(ctx, "body"));
export const fontSuggestions = () => el("datalist", { id: "kalq-google-fonts" }, ...GOOGLE_SUGGESTIONS.map((f) => el("option", { value: f })));

// The wireframe beside the menu and the footer (js/stylePreview.js)
export function lookWire(kind, draft) {
    const name = (key) => t(key).toLowerCase();
    if (kind === "menu") return menuPreview(draft.menu_style, t("wireMenu")(name(MENUS.find(([m]) => m === draft.menu_style)?.[1] || "menuDropdown")));
    if (kind === "footer") {
        const extras = draft.footer_style === "harbor" ? [draft.footer_wordmark && name("footerWordmark"), draft.footer_gradient && name("footerGradient")].filter(Boolean) : [];
        return footerPreview({ style: draft.footer_style, wordmark: !!draft.footer_wordmark, gradient: !!draft.footer_gradient },
            t("wireFooter")([name(draft.footer_style === "harbor" ? "footerHarbor" : "footerClassic"), ...extras].join(", ")));
    }
    return null;
}

//=================================== The editor's panels ===================================//
// One panel of the whole-site group: logo, navigation (the menu), footers (the footer), style (colours and fonts). It
// edits the style the page shows: its own copy, saved with its own Save as a version of that style.
export const LOOK_PANELS = ["logo", "navigation", "footers", "style"];

async function api(body) {
    const res = await fetch("/api/variants", { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || "failed"), { info: out });
    return out;
}

export function lookPanel(kind, collab) {
    const [title, intro] = t("panels")[kind];
    const body = el("div", { className: "kalq-look__body" }, el("p", { className: "kalq-site__hint", textContent: t("loading") }));
    const panel = el("section", { className: `kalq-site kalq-site--look is-${kind}` },
        el("h3", { className: "kalq-site__title", textContent: title }), el("p", { className: "kalq-site__intro", textContent: intro }), body);
    (async () => {
        let data;
        try { data = await api(); } catch { return body.replaceChildren(el("p", { className: "kalq-site__hint", textContent: t("loadFailed") })); }
        if (!data.admin) return body.replaceChildren(el("p", { className: "kalq-site__hint", textContent: t("adminsOnly") }));
        const variants = (data.variants || []).map(normalize);
        const shown = variants.find((v) => v.id === getActive()?.id) || variants.find((v) => v.is_default) || variants[0];
        if (!shown) return body.replaceChildren(el("p", { className: "kalq-site__hint", textContent: t("none") }));
        const draft = JSON.parse(JSON.stringify(shown));
        let dirty = false;
        const wireBox = el("div", { className: "kalq-look__wire" });
        const wireKind = kind === "navigation" ? "menu" : kind === "footers" ? "footer" : null;
        const redraw = () => { if (wireKind) wireBox.replaceChildren(lookWire(wireKind, draft)); };
        const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("save"), disabled: true });
        const ctx = {
            draft,
            changed: () => { dirty = true; save.disabled = false; },
            redraw,
            upload: (file, sub) => uploadMedia(collab.sb, `variants/${draft.id}/${sub}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60)}`, file),
            toast: (text, type) => collab.toast(text, type),
        };
        const controls = { logo: () => [logoControls(ctx), heroMarkControls(ctx)], navigation: () => [menuControls(ctx)], footers: () => [footerControls(ctx)],
            style: () => [colourControls(ctx), fontControls(ctx), fontSuggestions()] }[kind]();
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                await api({ action: "save", id: draft.id, data: draft });
                dirty = false;
                collab.broadcast("variants", { at: Date.now() }, { site: true });
                await loadVariants(); // the page takes the saved look
                collab.toast(t("saved"));
            } catch (error) { console.error("look", error); collab.toast(t("failed"), "error"); save.disabled = !dirty; }
        });
        redraw();
        const which = variants.filter((v) => v.status === "published").length > 1 ? el("p", { className: "kalq-site__hint kalq-look__which", textContent: t("forStyle")(shown.letter, shown.name) }) : null;
        body.replaceChildren(...[which, el("div", { className: `kalq-look__grid${wireKind ? " has-wire" : ""}` }, el("div", { className: "kalq-look__controls" }, ...controls), wireKind ? wireBox : null),
            el("div", { className: "kalq-site__actions" }, save)].filter(Boolean));
    })();
    return panel;
}
