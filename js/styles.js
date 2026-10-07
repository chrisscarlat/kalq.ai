// Styles panel (admins only): create and edit style variants. Colours with pickers and hex fields, fonts (built-in,
// Google Fonts or an uploaded woff2), logo as SVG file or pasted code (sanitised, previewed on dark and light),
// hero video and per-image replacements uploaded to Supabase Storage. Draft or published, one default, every save
// is a version that can be restored. The settings are in tabs, each with a small title saying what it controls:
// Images, Logos, Menu, Navigation, Colours and fonts. The insert picker's left menu opens it at a tab (kalq:open-styles).
import { EDITOR_LANG } from "./i18n.js";
import { progressLine, showDone, uploadMedia } from "./upload.js";
import { applyVariant, endPreview, getActive, loadVariants } from "./variants.js";
import { refreshStyleMedia, setLocalContent, storedEntry } from "./content.js";
import { isStyleKey, styleKey } from "./styleMedia.js";
import { colourControls, fontControl, footerControls, fontSuggestions, heroMarkControls, logoControls, lookWire, menuControls, normalize } from "./lookControls.js";
// The cookie bar's settings are in the insert picker's left menu now (js/siteSettings.js), with the chat's.

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
        sitemap: "Seiten", replaceSlot: "Ersetzen", uploading: "Wird hochgeladen", spreadImages: "Auf alle Bildplätze übertragen", spreadHero: "Als Hero der Startseite",
        spreadDone: (n) => `Auf ${n} Plätze übertragen.`, addMedia: "+ Bild oder Video", resetSlot: "Zurück zum Standard",
        fillAll: "Alles füllen", fillHint: "Ein Video wird überall zum Hero, ein Bild füllt jeden Bildplatz. Danach einzeln ersetzbar.",
        filledHero: () => "Das Video ist jetzt der Hero der Startseite.", filledImages: (n) => `Bild in ${n} Bildplätzen.`,
        peek: "Seite ansehen", unsaved: "Nicht gespeichert",
        pages: { home: "Start", platform: "Plattform", company: "Unternehmen", impressum: "Impressum", datenschutz: "Datenschutz", site: "Ganze Seite: Menü" }, preview: "Vorschau", endPreview: "Vorschau beenden", save: "Speichern", remove: "Löschen",
        history: "Versionen", restore: "Wiederherstellen", saved: "Gespeichert", failed: "Speichern fehlgeschlagen", confirmDelete: "Diese Variante löschen? Sie bleibt in den Versionen.",
        tabs: { images: "Bilder", logos: "Logos", menu: "Menü", navigation: "Navigation", look: "Farben und Schrift" },
        tabTitles: { images: "Hero-Video, die Bildplätze aller Seiten und die Enthüllung über den Bildern", logos: "Das Logo der Variante und was in der Mitte des Heros steht",
            menu: "Wie das Hauptmenü aussieht und sich öffnet", navigation: "Der Footer: Kontakt, Links und Schriftzug am Ende jeder Seite",
            look: "Die Stile: hinzufügen, wechseln, Name und Status; die Farben und Schriften des gewählten Stils" },
        wirePreview: "Vorschau", wireMenu: (n) => `Vorschau: Menü ${n}`, wireFooter: (n) => `Vorschau: Footer ${n}`,
        styles: "Stile", editing: "Bearbeitet:", stylesOpen: "Stile hinzufügen, wechseln und bearbeiten",
        tabsLabel: "Bereiche",
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
        sitemap: "Pages", replaceSlot: "Replace", uploading: "Uploading", spreadImages: "Copy to all image slots", spreadHero: "Use as Home's hero",
        spreadDone: (n) => `Copied to ${n} slots.`, addMedia: "+ Image or video", resetSlot: "Back to default",
        fillAll: "Fill all", fillHint: "A video becomes the hero everywhere, an image fills every image slot. Replace single slots afterwards.",
        filledHero: () => "The video is now Home's hero.", filledImages: (n) => `Image in ${n} image slots.`,
        peek: "View page", unsaved: "Not saved",
        pages: { home: "Home", platform: "Platform", company: "Company", impressum: "Legal notice", datenschutz: "Privacy", site: "Whole site: menu" }, preview: "Preview", endPreview: "End preview", save: "Save", remove: "Delete",
        history: "Versions", restore: "Restore", saved: "Saved", failed: "Could not save", confirmDelete: "Delete this variant? It stays in the versions.",
        tabs: { images: "Images", logos: "Logos", menu: "Menu", navigation: "Navigation", look: "Colours & fonts" },
        tabTitles: { images: "Hero video, the image slots of every page and the reveal over the images", logos: "The variant's logo and what sits in the middle of the hero",
            menu: "How the main menu looks and opens", navigation: "The footer: contact, links and wordmark at the end of every page",
            look: "The styles: add, switch, name and status; the colours and fonts of the selected style" },
        wirePreview: "Preview", wireMenu: (n) => `Preview: menu ${n}`, wireFooter: (n) => `Preview: footer ${n}`,
        styles: "Styles", editing: "Editing:", stylesOpen: "Add, switch and edit styles",
        tabsLabel: "Sections",
        errors: { letter_taken: "That letter is taken.", default_must_be_published: "The default variant must be published.", choose_another_default: "Make another variant the default first.", default_cannot_be_deleted: "The default variant cannot be deleted." },
    },
};
const t = (key) => TEXT[EDITOR_LANG][key];

let collab, button, root, data = null, variants = [], slots = [], defaults = {}, selectedId = null, draft = null, previewOn = false;
let activeTab = "images"; // the settings tab shown (kept while the panel is open)
const DEFAULT_HERO = "assets/video-hero-6mb-low.mp4";

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

const ctx = () => ({ draft, changed, redraw: drawPreview, upload: (file, kind) => upload(file, kind), toast: (text, type) => collab.toast(text, type) });
const logoSection = () => logoControls(ctx());
// What moves behind the title on Home: a line (toggle Linie) in one of five shapes, or the logo
const heroMarkSection = () => heroMarkControls(ctx());

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

// Menu and Navigation (the footer), colours and fonts: the look's controls (js/lookControls.js), shared with the editor
const menuSection = () => menuControls(ctx());
const footerSection = () => footerControls(ctx());
const colorSection = () => colourControls(ctx());
const fontRow = (part) => fontControl(ctx(), part);

//=================================== Sitemap ===================================//
// Every page side by side as a schematic in its real arrangement: hero on top, image slots as they sit on the
// page (one full width, two or three side by side, list rows), text as grey lines. Slots are live thumbnails.
// Heroes: Home's hero (and every Hero card module's background, js/mediaSlots.js); Platform's and Company's top
// pictures are ordinary images
const HERO_KEYS = ["home.hero.video"];
const CARDS = ["should-cost", "machine-intelligence", "supplier-fit", "manufacturing-cost", "rfq-award", "price-quote"]; // two columns, row by row
const SITEMAP = [
    { page: "home", items: [{ hero: "home.hero.video" }, { text: 4 }, { list: CARDS.map((c) => `home.platform.${c}.image`) }, { text: 3 }] },
    { page: "platform", items: [{ hero: "platform.hero.media" }, { text: 2 }, { full: "platform.header.image" }, { text: 3 }, { grid: CARDS.map((c) => `platform.cards.${c}.image`), cols: 2 }] },
    { page: "company", items: [{ hero: "company.hero.media" }, { text: 2 }, { full: "company.header.image" }, { text: 3 }, { grid: ["company.why.image1", "company.why.image2"], cols: 2 }, { text: 3 }, { full: "company.shared.image" }, { text: 2 }, { full: "company.prices.image" }] },
    { page: "impressum", items: [{ text: 9 }] },
    { page: "datenschutz", items: [{ text: 5 }] },
    { page: "site", items: [{ full: "site.nav.mega.card.image" }, { list: CARDS.map((c) => `site.nav.mega.${c}.image`) }] }, // the menu's pictures, on every page
];
const isVideo = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url || "");
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm";

// Pictures are the style's own blocks "<slot>@<style id>" (js/styleMedia.js), written at once (not with Save); until a
// style has its own, it shows its old replacement (images / hero_video in its record) or the page's own
const ownKey = (key) => styleKey(key, draft.id);
const slotUrl = (key) => (ownKey(key) in defaults ? defaults[ownKey(key)] : (key === "home.hero.video" ? draft.hero_video : draft.images[key])) || "";
const pending = new Map(); // slot → file, written by flushSlots
function setSlot(key, url) {
    defaults[ownKey(key)] = url;
    pending.set(key, url);
}
async function flushSlots(label) {
    if (!pending.size) return;
    const items = [...pending].map(([key, url]) => ({ key: ownKey(key), page: key.split(".")[0], type: isVideo(url) ? "video" : "image", content: url }));
    pending.clear();
    const { data } = await collab.sb.auth.getSession();
    if (!data?.session) throw new Error("relogin");
    const { error: blockError } = await collab.sb.from("blocks").upsert(items.map(({ key, page, type }) => ({ key, page, type })), { onConflict: "key", ignoreDuplicates: true });
    if (blockError) throw blockError;
    const batch = crypto.randomUUID();
    const { error } = await collab.sb.from("revisions").insert(items.map(({ key, page, content }) => ({ block_key: key, page, lang: null, content, author_id: data.session.user.id,
        batch_id: batch, batch_scope: "page", batch_label: `${label} (style ${draft.letter})` })));
    if (error) throw error;
    items.forEach(({ key, type, content }) => setLocalContent(key, null, content, type)); // this page shows it at once
    collab.broadcast("content", { keys: items.map((i) => i.key), color: collab.me.color });
    refreshStyleMedia(); // the page shows the shown style's new pictures
}
const inheritedUrl = (key) => defaults[key] || (key === "home.hero.video" ? DEFAULT_HERO : "");
const imageKeys = () => [...new Set([...SITEMAP.flatMap((p) => p.items.flatMap((i) => [...(i.list || i.grid || (i.full ? [i.full] : [])), ...(i.hero ? [i.hero] : [])])), ...slots.map((x) => x.key)])]
    .filter((k) => !HERO_KEYS.includes(k) && !isStyleKey(k));

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
        flushSlots(hero ? "Used one file for every hero" : "Used one file for every image").catch((error) => collab.toast(errorText(error), "error"));
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
            reset.addEventListener("click", (e) => { e.stopPropagation(); setSlot(key, ""); draw(); flushSlots(`Emptied ${key}`).catch((error) => collab.toast(errorText(error), "error")); });
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
            await flushSlots(`Edited ${key}`);
            lastUpload = { key, url };
            draw();
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
            await flushSlots("Filled every slot of a kind");
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
    const pick = (v) => { selectedId = v.id; draft = clone(v); dirty = false; if (previewOn) applyVariant(draft, { preview: true }); render(); };
    const list = el("div", { className: "kalq-styles__list" }, ...variants.map((v) => {
        const b = el("button", { type: "button", className: "kalq-styles__card" }, el("span", { className: "kalq-styles__letter", textContent: v.letter }), el("span", { textContent: v.name || "" }),
            el("small", { textContent: `${v.status === "published" ? t("published") : t("draft")}${v.is_default ? ` · ${t("isDefault")}` : ""}` }));
        b.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        b.setAttribute("aria-pressed", v.id === selectedId);
        b.addEventListener("click", () => pick(v));
        return b;
    }));
    // Right after the styles: + a new style (from the default one, A: today's look) and Duplicate the selected one; in
    // the head on every tab and in the Colours & fonts list
    const addButtons = () => {
        const create = el("button", { type: "button", className: "kalq-styles__add kalq-styles__create", textContent: "+", title: t("create") });
        create.setAttribute("aria-label", t("create"));
        create.addEventListener("click", () => { const base = variants.find((v) => v.is_default) || variants[0]; createFrom(base || normalize({ letter: "A" }), null, { menu_style: "minimal" }); });
        if (!draft) return [create];
        const copy = el("button", { type: "button", className: "kalq-styles__add kalq-styles__duplicate", textContent: t("duplicate"), title: `${t("duplicate")}: ${draft.letter} ${draft.name || ""}` });
        copy.addEventListener("click", () => createFrom(draft, t("copyOf")(draft.name)));
        return [create, copy];
    };
    list.append(...addButtons());
    // The head: every style as its letter on its colour (a click switches to it), then + and Duplicate, then the name of
    // the one being edited (a click opens its editor: Colours & fonts)
    const dots = variants.map((v) => {
        const d = el("button", { type: "button", className: "kalq-styles__dot", textContent: v.letter, title: `${v.letter} ${v.name || ""}${v.status === "published" ? "" : ` · ${t("draft")}`}` });
        d.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        d.setAttribute("aria-pressed", v.id === selectedId);
        d.setAttribute("aria-label", d.title);
        d.addEventListener("click", () => pick(v));
        return d;
    });
    const current = variants.find((v) => v.id === selectedId);
    const chip = current ? el("button", { type: "button", className: "kalq-styles__current", title: t("stylesOpen"), textContent: `${t("editing")} ${current.name || ""}` }) : null;
    chip?.addEventListener("click", () => { activeTab = "look"; render(); root.querySelector("#kalq-styles-tab-look")?.focus(); });
    root.querySelector(".kalq-styles__variants").replaceChildren(el("div", { className: "kalq-styles__dots", role: "group", ariaLabel: t("styles") }, ...dots), ...addButtons(), ...(chip ? [chip] : []));

    const settings = root.querySelector(".kalq-styles__settings");
    const map = root.querySelector(".kalq-styles__map");
    // no style yet: the editor still offers to make the first one
    if (!draft) { settings.replaceChildren(el("section", { className: "kalq-styles__styles" }, el("h4", { textContent: t("styles") }), list)); map.replaceChildren(); return; }

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
        // the style editor: every style (switch by a click), a new one, this one's letter, name and switches; then its look
        look: () => [el("section", { className: "kalq-styles__styles" }, el("h4", { textContent: t("styles") }), list, headerSection()),
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
        fontSuggestions());
    drawPreview();
    historySection(history);
}

// Beside the settings: the page map (every image slot) for Images; for Menu, Navigation and Notifications a wireframe
// of what is selected (js/stylePreview.js), redrawn on every choice. The other tabs take the full width.
function drawPreview() {
    const map = root?.querySelector(".kalq-styles__map");
    if (!map || !draft) return;
    const preview = activeTab === "menu" ? lookWire("menu", draft) : activeTab === "navigation" ? lookWire("footer", draft) : null;
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
    if (open && !document.dispatchEvent(new CustomEvent("kalq:layer", { detail: "styles", cancelable: true }))) return; // one layer at a time (the editor may keep unsaved modules)
    const wasMinimized = root.classList.contains("is-minimized");
    root.classList.toggle("is-open", open);
    root.classList.remove("is-minimized");
    root.toggleAttribute("inert", !open);
    document.documentElement.classList.toggle("kalq-scroll-lock", open); // the page stays put underneath
    button.setAttribute("aria-pressed", open);
    if (open && !wasMinimized) refresh();
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
    document.addEventListener("kalq:layer", (e) => { if (e.detail !== "styles" && e.detail !== "page" && root.classList.contains("is-open")) setOpen(false); });
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
    // the insert picker's Style, Navigation and Footers: this panel at that tab
    document.addEventListener("kalq:open-styles", (e) => {
        const tab = e.detail?.tab;
        if (["images", "logos", "menu", "navigation", "look"].includes(tab)) activeTab = tab;
        if (root.classList.contains("is-open")) render(); else setOpen(true);
    });
}
