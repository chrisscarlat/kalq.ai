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

function cssRgb(prop, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim() || fallback;
    const hex = value.replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return [0, 2, 4].map((i) => parseInt(fallback.slice(1 + i, 3 + i), 16));
}

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

function measure() {
    if (!hero || !media) return;
    const content = band(media, 0.3, 0.75, 0.15, 0.85); // title and slogan
    const top = band(media, 0, 0.14); // under the header
    if (!content || !top) return;
    const light = cssRgb("--kalq-light", "#ffffff"), dark = cssRgb("--kalq-dark", "#101010");
    const black = [16, 16, 16], white = [255, 255, 255];
    // Light text on a dark overlay, or dark text on a light one: whichever needs less overlay
    const options = [
        { tone: "dark", text: light, scrim: black, floor: 0.2 },
        { tone: "light", text: dark, scrim: white, floor: 0.1 },
    ].map((o) => ({ ...o, mid: overlayFor(content, o.text, o.scrim, o.floor), top: overlayFor(top, o.text, o.scrim, o.floor) }));
    const current = hero.dataset.tone;
    // Light text over a darkened image is the designed look; dark text only when it needs clearly less overlay
    let best = options[1].mid < options[0].mid - 0.15 ? options[1] : options[0];
    // A playing video: only switch when the other side is clearly better, so the text does not flicker
    if (current && best.tone !== current) {
        const keep = options.find((o) => o.tone === current);
        if (keep.mid - best.mid < 0.15) best = keep;
    }
    hero.dataset.tone = best.tone;
    hero.style.setProperty("--hero-scrim", best.scrim.join(", "));
    hero.style.setProperty("--hero-scrim-top", best.top.toFixed(3));
    hero.style.setProperty("--hero-scrim-mid", best.mid.toFixed(3));
    updateHeader();
}

//=================================== Header ===================================//
function updateHeader() {
    const root = document.documentElement;
    const tone = hero?.dataset.tone;
    const header = document.querySelector(".site-header");
    const over = tone && header && hero.getBoundingClientRect().bottom > header.offsetHeight;
    if (over) root.dataset.heroTone = tone;
    else delete root.dataset.heroTone;
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
    const ready = media.tagName === "VIDEO" ? media.readyState >= 2 : media.complete && media.naturalWidth;
    if (ready) measure();
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
        document.addEventListener("kalq:look", measure); // variant or light/dark changed the text colours
    }
    const container = document.querySelector(".scrollbar-container");
    const next = container && window.Scrollbar ? Scrollbar.get(container) : null;
    if (next && next !== scrollbar) { scrollbar = next; scrollbar.addListener(updateHeader); }
    else if (!next && !initHeroTone.windowScroll) { initHeroTone.windowScroll = true; window.addEventListener("scroll", updateHeader, { passive: true }); }
}
