// Kalq's book: its chapters (the site's pages, in the navigation's order) and how each of its built-in sections reads
// as a magazine unit (js/book/layouts.js). Page builder modules carry their own layout in js/modules/registry.js.
// Another site (certil) brings its own file of this shape; the book itself (js/magazine.js) knows no site.
import { textOf, parasOf, mediaUrl } from "./layouts.js";

export const CHAPTERS = [
    { page: "home", file: "index.html", label: "nav.home" },
    { page: "platform", file: "platform.html", label: "nav.platform" },
    { page: "company", file: "company.html", label: "nav.company" },
    { page: "impressum", file: "impressum.html", label: "footer.impressum", appendix: true },
    { page: "datenschutz", file: "datenschutz.html", label: "privacy.title", appendix: true },
];

const $ = (root, sel) => root?.querySelector(sel) || null;
const $$ = (root, sel) => [...(root?.querySelectorAll(sel) || [])];
const focalOf = (s) => s?.dataset.focal || null;
// a header's picture: its own media slot if filled, else the picture section right after it
const headerMedia = (s, next) => mediaUrl($(s, ".hero_media img, .hero_media video")) || mediaUrl($(next, "img, video"));

// One entry per built-in section id: (section, { next, chapter }) -> unit | unit[] | null. "takes" names a section
// the entry reads too (its picture), so that one is not drawn again.
export const SECTIONS = {
    // Home
    header: (s) => ({
        role: "cover", media: [mediaUrl($(s, "video, .hero_media img, .hero_media video"))],
        mark: $(s, ".hero_title"), statement: $(s, ".hero_slogan"),
    }),
    about: (s) => ({
        role: "about", lead: $(s, "h5"), media: mediaUrl($(s, ".kalq-media-slot")),
        figures: $$(s, ".numbering > div").map((d) => ({ value: $(d, "h2"), label: $(d, "p") })),
    }),
    expertise: (s) => ({
        layout: "D", title: $(s, ".title_heading h2"), lead: $(s, ".title_desc"), actions: $$(s, ".title_heading a.btn"),
        items: $$(s, ".elem").map((e) => ({ num: $(e, ".title p")?.textContent.trim() || "", title: $(e, ".title h4"), media: e.dataset.image || null })),
    }),
    belief: (s) => ({ layout: "B", title: $(s, "h2"), body: parasOf($(s, ".kalq-paras")) }),
    social: (s) => ({ role: "social", label: $(s, "#container p"), links: $$(s, "a.item").map((a) => ({ href: a.getAttribute("href"), text: $(a, "h4")?.textContent.trim() || a.textContent.trim() })) }),

    // Platform
    "expertise-header": (s, { next }) => ({ layout: "opener", statement: $(s, "h2"), media: [headerMedia(s, next)], focal: focalOf(s), takes: "expertise-header-img" }),
    "expertise-container": (s) => {
        const intro = { layout: "B", title: $(s, ".txt h3"), lead: $(s, ".txt h5") };
        // a card: the module's name as its title, buyer or supplier as its label, then its lead and text
        const side = (c) => { const n = $(c, ".card_side")?.cloneNode(true); if (n) n.textContent = n.textContent.replace(/^[\s·]+/, ""); return n; }; // "· Einkauf" -> "Einkauf"
        const card = (c) => ({ media: mediaUrl($(c, "img, video")), title: $(c, "p.tag span:first-child"), eyebrow: side(c), lead: $(c, "h5"), body: parasOf($(c, ":scope > p:not(.tag)")) });
        const [buyers, suppliers] = $$(s, ".expertise_cards_container .col").map((col) => $$(col, ".card").map(card));
        // the agreed two-screen mapping: a buyer card facing a supplier card
        const pairs = (buyers || []).map((b, i) => ({ layout: "E", cards: [b, suppliers?.[i]].filter(Boolean), title: b.title, label: [b.title, suppliers?.[i]?.title] }));
        return [intro, ...pairs];
    },

    // Company
    "about-header": (s, { next }) => ({ layout: "opener", statement: $(s, "h2"), media: [headerMedia(s, next)], focal: focalOf(s), takes: "about-header-img" }),
    "about-goals": (s) => ({ layout: "A", order: "text-media", title: $(s, "h3"), lead: $(s, "h5"), media: $$(s, "img, video").map(mediaUrl) }),
    "about-wedo": (s) => ({ layout: "A", order: "media-text", title: $(s, "h3"), body: parasOf($(s, ".kalq-paras")), media: [mediaUrl($(s, "img, video"))] }),
    "about-awwards": (s) => ({ layout: "A", order: "text-media", title: $(s, "h3"), lead: $(s, "h5"), media: [mediaUrl($(s, "img, video"))] }),

    // Impressum, Datenschutz: the technical appendix
    legal: (s) => ({
        layout: "G", tech: true, title: $(s, "h2"), lead: $(s, ".legal_lead"),
        body: $$(s, ".legal_block").flatMap((b) => [textOf($(b, "h5"), "h3", "bk-subtitle"), ...parasOf($(b, "p"))]).filter(Boolean),
    }),
};

// The page's footer reads as part of the back cover
export const footerOf = (root) => {
    const f = $(root, "footer");
    if (!f) return null;
    // The library footer, when the style shows it: contact on the back cover, the legal line small
    const h = document.documentElement.classList.contains("foot-harbor") && $(f, ".footer-harbor");
    if (h) {
        const address = $(h, ".footer-harbor__address");
        return {
            closing: $(h, ".footer-harbor__heading"), sub: address?.textContent.trim() ? address : null,
            buttons: [...$$(h, ".footer-harbor__lines a"), ...$$(h, ".footer-harbor__social a")],
            links: $$(h, ".footer-harbor__legal a"), small: $(h, ".footer-harbor__legal > span"),
        };
    }
    return {
        closing: $(f, ".footer_heading h2"), sub: $(f, ".footer_sub"), buttons: $$(f, ".footer_btns_wrapper a"),
        links: $$(f, ".footer_bottom a"), small: $(f, ".footer_bottom span"),
    };
};
