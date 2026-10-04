// The magazine's spreads. Every section of the site becomes a "unit": what it holds, named by role (title, lead,
// body, media, items, cards, actions…), copied from the section itself, so nothing exists only in the book. Each unit
// is drawn by one layout as a spread of two pages:
//   opener  chapter statement | picture              A  picture | text, or text | picture (the unit's order)
//   B       statement | text                         C  one picture across both pages, title left, caption right
//   D       picture with title, text, button | list   E  two cards facing each other
//   F       questions | the selected answer          G  technical text flowing over as many spreads as it needs
// Text sits at the foot of its page; if it is longer than the page it sets in two columns, then carries on over a
// following spread. One type scale by role (book only): display, title, subtitle, item, lead, eyebrow, body, figure.
const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const STRIP = ["id", "data-kalq-key", "data-kalq-type", "data-i18n", "data-i18n-marquee", "data-i18n-aria", "data-kalq-format",
    "contenteditable", "style", "data-kalq-animated", "data-kalq-final", "tabindex", "aria-controls", "aria-expanded",
    "aria-selected", "aria-labelledby", "role", "hidden", "data-section", "data-section-builtin", "data-module", "class"];
const KEEP_CLASS = new Set(["kalq-line", "kalq-sr"]); // line breaks of a title; text only for readers and machines

const div = (cls) => Object.assign(document.createElement("div"), { className: cls });

//=================================== Copies ===================================//
// The text of a site element in a new element of the book's own (tag, role class); inline formatting and links kept,
// the site's hooks and classes left behind. Counters show where they end.
export function textOf(src, tag, cls) {
    if (!src || !src.textContent.trim()) return null;
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (src.dataset?.kalqFinal) el.textContent = src.dataset.kalqFinal;
    else src.childNodes.forEach((n) => el.append(n.cloneNode(true)));
    el.querySelectorAll("*").forEach((n) => {
        const keep = [...n.classList].filter((c) => KEEP_CLASS.has(c));
        STRIP.forEach((a) => n.removeAttribute(a));
        if (keep.length) n.className = keep.join(" ");
    });
    el.querySelectorAll("script, style, [aria-hidden='true']").forEach((n) => n.remove());
    return el;
}

// Paragraphs of a text block (a container of <p>s, or one element)
export function parasOf(src, cls = "bk-body") {
    if (!src) return [];
    const ps = src.matches("p") ? [src] : [...src.querySelectorAll(":scope > p, :scope > div > p")];
    return (ps.length ? ps : [src]).map((p) => textOf(p, "p", cls)).filter(Boolean);
}

// A link as a small button of the book's own
export function actionOf(a) {
    if (!a?.getAttribute("href") || !a.textContent.trim()) return null;
    const b = document.createElement("a");
    b.className = "bk-btn";
    b.href = a.getAttribute("href");
    if (a.target) { b.target = a.target; b.rel = "noopener"; }
    b.textContent = a.textContent.trim().replace(/\s+/g, " ");
    return b;
}

// Where a picture or video comes from: an <img>/<video>, a hero's media holder, or a row's data-image
export function mediaUrl(el) {
    if (!el) return null;
    if (el.dataset?.image) return el.dataset.image;
    const m = el.matches?.("img, video") ? el : el.querySelector?.("img, video");
    return m?.getAttribute("src") || m?.querySelector("source")?.getAttribute("src") || null;
}

// A media slot: the picture or video filling it, or the placeholder glyph while the slot is still empty (it fills
// when the content arrives: the book is rebuilt from the page)
export function mediaBox(url, { focal, cls = "" } = {}) {
    const box = div(`bk-media ${cls}`);
    if (!url) { box.classList.add("bk-ph"); box.setAttribute("aria-hidden", "true"); return box; }
    const video = VIDEO.test(url);
    const m = document.createElement(video ? "video" : "img");
    m.setAttribute("src", url);
    if (video) { ["muted", "loop", "playsinline"].forEach((a) => m.setAttribute(a, "")); m.muted = true; m.preload = "metadata"; m.setAttribute("aria-hidden", "true"); }
    else { m.alt = ""; m.decoding = "async"; }
    if (focal) m.style.objectPosition = focal === "left" ? "30% 50%" : "70% 50%";
    box.append(m);
    return box;
}

//=================================== Pages ===================================//
export function page(cls = "") {
    const p = div(`kalq-mag-page bk-page ${cls}`.trim());
    const inner = div("bk-in");
    p.append(inner);
    p.inner = inner;
    return p;
}

// A page of text set at its foot
function textPage(parts, cls = "") {
    const p = page(`bk-textpage ${cls}`);
    const flow = div("bk-flow");
    parts.flat().filter(Boolean).forEach((n) => flow.append(n));
    p.inner.append(flow);
    return p;
}

function mediaPage(urls, { focal, across } = {}) {
    const p = page("is-media");
    const list = urls.length ? urls : [null];
    if (across) p.classList.add(`is-across-${across}`);
    if (list.length > 1) p.inner.classList.add("bk-stack");
    list.forEach((u) => p.inner.append(mediaBox(u, { focal })));
    return p;
}

const textParts = (u) => [
    u.eyebrow && textOf(u.eyebrow, "p", "bk-eyebrow"),
    u.title && textOf(u.title, "h2", "bk-title"),
    u.lead && textOf(u.lead, "p", "bk-lead"),
    ...(u.body || []).map((b) => b.cloneNode(true)),
    u.actions?.length ? actions(u.actions) : null,
];
function actions(list) {
    const row = div("bk-actions");
    list.map(actionOf).filter(Boolean).forEach((a) => row.append(a));
    return row.children.length ? row : null;
}

//=================================== Layouts ===================================//
export const LAYOUTS = {
    // Chapter opener: the chapter's name small, its statement large, at the foot; the picture facing it
    opener: (u) => [
        textPage([u.chapter && Object.assign(document.createElement("p"), { className: "bk-eyebrow", textContent: u.chapter }), textOf(u.statement, "h2", "bk-display")], "bk-opener"),
        mediaPage(u.media, { focal: u.focal }),
    ],
    // Picture and text, in the unit's own order
    A: (u) => {
        const text = textPage(textParts(u));
        const pic = mediaPage(u.media, { focal: u.focal });
        return u.order === "media-text" ? [pic, text] : [text, pic];
    },
    // Statement and text
    B: (u) => [
        textPage([u.eyebrow && textOf(u.eyebrow, "p", "bk-eyebrow"), textOf(u.title, "h2", "bk-display")], "bk-lefttitle"),
        textPage([u.lead && textOf(u.lead, "p", "bk-lead"), ...(u.body || []).map((b) => b.cloneNode(true)), actions(u.actions || [])]),
    ],
    // One picture across the spread; the title on the left page, the caption on the right
    C: (u) => {
        const [l, r] = [mediaPage(u.media.slice(0, 1), { across: "left" }), mediaPage(u.media.slice(0, 1), { across: "right" })];
        const over = (node, p) => { if (!node) return; const o = div("bk-over"); o.append(node); p.inner.append(o); };
        over(textOf(u.title, "h2", "bk-title"), l);
        over(textOf(u.caption, "p", "bk-lead"), r);
        return [l, r];
    },
    // The picture with the title, a short description and the button set over it; the numbered list facing it, number
    // small and title large. Hovering or focusing an item shows its picture.
    D: (u) => {
        const pic = mediaPage([u.items.find((i) => i.media)?.media || u.media?.[0] || null]);
        const over = div("bk-over");
        [textOf(u.title, "h2", "bk-title"), u.lead && textOf(u.lead, "p", "bk-lead"), actions(u.actions || [])].filter(Boolean).forEach((n) => over.append(n));
        pic.inner.append(over);
        const list = document.createElement("ol");
        list.className = "bk-list";
        u.items.forEach((it) => {
            const li = document.createElement("li");
            if (it.media) li.dataset.media = it.media;
            li.tabIndex = 0;
            li.append(Object.assign(document.createElement("span"), { className: "bk-num", textContent: it.num }), textOf(it.title, "h4", "bk-item"));
            list.append(li);
        });
        const items = textPage([list], "bk-listpage");
        const img = () => pic.querySelector("img");
        list.addEventListener("pointerover", (e) => { const m = e.target.closest("li")?.dataset.media; if (m && img()) img().src = m; });
        list.addEventListener("focusin", (e) => { const m = e.target.closest("li")?.dataset.media; if (m && img()) img().src = m; });
        return [pic, items];
    },
    // Two cards facing each other: picture above, label, title and text at the foot
    E: (u) => u.cards.map((c) => {
        const p = page("bk-card");
        p.inner.append(mediaBox(c.media, { cls: "bk-card__media" }));
        const flow = div("bk-flow");
        [c.eyebrow && textOf(c.eyebrow, "p", "bk-eyebrow"), textOf(c.title, "h3", "bk-subtitle"), c.lead && textOf(c.lead, "p", "bk-lead"), ...(c.body || []).map((b) => b.cloneNode(true))]
            .filter(Boolean).forEach((n) => flow.append(n));
        p.inner.append(flow);
        return p;
    }),
    // Questions as tabs on the left page, the selected answer on the right
    F: (u, { uid }) => {
        const qs = textPage([textOf(u.title, "h2", "bk-title")], "bk-questions");
        const list = div("bk-tabs");
        list.setAttribute("role", "tablist");
        list.setAttribute("aria-orientation", "vertical");
        const answers = page("bk-answers");
        u.pairs.forEach((pair, i) => {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "bk-tab";
            tab.id = `${uid}-q${i}`;
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-controls", `${uid}-a${i}`);
            tab.setAttribute("aria-selected", i === 0);
            tab.tabIndex = i === 0 ? 0 : -1;
            tab.append(...textOf(pair.q, "span").childNodes);
            list.append(tab);
            const panel = div("bk-flow bk-answer");
            panel.id = `${uid}-a${i}`;
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", tab.id);
            panel.hidden = i !== 0;
            panel.append(textOf(pair.q, "h3", "bk-subtitle"), ...parasOf(pair.a));
            answers.inner.append(panel);
        });
        qs.querySelector(".bk-flow").append(list);
        const select = (i, focus) => list.querySelectorAll(".bk-tab").forEach((t, j) => {
            t.setAttribute("aria-selected", i === j);
            t.tabIndex = i === j ? 0 : -1;
            answers.querySelector(`#${uid}-a${j}`).hidden = i !== j;
            if (i === j && focus) t.focus();
        });
        list.addEventListener("click", (e) => { const t = e.target.closest(".bk-tab"); if (t) select([...list.children].indexOf(t)); });
        list.addEventListener("keydown", (e) => {
            const tabs = [...list.children], i = tabs.indexOf(e.target.closest(".bk-tab"));
            const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (j === undefined || i < 0) return;
            e.preventDefault();
            e.stopPropagation();
            select((j + tabs.length) % tabs.length, true);
        });
        return [qs, answers];
    },
    // Logos: a still grid over the spread, each logo with its company's name
    L: (u) => {
        const grid = (list) => {
            const ul = document.createElement("ul");
            ul.className = "bk-logos";
            list.forEach((x) => {
                const li = document.createElement("li");
                const img = document.createElement("img");
                img.src = x.url;
                img.alt = x.name;
                img.decoding = "async";
                li.append(img, Object.assign(document.createElement("span"), { className: "bk-logos__name", textContent: x.name }));
                ul.append(li);
            });
            return ul;
        };
        const half = Math.ceil(u.logos.length / 2);
        return [
            textPage([u.title && textOf(u.title, "p", "bk-eyebrow"), grid(u.logos.slice(0, half))], "bk-logopage"),
            textPage([grid(u.logos.slice(half))], "bk-logopage"),
        ];
    },
    // Technical text (the legal appendix): a quieter, denser setting that flows over as many pages as it needs
    G: (u) => {
        const p = page("is-tech");
        const flow = div("bk-flow");
        [u.code && Object.assign(document.createElement("p"), { className: "bk-code", textContent: u.code }), textOf(u.title, "h2", "bk-title"),
            u.lead && textOf(u.lead, "p", "bk-lead"), ...(u.body || []).map((b) => b.cloneNode(true))].filter(Boolean).forEach((n) => flow.append(n));
        p.inner.append(flow);
        p.dataset.flow = "tech";
        return [p];
    },
};

//=================================== Fitting ===================================//
// (in two columns the overflow runs sideways, into a third column)
const overflows = (flow) => flow.scrollHeight > flow.clientHeight + 1 || flow.scrollWidth > flow.clientWidth + 1;

// Text longer than its page: first two columns (where the page is wide enough), then the rest carries on over a
// following spread (after the unit's own pages, so its spread stays as designed). A heading never ends a page; an
// element taller than a page stays whole with its heading and the page scrolls. Pages are laid out in `measure`.
export function fit(pages, wide, measure) {
    const more = [];
    pages.forEach((p) => {
        let flow = p.querySelector(".bk-flow");
        if (!flow || p.classList.contains("bk-answers")) return;
        if (overflows(flow) && wide && !p.classList.contains("bk-card")) flow.classList.add("is-cols");
        let current = p;
        while (overflows(flow) && flow.children.length > 1) {
            const rest = [];
            while (overflows(flow) && flow.children.length > 1) rest.unshift(flow.lastElementChild), flow.lastElementChild.remove();
            while (flow.children.length > 1 && /^H[1-6]$/.test(flow.lastElementChild.tagName)) rest.unshift(flow.lastElementChild), flow.lastElementChild.remove();
            // only headings would stay: the next element alone is taller than a page; keep them together, scrolling
            if ([...flow.children].every((n) => /^H[1-6]\b|eyebrow/.test(`${n.tagName} ${n.className}`))) {
                rest.forEach((n) => flow.append(n));
                break;
            }
            const next = page(`${current.className.replace(/kalq-mag-page|bk-page|is-cont|is-media|is-across-\S+/g, "").trim()} is-cont`);
            const nextFlow = div(flow.className);
            rest.forEach((n) => nextFlow.append(n));
            next.inner.append(nextFlow);
            measure.append(next);
            more.push(next);
            current = next;
            flow = nextFlow;
        }
        if (overflows(flow)) { flow.classList.remove("is-cols"); current.classList.add("is-scroll"); } // scrolls as one column
    });
    return [...pages, ...more];
}
