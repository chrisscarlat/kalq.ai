// Pictures and videos belong to a style; everything else on a page (its modules, their order, every text) is shared
// by all styles. Shared by the server render and the browser, so no browser globals.
//
// A style's file for a slot is its own content block "<slot key>@<style id>" (e.g. "home.hero.video@a"), written by
// pencil mode while that style is shown. Until a style has its own block for a slot, it shows what it showed before
// this rule: its old replacement (the style record's images / hero_video, kept there for history) or the page's own
// file. A slot with no file at all (a new module's) shows a plain placeholder.
export const styleKey = (key, styleId) => `${key}@${styleId}`;
export const isStyleKey = (key) => key.includes("@");
export const baseKey = (key) => key.split("@")[0];

// get(key) → the stored entry ({ media } for pictures); style: { id, images, hero_video } or null
export function mediaResolver(get, style) {
    const id = style?.id || null;
    return (key) => {
        if (id) {
            const own = get(styleKey(key, id));
            if (own && "media" in own) return own.media || ""; // its own, or emptied on purpose
        }
        const legacy = style ? (key === "home.hero.video" ? style.hero_video : style.images?.[key]) : null;
        if (legacy) return legacy;
        return get(key)?.media || "";
    };
}

// The slots that have a file in some style (or on the page): a visitor sees an empty one of these as a plain grey
// box, so a style missing a picture keeps the layout; a slot empty everywhere stays out as before
export function filledSomewhere(entries) {
    const out = new Set();
    for (const [key, entry] of entries) if (entry && entry.media) out.add(baseKey(key));
    return out;
}

// Heroes for "all heroes": Home's hero and every Hero card module, but only those with a background slot (a hero
// without one is never given one). Slots marked as a person's or a brand's (portraits, logos) are never filled by
// "all non-hero images" or "everything".
export const HOME_HERO = "home.hero.video";
export const HERO_MODULES = new Set(["content.hero-card"]);
