// Styles panel (admins only): create and edit style variants. Colours with pickers and hex fields, fonts (built-in,
// Google Fonts or an uploaded woff2), logo as SVG file or pasted code (sanitised, previewed on dark and light),
// hero video and per-image replacements uploaded to Supabase Storage. Draft or published, one default, every save
// is a version that can be restored.
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { currentLang } from "./i18n.js";
import { applyVariant, endPreview, getActive, loadVariants, logoNode } from "./variants.js";

const TEXT = {
    de: {
        title: "Stile", open: "Stile (S)", create: "Neue Variante", letter: "Buchstabe", name: "Name", status: "Status",
        draft: "Entwurf", published: "Veröffentlicht", isDefault: "Standard", logo: "Logo", logoFile: "SVG-Datei", logoCode: "oder SVG-Code einfügen",
        logoStripped: "Unsichere Teile wurden entfernt.", logoInvalid: "Kein gültiges SVG.", colors: "Farben",
        c_bg: "Hintergrund", c_text: "Text", c_accent: "Akzent", c_light: "Hell", c_dark: "Dunkel",
        fonts: "Schriften", heading: "Überschriften", body: "Fließtext", builtIn: "Clash Grotesk (Standard)", google: "Google Fonts", upload: "Eigene woff2",
        family: "Schriftname", fontFile: "woff2-Datei", hero: "Hero-Video", images: "Bilder", imagesHint: "Leer lassen für das Standardbild.",
        upload: "Hochladen", clear: "Entfernen", preview: "Vorschau", endPreview: "Vorschau beenden", save: "Speichern", remove: "Löschen",
        history: "Versionen", restore: "Wiederherstellen", saved: "Gespeichert", failed: "Speichern fehlgeschlagen", confirmDelete: "Diese Variante löschen? Sie bleibt in den Versionen.",
        errors: { letter_taken: "Dieser Buchstabe ist vergeben.", default_must_be_published: "Die Standard-Variante muss veröffentlicht sein.", choose_another_default: "Erst eine andere Variante zum Standard machen.", default_cannot_be_deleted: "Die Standard-Variante kann nicht gelöscht werden." },
    },
    en: {
        title: "Styles", open: "Styles (S)", create: "New variant", letter: "Letter", name: "Name", status: "Status",
        draft: "Draft", published: "Published", isDefault: "Default", logo: "Logo", logoFile: "SVG file", logoCode: "or paste SVG code",
        logoStripped: "Unsafe parts were removed.", logoInvalid: "Not a valid SVG.", colors: "Colours",
        c_bg: "Background", c_text: "Text", c_accent: "Accent", c_light: "Light", c_dark: "Dark",
        fonts: "Fonts", heading: "Headings", body: "Body text", builtIn: "Clash Grotesk (default)", google: "Google Fonts", upload: "Own woff2",
        family: "Font name", fontFile: "woff2 file", hero: "Hero video", images: "Images", imagesHint: "Leave empty for the default image.",
        upload: "Upload", clear: "Remove", preview: "Preview", endPreview: "End preview", save: "Save", remove: "Delete",
        history: "Versions", restore: "Restore", saved: "Saved", failed: "Could not save", confirmDelete: "Delete this variant? It stays in the versions.",
        errors: { letter_taken: "That letter is taken.", default_must_be_published: "The default variant must be published.", choose_another_default: "Make another variant the default first.", default_cannot_be_deleted: "The default variant cannot be deleted." },
    },
};
const t = (key) => TEXT[currentLang() === "en" ? "en" : "de"][key];
const COLORS = ["bg", "text", "accent", "light", "dark"];
const GOOGLE_SUGGESTIONS = ["Inter", "Space Grotesk", "Manrope", "DM Sans", "Sora", "Outfit", "Archivo", "IBM Plex Sans", "Work Sans", "Syne", "Playfair Display", "Fraunces", "Instrument Serif", "JetBrains Mono"];

let collab, button, root, data = null, variants = [], slots = [], selectedId = null, draft = null, previewOn = false;

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

async function upload(file, kind) {
    const { data: auth } = await collab.sb.auth.getSession();
    if (!auth?.session) throw new Error("relogin");
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
    const path = `variants/${selectedId}/${kind}/${Date.now()}-${safe}`;
    const type = file.type || (safe.endsWith(".woff2") ? "font/woff2" : "application/octet-stream");
    const { error } = await collab.sb.storage.from("site-media").upload(path, file, { contentType: type, upsert: false });
    if (error) throw error;
    return collab.sb.storage.from("site-media").getPublicUrl(path).data.publicUrl;
}

async function refresh() {
    const res = await fetch("/api/variants", { credentials: "same-origin" });
    data = await res.json();
    variants = data.variants || [];
    slots = data.slots || [];
    if (!variants.find((v) => v.id === selectedId)) selectedId = (getActive() || variants[0])?.id || null;
    draft = selectedId ? clone(variants.find((v) => v.id === selectedId)) : null;
    render();
}

const changed = () => { if (previewOn) applyVariant(draft, { preview: true }); };

//=================================== Sections ===================================//
function headerSection() {
    const used = new Set(variants.filter((v) => v.id !== draft.id).map((v) => v.letter));
    const letter = el("select", {}, ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((l) => !used.has(l)).map((l) => el("option", { value: l, textContent: l, selected: l === draft.letter })));
    letter.addEventListener("change", () => { draft.letter = letter.value; });
    const name = el("input", { type: "text", value: draft.name || "", maxLength: 40 });
    name.addEventListener("input", () => { draft.name = name.value; });
    const status = el("select", {}, el("option", { value: "draft", textContent: t("draft"), selected: draft.status !== "published" }), el("option", { value: "published", textContent: t("published"), selected: draft.status === "published" }));
    status.addEventListener("change", () => { draft.status = status.value; });
    const def = el("input", { type: "checkbox", checked: !!draft.is_default });
    def.addEventListener("change", () => { draft.is_default = def.checked; });
    return el("div", { className: "kalq-styles__row" }, field(t("letter"), letter), field(t("name"), name), field(t("status"), status),
        el("label", { className: "kalq-styles__check" }, def, el("span", { textContent: t("isDefault") })));
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
            const node = clean ? logoNode(clean) : null;
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
    return el("section", {}, el("h4", { textContent: t("logo") }), field(t("logoFile"), file), field(t("logoCode"), code), note, previews);
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
    const sample = el("p", { className: "kalq-styles__sample", textContent: "Kalq · Ein technischer Kern." });
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

function mediaSlot(label, get, set, accept) {
    const thumb = el("div", { className: "kalq-styles__thumb" });
    const draw = () => {
        const url = get();
        thumb.replaceChildren(url ? (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? el("video", { src: url, muted: true, loop: true, autoplay: true, playsInline: true }) : el("img", { src: url, alt: "" })) : el("span", { textContent: "—" }));
    };
    const file = el("input", { type: "file", accept });
    file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        try { set(await upload(f, "media")); draw(); changed(); } catch (error) { collab.toast(errorText(error), "error"); }
    });
    const clear = el("button", { type: "button", className: "kalq-btn", textContent: t("clear") });
    clear.addEventListener("click", () => { set(""); draw(); changed(); });
    draw();
    return el("div", { className: "kalq-styles__slot" }, thumb, el("span", { className: "kalq-styles__slotname", textContent: label }), file, clear);
}

function mediaSection() {
    draft.images ||= {};
    const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm";
    const hero = mediaSlot(t("hero"), () => draft.hero_video, (url) => { draft.hero_video = url; }, ACCEPT);
    const list = slots.filter((s) => s.key !== "home.hero.video").map((s) => mediaSlot(s.key, () => draft.images[s.key] || "", (url) => { if (url) draft.images[s.key] = url; else delete draft.images[s.key]; }, ACCEPT));
    return el("section", {}, el("h4", { textContent: t("hero") }), hero, el("h4", { textContent: t("images") }), el("p", { className: "kalq-styles__note", textContent: t("imagesHint") }), ...list);
}

async function historySection(box) {
    const res = await fetch(`/api/variants?history=${encodeURIComponent(draft.id)}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const { versions = [] } = await res.json();
    box.replaceChildren(el("h4", { textContent: t("history") }), ...versions.map((v, i) => {
        const row = el("div", { className: "kalq-styles__version" },
            el("span", { textContent: `${new Date(v.created_at).toLocaleString(currentLang() === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" })} · ${v.label || ""}` }));
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
    collab.broadcast("variants", { at: Date.now() });
    await loadVariants();
    await refresh();
    collab.toast(t("saved"));
}

function render() {
    if (!root) return;
    const list = el("div", { className: "kalq-styles__list" }, ...variants.map((v) => {
        const b = el("button", { type: "button", className: "kalq-styles__card" }, el("span", { className: "kalq-styles__letter", textContent: v.letter }), el("span", { textContent: v.name || "" }),
            el("small", { textContent: `${v.status === "published" ? t("published") : t("draft")}${v.is_default ? ` · ${t("isDefault")}` : ""}` }));
        b.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        b.setAttribute("aria-pressed", v.id === selectedId);
        b.addEventListener("click", () => { selectedId = v.id; draft = clone(v); if (previewOn) applyVariant(draft, { preview: true }); render(); });
        return b;
    }));
    const create = el("button", { type: "button", className: "kalq-btn", textContent: `+ ${t("create")}` });
    create.addEventListener("click", async () => {
        const free = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !variants.some((v) => v.letter === l));
        const base = clone(getActive() || variants[0] || {});
        try {
            const { variant } = await api({ action: "save", data: { ...base, letter: free, name: `Variant ${free}`, status: "draft", is_default: false } });
            selectedId = variant.id;
            await after();
        } catch (error) { collab.toast(errorText(error), "error"); }
    });
    const body = el("div", { className: "kalq-styles__body" });
    if (draft) {
        const history = el("section", { className: "kalq-styles__history" });
        const save = el("button", { type: "button", className: "kalq-btn kalq-btn--primary", textContent: t("save") });
        save.addEventListener("click", async () => {
            save.disabled = true;
            try { await api({ action: "save", id: draft.id, data: draft }); if (previewOn) togglePreview(false); await after(); }
            catch (error) { collab.toast(errorText(error), "error"); }
            finally { save.disabled = false; }
        });
        const preview = el("button", { type: "button", className: "kalq-btn", textContent: previewOn ? t("endPreview") : t("preview") });
        preview.addEventListener("click", () => { togglePreview(!previewOn); render(); });
        const del = el("button", { type: "button", className: "kalq-btn", textContent: t("remove") });
        del.addEventListener("click", async () => {
            if (!window.confirm(t("confirmDelete"))) return;
            try { await api({ action: "delete", id: draft.id }); selectedId = null; await after(); } catch (error) { collab.toast(errorText(error), "error"); }
        });
        body.append(headerSection(), logoSection(), colorSection(), el("section", {}, el("h4", { textContent: t("fonts") }), fontRow("heading"), fontRow("body")), mediaSection(),
            el("div", { className: "kalq-styles__actions" }, preview, del, save), history);
        historySection(history);
    }
    const datalist = el("datalist", { id: "kalq-google-fonts" }, ...GOOGLE_SUGGESTIONS.map((f) => el("option", { value: f })));
    root.querySelector(".kalq-styles__content").replaceChildren(el("div", { className: "kalq-styles__top" }, list, create), body, datalist);
}

function togglePreview(on) {
    previewOn = on;
    if (on && draft) applyVariant(draft, { preview: true });
    else endPreview();
}

function setOpen(open) {
    root.classList.toggle("is-open", open);
    root.toggleAttribute("inert", !open);
    button.setAttribute("aria-pressed", open);
    if (open) refresh();
    else if (previewOn) togglePreview(false);
}

export function initStyles(api_) {
    collab = api_;
    root = el("aside", { className: "kalq-styles" });
    root.setAttribute("inert", "");
    root.setAttribute("aria-label", t("title"));
    const close = el("button", { type: "button", className: "kalq-panel__close", innerHTML: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' });
    close.addEventListener("click", () => setOpen(false));
    root.append(el("div", { className: "kalq-panel__head" }, el("strong", { textContent: t("title") }), close), el("div", { className: "kalq-styles__content" }));
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
