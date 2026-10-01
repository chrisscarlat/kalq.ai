// Style variant data: validation on the server. A variant is stored as JSON in the block "variant.<id>".
import { sanitizeSvg } from "./svg-sanitize.js";

const HEX = /^#[0-9a-f]{6}$/i;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 ]{0,39}$/;
const KEY = /^[a-z0-9-]+(\.[a-z0-9-]+){1,5}$/;
export const HERO_LINES = ["back", "forward", "vertical", "horizontal", "circle"]; // \ / | - o
export const COLOR_NAMES = ["bg", "text", "accent", "light", "dark"];
export const DEFAULT_COLORS = { bg: "#ffffff", text: "#101010", accent: "#3b82f6", light: "#ffffff", dark: "#101010" };

// Files only from this project's storage bucket, or the site's own assets
export function mediaUrlOk(url, supabaseUrl) {
    if (url === "") return true;
    if (typeof url !== "string" || url.length > 600 || /\s|\.\.|["'<>]/.test(url)) return false;
    if (/^assets\/[\w./-]+$/.test(url)) return true;
    return !!supabaseUrl && url.startsWith(`${supabaseUrl}/storage/v1/object/public/site-media/`);
}

function font(input, supabaseUrl) {
    const source = ["default", "google", "upload"].includes(input?.source) ? input.source : "default";
    if (source === "default") return { source, family: "" };
    const family = typeof input.family === "string" && FAMILY.test(input.family.trim()) ? input.family.trim() : null;
    if (!family) throw new Error("font_family");
    if (source === "google") return { source, family };
    if (!input.url || !mediaUrlOk(input.url, supabaseUrl) || !/\.woff2$/i.test(input.url)) throw new Error("font_url");
    return { source, family, url: input.url };
}

// Throws an Error whose message names the bad field
export function normalizeVariant(input, supabaseUrl) {
    if (!input || typeof input !== "object") throw new Error("data");
    const letter = String(input.letter || "").toUpperCase();
    if (!/^[A-Z]$/.test(letter)) throw new Error("letter");
    const name = String(input.name || "").trim().slice(0, 40);
    if (!name) throw new Error("name");
    const status = ["draft", "published"].includes(input.status) ? input.status : "draft";

    const colors = {};
    for (const c of COLOR_NAMES) {
        const v = String(input.colors?.[c] || DEFAULT_COLORS[c]).toLowerCase();
        if (!HEX.test(v)) throw new Error(`color_${c}`);
        colors[c] = v;
    }

    const logo = typeof input.logo_svg === "string" ? input.logo_svg : "";
    const logo_svg = logo ? sanitizeSvg(logo) : "";
    if (logo && !logo_svg) throw new Error("logo_svg");

    const hero_video = typeof input.hero_video === "string" ? input.hero_video : "";
    if (!mediaUrlOk(hero_video, supabaseUrl)) throw new Error("hero_video");

    const images = {};
    for (const [key, url] of Object.entries(input.images || {})) {
        if (!KEY.test(key) || key.startsWith("variant.")) throw new Error("image_key");
        if (!url) continue;
        if (!mediaUrlOk(url, supabaseUrl)) throw new Error(`image ${key}`);
        images[key] = url;
    }
    if (Object.keys(images).length > 200) throw new Error("images");

    return {
        letter, name, status,
        is_default: input.is_default === true,
        sort: Number.isInteger(input.sort) ? Math.max(0, Math.min(999, input.sort)) : 50,
        logo_svg,
        // Centre of the home hero: a line (in one of the shapes) or the logo (own or the built-in mark)
        hero_mark: input.hero_mark === "logo" ? "logo" : "line",
        hero_line: HERO_LINES.includes(input.hero_line) ? input.hero_line : "back",
        colors,
        fonts: { heading: font(input.fonts?.heading, supabaseUrl), body: font(input.fonts?.body, supabaseUrl) },
        hero_video,
        images,
    };
}
