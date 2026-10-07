// Style variants (public: every page, signed out too). Applying one sets CSS custom properties on :root, loads its
// fonts, swaps the header logo and its images or hero video. No reload; :root and the header persist across Barba.
// The choice is remembered in localStorage; the last applied look is also cached so the next page load starts in it.
import { sanitizeSvg } from "../lib/svg-sanitize.js";
import { refreshStyleMedia, setMediaStyle } from "./content.js";

const CHOICE_KEY = "kalq-variant";
const MODE_KEY = "kalq-mode"; // "light" | "dark"
const CACHE_KEY = "kalq-variant-look";
const FONT_FALLBACK = '"Clash Grotesk", "Helvetica Neue", Arial, sans-serif';

let variants = [];
let active = null;
let previewing = null; // a variant shown from the Styles panel without saving
const listeners = new Set();

const PREVIEW_KEY = "kalq-variant-preview";
const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (e) { } },
    remove(key) { try { sessionStorage.removeItem(key); } catch (e) { } },
};
const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { } },
};

export const getVariants = () => variants;
// The style setup (api/variants.js): on while several styles are tried (the switcher, the viewer, Styles); off, the
// site has the default style only, for good
let setup = true;
export const setupOn = () => setup;

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

// Both palettes are also published as --kalq-l-* and --kalq-d-*: a section forced to light or dark (page builder)
// maps its own tokens to one of them, whatever the site toggle says
function palette(colors) {
    const c = { bg: "#ffffff", text: "#101010", accent: "#3b82f6", light: "#ffffff", dark: "#101010", ...colors };
    const light = { bg: c.bg, text: c.text, light: c.light, dark: c.dark, line: mix(c.bg, c.text, 0.15) };
    const dark = { bg: c.dark, text: c.light, light: c.light, dark: mix(c.dark, c.light, 0.07), line: mix(c.dark, c.light, 0.2) };
    const both = Object.fromEntries(["bg", "text", "light", "dark", "line"].flatMap((k) => [[`--kalq-l-${k}`, light[k]], [`--kalq-d-${k}`, dark[k]]]));
    if (mode !== "dark") return { "--kalq-bg": c.bg, "--kalq-text": c.text, "--kalq-accent": c.accent, "--kalq-light": c.light, "--kalq-dark": c.dark, "--kalq-line": null, ...both };
    return {
        "--kalq-bg": dark.bg, "--kalq-text": dark.text, "--kalq-accent": c.accent, "--kalq-light": dark.light,
        "--kalq-dark": dark.dark, "--kalq-line": dark.line, ...both,
    };
}

export function setMode(next) {
    mode = next === "dark" ? "dark" : "light";
    store.set(MODE_KEY, mode);
    const current = getActive();
    if (current) applyVariant(current, { preview: !!previewing });
    else { document.documentElement.dataset.mode = mode; document.dispatchEvent(new Event("kalq:look")); }
}
export const getActive = () => previewing || active;
export const onVariantsChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn(getActive(), variants));

//=================================== Fonts ===================================//
const loadedFonts = new Set();
// The type tokens' "light" weight (css/utilities/_type.scss) is the lightest weight a font has from 300 up: Google
// sends only the weights a family has (Syne starts at 400), so read them from the faces its stylesheet declared
const fontSheets = new Map(); // family -> the loading of its Google stylesheet
async function lightWeight(family) {
    await fontSheets.get(family);
    const ranges = [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === family).map((f) => String(f.weight).split(" ").map(Number));
    if (!ranges.length) return null;
    if (ranges.some(([a, b = a]) => a <= 300 && 300 <= b)) return 300;
    const above = ranges.map(([a, b = a]) => (a >= 300 ? a : b >= 300 ? 300 : null)).filter((w) => w != null);
    return above.length ? Math.min(...above) : null;
}

function fontStack(font) {
    if (!font || font.source === "default" || !font.family) return null;
    const id = `${font.source}:${font.family}:${font.url || ""}`;
    if (!loadedFonts.has(id)) {
        loadedFonts.add(id);
        if (font.source === "google") {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@200;300;400;500;600;700&display=swap`;
            fontSheets.set(font.family, new Promise((done) => { link.onload = link.onerror = done; }));
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
    // without a viewBox a logo cannot be fitted into its square: its own width and height give one
    const w = parseFloat(root.getAttribute("width")), h = parseFloat(root.getAttribute("height"));
    if (!root.hasAttribute("viewBox") && w > 0 && h > 0) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
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

// The built-in mark, still (the header's copy is animated)
const BUILT_IN_MARK = '<svg viewBox="0 0 174 174" fill="none" stroke="currentColor" stroke-width="11"><line x1="111" y1="86.99" x2="173.98" y2="86.99"/><line x1="63" y1="87.01" x2="0" y2="87.01"/><line x1="87.01" y1="111" x2="87.01" y2="174"/><line x1="87.01" y1="63" x2="87.01" y2="0"/><line x1="94.07" y1="94.07" x2="135.29" y2="135.29"/><line x1="104.3" y1="70.36" x2="132.83" y2="41.82"/><line x1="70.2" y1="104.14" x2="40.85" y2="133.49"/><line x1="70.19" y1="69.87" x2="40.83" y2="40.51"/></svg>';

// The big moving element in the home hero: a line in one of five shapes (default the diagonal \), or the variant's
// logo (its own or the built-in mark), same parallax. GSAP owns the element's transform for the mouse parallax, so
// the turn is set through it.
// A logo sits in one fixed square above the title, never over the brand text: as big as the room between the header
// and the title allows (at most 150px or 18% of the screen height), clear of the title by more than the parallax moves.
const MARK_GAP = 44; // the parallax moves the hero mark up to about 22px
function fitHeroLogo(block) {
    const title = block.parentElement?.querySelector(".hero_title") || document.querySelector(".hero_title");
    const box = block.offsetParent;
    if (!title || !box) return;
    const top = title.getBoundingClientRect().top;
    const centre = box.getBoundingClientRect().top + box.clientHeight / 2; // the block's own place, without the parallax
    const head = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0;
    const size = Math.max(40, Math.min(150, window.innerHeight * 0.18, top - MARK_GAP - head - 12));
    block.style.setProperty("--mark-size", `${Math.round(size)}px`);
    block.style.setProperty("--mark-lift", `${Math.round(centre - (top - MARK_GAP - size / 2))}px`);
}
let refitting = false;
const refitHeroLogos = () => document.querySelectorAll(".block.is-logo").forEach(fitHeroLogo);
const LINE_TURN = { back: -45, forward: 45, vertical: 0, horizontal: 90, circle: 0 };
function applyHeroMark(variant) {
    const wantLogo = variant?.hero_mark === "logo";
    const shape = LINE_TURN[variant?.hero_line] !== undefined ? variant.hero_line : "back";
    document.querySelectorAll(".block").forEach((block) => {
        const node = wantLogo ? logoNode(variant.logo_svg || BUILT_IN_MARK) : null;
        block.classList.toggle("is-logo", !!node);
        block.dataset.line = node ? "" : shape;
        block.replaceChildren(...(node ? [node] : []));
        if (node) fitHeroLogo(block);
        else ["--mark-size", "--mark-lift"].forEach((p) => block.style.removeProperty(p));
        const rotation = node ? 0 : LINE_TURN[shape];
        if (window.gsap) gsap.set(block, { xPercent: -50, yPercent: -50, rotation });
        else block.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    });
    if (wantLogo && !refitting) { refitting = true; window.addEventListener("resize", refitHeroLogos); document.fonts?.ready.then(refitHeroLogos); }
}
// Barba brings a fresh hero on every page change
export const refreshHeroMark = () => applyHeroMark(getActive());

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
        const font = variant.fonts?.[part];
        const stack = fontStack(font);
        if (stack) { root.style.setProperty(prop, stack); look[prop] = stack; }
        else root.style.removeProperty(prop);
        // the light weight this font really has (Clash Grotesk and uploaded files: 300)
        const weightProp = `--kalq-weight-light-${part}`;
        root.style.removeProperty(weightProp);
        if (stack && font.source === "google") {
            lightWeight(font.family).then((w) => {
                if (w && w !== 300 && getActive()?.fonts?.[part]?.family === font.family) root.style.setProperty(weightProp, String(w));
            });
        }
    }
    root.dataset.variant = variant.letter;
    // A main font of its own also sets the wordmark (header, hero); the default keeps the outlined Clash logo
    root.classList.toggle("has-font-wordmark", !!fontStack(variant.fonts?.heading));
    applyLogo(variant);
    applyHeroMark(variant);
    // Options: the panel menu and the liquid reveal over the hero (js/heroReveal.js reacts to kalq:look)
    root.classList.toggle("menu-panels", variant.menu_style === "panels");
    // the library's navigations and footer (css/components/_nav.scss, _footer-library.scss)
    ["minimal", "plain", "mega", "overlay"].forEach((m) => root.classList.toggle(`nav-${m}`, variant.menu_style === m));
    root.classList.toggle("nav-bar", ["minimal", "plain", "mega"].includes(variant.menu_style));
    root.classList.toggle("foot-harbor", variant.footer_style === "harbor");
    root.classList.toggle("foot-wordmark", variant.footer_style === "harbor" && variant.footer_wordmark === true);
    root.classList.toggle("foot-gradient", variant.footer_style === "harbor" && variant.footer_gradient === true);
    const reveal = ["hero", "all"].includes(variant.reveal) ? variant.reveal : variant.hero_reveal === true ? "hero" : "off";
    root.classList.toggle("reveal-hero", reveal === "hero");
    root.classList.toggle("reveal-all", reveal === "all");

    // Pictures and videos are the style's own (js/styleMedia.js); modules are drawn again with them
    setMediaStyle(variant);
    refreshStyleMedia();

    if (preview) {
        previewing = variant;
        session.set(PREVIEW_KEY, JSON.stringify(variant)); // a reload in this tab keeps the preview
    } else {
        previewing = null;
        session.remove(PREVIEW_KEY);
        active = variant;
        if (remember) store.set(CHOICE_KEY, variant.id);
        store.set(CACHE_KEY, JSON.stringify({ id: variant.id, letter: variant.letter, mode, look, fonts: variant.fonts }));
    }
    notify();
    document.dispatchEvent(new Event("kalq:look"));
}

// Leave a Styles panel preview
export function endPreview() {
    session.remove(PREVIEW_KEY);
    if (!previewing) return;
    previewing = null;
    applyVariant(active);
}

export async function loadVariants() {
    const res = await fetch("/api/variants", { credentials: "same-origin" }).catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return variants; }
    const data = await res.json();
    variants = data.variants || [];
    setup = data.setup !== false;
    document.documentElement.classList.toggle("kalq-setup-off", !setup);
    const chosen = store.get(CHOICE_KEY);
    const next = variants.find((v) => v.id === chosen && v.status === "published")
        || variants.find((v) => v.is_default) || variants[0];
    // A Styles panel preview from before a reload in this tab (read first: applying `next` clears it)
    let kept = null;
    try { kept = JSON.parse(session.get(PREVIEW_KEY) || "null"); } catch (e) { }
    if (next) applyVariant(next);
    else notify();
    if (kept && variants.some((v) => v.id === kept.id)) applyVariant(kept, { preview: true });
    return data;
}

//=================================== Switcher ===================================//
// Next to the header logo, outside the blended header so the dots keep their real accent colours
let switcher = null;

function placeSwitcher() {
    const logo = document.querySelector(".site-logo");
    if (!switcher || !logo) return;
    const r = logo.getBoundingClientRect();
    switcher.style.transform = `translate(${Math.round(r.right + 30)}px, ${Math.round(r.top + r.height / 2)}px) translateY(-50%)`; // clear of the logo, its own thing
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
    switcher.hidden = !setup || published.length < 2;
    const current = getActive();
    switcher.replaceChildren(...published.map((v) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "kalq-switcher__dot";
        dot.textContent = v.letter;
        dot.title = `${v.letter} · ${v.name || ""}`.trim();
        dot.setAttribute("aria-label", `Style ${v.letter}${v.name ? `, ${v.name}` : ""}`);
        dot.setAttribute("aria-pressed", current?.id === v.id);
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
