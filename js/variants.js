// Style variants (public: every page, signed out too). Applying one sets CSS custom properties on :root, loads its
// fonts, swaps the header logo and its images or hero video. No reload; :root and the header persist across Barba.
// The choice is remembered in localStorage; the last applied look is also cached so the next page load starts in it.
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { applyDirect, setMediaOverride } from "./content.js";

const CHOICE_KEY = "kalq-variant";
const MODE_KEY = "kalq-mode"; // "light" | "dark"
const CACHE_KEY = "kalq-variant-look";
const FONT_FALLBACK = '"Clash Grotesk", "Helvetica Neue", Arial, sans-serif';

let variants = [];
let active = null;
let previewing = null; // a variant shown from the Styles panel without saving
const listeners = new Set();

const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { } },
};

export const getVariants = () => variants;

//=================================== Light and dark ===================================//
// Dark: every section uses the variant's dark set (dark background, light text); the dark sections lift a little
// so sections stay distinct, dividers follow. Light is the variant as designed.
let mode = store.get(MODE_KEY) === "dark" ? "dark" : "light";
export const getMode = () => mode;

const mix = (a, b, amount) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - amount) + ((pb >> shift) & 255) * amount);
    return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
};

function palette(colors) {
    const c = { bg: "#ffffff", text: "#101010", accent: "#3b82f6", light: "#ffffff", dark: "#101010", ...colors };
    if (mode !== "dark") return { "--kalq-bg": c.bg, "--kalq-text": c.text, "--kalq-accent": c.accent, "--kalq-light": c.light, "--kalq-dark": c.dark, "--kalq-line": null };
    return {
        "--kalq-bg": c.dark, "--kalq-text": c.light, "--kalq-accent": c.accent, "--kalq-light": c.light,
        "--kalq-dark": mix(c.dark, c.light, 0.07), "--kalq-line": mix(c.dark, c.light, 0.2),
    };
}

export function setMode(next) {
    mode = next === "dark" ? "dark" : "light";
    store.set(MODE_KEY, mode);
    const current = getActive();
    if (current) applyVariant(current, { preview: !!previewing });
    else document.documentElement.dataset.mode = mode;
}
export const getActive = () => previewing || active;
export const onVariantsChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn(getActive(), variants));

//=================================== Fonts ===================================//
const loadedFonts = new Set();
function fontStack(font) {
    if (!font || font.source === "default" || !font.family) return null;
    const id = `${font.source}:${font.family}:${font.url || ""}`;
    if (!loadedFonts.has(id)) {
        loadedFonts.add(id);
        if (font.source === "google") {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@200;300;400;500;600;700&display=swap`;
            document.head.append(link);
        } else if (font.source === "upload" && font.url && window.FontFace) {
            new FontFace(font.family, `url(${font.url})`).load().then((f) => document.fonts.add(f)).catch(() => { });
        }
    }
    return `"${font.family}", ${FONT_FALLBACK}`;
}

//=================================== Logo ===================================//
// In the header the logo is a white silhouette (the header inverts over light and dark), like the built-in mark
export function logoNode(svg) {
    const clean = sanitizeSvg(svg || "");
    if (!clean) return null;
    const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;
    return document.importNode(root, true);
}

function applyLogo(variant) {
    const logo = document.querySelector(".site-logo");
    if (!logo) return;
    logo.querySelector(".site-logo__custom")?.remove();
    const node = variant?.logo_svg ? logoNode(variant.logo_svg) : null;
    logo.classList.toggle("has-custom-logo", !!node);
    if (node) {
        const box = document.createElement("span");
        box.className = "site-logo__custom";
        box.setAttribute("aria-hidden", "true");
        box.append(node);
        logo.prepend(box);
    }
}

//=================================== Apply ===================================//
export function applyVariant(variant, { remember = false, preview = false } = {}) {
    if (!variant) return;
    const root = document.documentElement;
    const look = {};
    for (const [prop, value] of Object.entries(palette(variant.colors))) {
        if (value) { root.style.setProperty(prop, value); look[prop] = value; }
        else root.style.removeProperty(prop);
    }
    root.dataset.mode = mode;
    for (const [part, prop] of [["heading", "--kalq-font-heading"], ["body", "--kalq-font-body"]]) {
        const stack = fontStack(variant.fonts?.[part]);
        if (stack) { root.style.setProperty(prop, stack); look[prop] = stack; }
        else root.style.removeProperty(prop);
    }
    root.dataset.variant = variant.letter;
    applyLogo(variant);

    // Images and the hero video: the variant's replacement, otherwise the page's own
    const images = { ...(variant.images || {}) };
    if (variant.hero_video) images["home.hero.video"] = variant.hero_video;
    setMediaOverride((key) => images[key] || null);
    applyDirect(document);

    if (preview) previewing = variant;
    else {
        previewing = null;
        active = variant;
        if (remember) store.set(CHOICE_KEY, variant.id);
        store.set(CACHE_KEY, JSON.stringify({ id: variant.id, letter: variant.letter, mode, look, fonts: variant.fonts }));
    }
    notify();
}

// Leave a Styles panel preview
export function endPreview() {
    if (!previewing) return;
    previewing = null;
    applyVariant(active);
}

export async function loadVariants() {
    const res = await fetch("/api/variants", { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return variants; }
    const data = await res.json();
    variants = data.variants || [];
    const chosen = store.get(CHOICE_KEY);
    const next = variants.find((v) => v.id === chosen && v.status === "published")
        || variants.find((v) => v.is_default) || variants[0];
    if (next) applyVariant(next);
    else notify();
    return data;
}

//=================================== Switcher ===================================//
// Next to the header logo, outside the blended header so the dots keep their real accent colours
let switcher = null;

function placeSwitcher() {
    const logo = document.querySelector(".site-logo");
    if (!switcher || !logo) return;
    const r = logo.getBoundingClientRect();
    switcher.style.transform = `translate(${Math.round(r.right + 14)}px, ${Math.round(r.top + r.height / 2)}px) translateY(-50%)`;
}

function renderSwitcher() {
    const published = variants.filter((v) => v.status === "published");
    if (!switcher) {
        switcher = document.createElement("div");
        switcher.className = "kalq-switcher";
        switcher.setAttribute("role", "group");
        switcher.setAttribute("aria-label", "Style");
        document.body.append(switcher);
        // Follow the logo while its wordmark collapses or expands
        const header = document.querySelector(".site-header");
        if (header) new MutationObserver(() => { const until = performance.now() + 700; const step = () => { placeSwitcher(); if (performance.now() < until) requestAnimationFrame(step); }; step(); }).observe(header, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("resize", placeSwitcher);
    }
    switcher.hidden = published.length < 2;
    const current = getActive();
    switcher.replaceChildren(...published.map((v) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "kalq-switcher__dot";
        dot.textContent = v.letter;
        dot.title = `${v.letter} · ${v.name || ""}`.trim();
        dot.setAttribute("aria-label", `Style ${v.letter}${v.name ? `, ${v.name}` : ""}`);
        dot.setAttribute("aria-pressed", current?.id === v.id);
        dot.style.setProperty("--dot", v.colors?.accent || "#3b82f6");
        dot.addEventListener("click", () => applyVariant(v, { remember: true }));
        return dot;
    }));
    placeSwitcher();
}

// Sun in the header that turns into a thin crescent moon on hover (and the other way round when dark)
function initModeToggle() {
    const button = document.querySelector(".mode-toggle");
    if (!button) return;
    const label = () => {
        const en = document.documentElement.lang === "en";
        const text = mode === "dark" ? (en ? "Light design" : "Helles Design") : (en ? "Dark design" : "Dunkles Design");
        button.setAttribute("aria-label", text);
        button.title = text;
        button.setAttribute("aria-pressed", mode === "dark");
    };
    button.addEventListener("click", () => { setMode(mode === "dark" ? "light" : "dark"); label(); });
    document.addEventListener("kalq:language", label);
    label();
}

export async function initVariants() {
    if (initVariants.done) return;
    initVariants.done = true;
    document.documentElement.dataset.mode = mode;
    initModeToggle();
    onVariantsChange(renderSwitcher);
    await loadVariants();
    renderSwitcher();
    // Someone published, edited or deleted a variant
    document.addEventListener("kalq:variants", () => loadVariants());
}
