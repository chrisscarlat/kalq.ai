// Hero contrast: measure the image or video behind the hero and pick light or dark text for it, with an overlay just
// strong enough to keep the text readable (WCAG 4.5:1 against the brightest or darkest part behind it). The header
// follows while it sits over the hero; below the hero it goes back to inverting over the sections.
const MIN_CONTRAST = 4.5;
const SAMPLE_W = 48, SAMPLE_H = 27;
const RESAMPLE_MS = 2500; // a video changes; check it again while it plays

let hero = null, media = null, timer = 0, observer = null, scrollbar = null;
const canvas = document.createElement("canvas");
canvas.width = SAMPLE_W;
canvas.height = SAMPLE_H;
const ctx = canvas.getContext("2d", { willReadFrequently: true });

//=================================== Colour ===================================//
const channel = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const mixRgb = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

//=================================== Sampling ===================================//
// Pixels of a band of the frame (fractions of the hero), as drawn with object-fit: cover
function band(el, top, bottom, left = 0, right = 1) {
    const w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight;
    if (!w || !h) return null;
    const box = hero.getBoundingClientRect();
    const scale = Math.max(box.width / w, box.height / h);
    const sx = (w * scale - box.width) / 2 / scale, sy = (h * scale - box.height) / 2 / scale;
    const vw = box.width / scale, vh = box.height / scale;
    try {
        ctx.drawImage(el, sx + vw * left, sy + vh * top, vw * (right - left), vh * (bottom - top), 0, 0, SAMPLE_W, SAMPLE_H);
        const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);
        return pixels;
    } catch (e) {
        return null; // another origin without CORS: keep the safe dark overlay
    }
}

// How much overlay (0 to 1) of `scrim` the band needs so `text` reaches the contrast on 99 % of its pixels
function overlayFor(pixels, text, scrim, floor) {
    const textL = luminance(text);
    for (let a = floor; a <= 0.9; a += 0.025) {
        const scores = pixels.map((p) => contrast(textL, luminance(mixRgb(p, scrim, a)))).sort((x, y) => x - y);
        if (scores[Math.floor(scores.length * 0.01)] >= MIN_CONTRAST) return a;
    }
    return 0.9;
}

// The theme decides the hero: light theme (default) white text over a dark layer, dark theme the opposite, black
// text over a light layer. The image decides only how strong the layer must be for the contrast.
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
// A hero forced to light or dark (page builder) uses its own theme instead of the site toggle
const heroTone = () => ((hero?.dataset.sectionTheme || document.documentElement.dataset.mode) === "dark" ? "light" : "dark");

function measure() {
    if (!hero || !media) return;
    const tone = heroTone();
    const text = tone === "dark" ? WHITE : BLACK, scrim = tone === "dark" ? BLACK : WHITE;
    const content = band(media, 0.3, 0.75, 0.15, 0.85); // title and slogan
    const top = band(media, 0, 0.14); // under the header
    // Pixels not readable (another origin without CORS): a strong layer to be safe
    const mid = content ? overlayFor(content, text, scrim, 0.2) : 0.6;
    const head = top ? overlayFor(top, text, scrim, 0.2) : 0.6;
    hero.dataset.tone = tone;
    hero.style.setProperty("--hero-scrim", scrim.join(", "));
    hero.style.setProperty("--hero-scrim-top", head.toFixed(3));
    hero.style.setProperty("--hero-scrim-mid", mid.toFixed(3));
    updateHeader();
}

//=================================== Header ===================================//
// Logo, menu and language: pure white or pure black. Over the hero the hero's tone; below it, whatever reads best on
// the section behind the header (no inverting blend, which tints them over coloured backgrounds).
let headerFrame = 0;
function backgroundAt(x, y, header) {
    for (const node of document.elementsFromPoint(x, y)) {
        if (header.contains(node) || node.closest(".kalq-switcher, .kalq-toolbar, .kalq-cursors, .site-menu")) continue;
        for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
            const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
            if (!m) continue;
            const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
            if (a > 0.5) return [r, g, b];
        }
        break;
    }
    return WHITE;
}

function updateHeader() {
    cancelAnimationFrame(headerFrame);
    headerFrame = requestAnimationFrame(() => {
        const root = document.documentElement;
        const header = document.querySelector(".site-header");
        if (!header) return;
        const tone = hero?.dataset.tone;
        const y = header.offsetHeight / 2;
        if (tone && hero.getBoundingClientRect().bottom > header.offsetHeight) root.dataset.headerTone = tone;
        else {
            const bg = luminance(backgroundAt(innerWidth / 2, y, header));
            root.dataset.headerTone = contrast(bg, 1) >= contrast(bg, 0) ? "dark" : "light"; // dark: white reads better
        }
    });
}

//=================================== Setup ===================================//
function watchMedia() {
    clearInterval(timer);
    const el = hero?.querySelector("video, img.hero_media__el, .hero_media img, .hero_video") || null;
    media = el && (el.tagName === "VIDEO" || el.tagName === "IMG") ? el : null;
    if (!media) {
        if (hero) { delete hero.dataset.tone; ["--hero-scrim", "--hero-scrim-top", "--hero-scrim-mid"].forEach((p) => hero.style.removeProperty(p)); }
        updateHeader();
        return;
    }
    // Another origin (Supabase Storage sends CORS) must be loaded in CORS mode for its pixels to be readable
    const src = media.currentSrc || media.getAttribute("src") || media.querySelector("source")?.getAttribute("src");
    if (src && new URL(src, location.href).origin !== location.origin && media.crossOrigin !== "anonymous") {
        media.crossOrigin = "anonymous";
        if (media.tagName === "VIDEO") media.load();
        else media.src = src;
    }
    measure(); // the tone at once; the layer is measured again when the frame is there
    media.addEventListener(media.tagName === "VIDEO" ? "loadeddata" : "load", measure, { once: true });
    if (media.tagName === "VIDEO") timer = setInterval(() => { if (!media.paused && hero.getBoundingClientRect().bottom > 0) measure(); }, RESAMPLE_MS);
}

export function initHeroTone() {
    hero = document.querySelector('[data-barba="container"] > section');
    observer?.disconnect();
    if (!hero) { watchMedia(); return; }
    // A style variant or the editor swaps the hero media
    observer = new MutationObserver(() => watchMedia());
    observer.observe(hero, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    watchMedia();

    if (!initHeroTone.listening) {
        initHeroTone.listening = true;
        window.addEventListener("resize", () => { measure(); updateHeader(); });
        // Variant or light/dark changed; once more after the sections' colour transition
        document.addEventListener("kalq:look", () => { measure(); updateHeader(); setTimeout(updateHeader, 650); });
        document.addEventListener("kalq:layout", () => { measure(); updateHeader(); }); // a section's own theme changed
    }
    const container = document.querySelector(".scrollbar-container");
    const next = container && window.Scrollbar ? Scrollbar.get(container) : null;
    if (next && next !== scrollbar) { scrollbar = next; scrollbar.addListener(updateHeader); }
    else if (!next && !initHeroTone.windowScroll) { initHeroTone.windowScroll = true; window.addEventListener("scroll", updateHeader, { passive: true }); }
}
