// How text blocks are rendered, wherever their text comes from (built-in translation, database, an edit).
//   data-kalq-format="lines":      one line per <br>; every line is its own element, animated with a stagger
//   data-kalq-format="paragraphs": paragraphs (<p>), line breaks inside them with <br>
//   no format:                     plain inline text (br, em, strong, a)

// Only <br>, <em>, <strong>, <a href> (and <p> in paragraph blocks) survive, everything else is unwrapped.
// A <template> parses inertly, so nothing in the input runs or loads. Works on any document: the browser's, or the
// server's when api/page.js renders the page (no global document there).
const ALLOWED = new Set(["BR", "EM", "STRONG", "A", "P"]);
const SAFE_HREF = /^(https?:|mailto:|\/|#|[\w-]+\.html(#.*)?$)/i;

const TEXT_NODE = 3, ELEMENT_NODE = 1;

export function sanitize(html, doc = document) {
    const template = doc.createElement("template");
    template.innerHTML = html;
    const out = doc.createDocumentFragment();
    const walk = (node, parent) => [...node.childNodes].forEach((child) => {
        if (child.nodeType === TEXT_NODE) return parent.append(child.textContent);
        if (child.nodeType !== ELEMENT_NODE) return;
        if (!ALLOWED.has(child.tagName.toUpperCase())) return walk(child, parent);
        const el = doc.createElement(child.tagName.toLowerCase());
        if (child.tagName.toUpperCase() === "A") {
            const href = (child.getAttribute("href") || "").trim();
            if (SAFE_HREF.test(href)) el.setAttribute("href", href);
        }
        walk(child, el);
        parent.append(el);
    });
    walk(template.content, out);
    return out;
}

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Built-in translations use \n between lines and a blank line between paragraphs
export function textToHtml(text, format) {
    if (format === "paragraphs") {
        return text.split(/\n{2,}/).map((p) => `<p>${p.split("\n").map(escapeHtml).join("<br>")}</p>`).join("");
    }
    return text.split("\n").map(escapeHtml).join("<br>");
}

const toString = (fragment, doc = document) => {
    const box = doc.createElement("div");
    box.append(fragment);
    return box.innerHTML;
};

// Lines from sanitised HTML: split at <br>, drop empty trailing lines
function splitLines(html) {
    return html.split(/<br\s*\/?>/i).map((l) => l.trim()).filter((l, i, all) => l || i < all.length - 1);
}

// Paragraphs: <p> elements; text without <p> becomes paragraphs at blank lines (two <br>)
function paragraphs(html, doc = document) {
    const box = doc.createElement("div");
    box.append(sanitize(html, doc));
    const ps = [...box.children].filter((c) => c.tagName.toUpperCase() === "P");
    if (ps.length) return ps.map((p) => p.innerHTML.trim()).filter(Boolean);
    return box.innerHTML.split(/(?:<br\s*\/?>\s*){2,}/i).map((p) => p.trim()).filter(Boolean);
}

export function renderBlock(el, html) {
    const doc = el.ownerDocument;
    const format = el.getAttribute("data-kalq-format");
    if (format === "lines") {
        const lines = splitLines(toString(sanitize(html.replace(/<\/?p>/gi, (t) => (t[1] === "/" ? "<br>" : "")), doc), doc));
        el.replaceChildren(...lines.map((line) => {
            const span = doc.createElement("span");
            span.className = "kalq-line";
            span.append(sanitize(line, doc));
            return span;
        }));
    } else if (format === "paragraphs") {
        el.replaceChildren(...paragraphs(html, doc).map((p) => {
            const node = doc.createElement("p");
            node.append(sanitize(p, doc));
            return node;
        }));
    } else {
        el.replaceChildren(sanitize(html.replace(/<\/?p>/gi, ""), doc));
    }
}

// While editing, a line block shows plain "line<br>line" (no line elements), see editableHtml
export function editableHtml(el) {
    if (el.dataset.kalqFormat !== "lines") return el.innerHTML;
    return [...el.querySelectorAll(".kalq-line")].map((line) => line.innerHTML).join("<br>") || el.innerHTML;
}

// What an edit saves: lines joined by <br>, paragraphs as <p>...</p>, otherwise inline text.
// Browsers wrap new lines or paragraphs in <div> while editing, so those count as breaks too.
export function serializeBlock(el) {
    const format = el.dataset.kalqFormat;
    if (format === "lines") {
        const html = el.innerHTML.replace(/<(div|p)[^>]*>/gi, "<br>").replace(/<\/(div|p)>/gi, "");
        return splitLines(toString(sanitize(html))).join("<br>").replace(/^(<br>)+|(<br>)+$/g, "");
    }
    if (format === "paragraphs") {
        const html = el.innerHTML.replace(/<div[^>]*>/gi, "<p>").replace(/<\/div>/gi, "</p>");
        return paragraphs(html).map((p) => `<p>${p.replace(/(<br>\s*)+$/, "")}</p>`).join("");
    }
    return toString(sanitize(el.innerHTML)).replace(/(<br>\s*)+$/, "").trim();
}

//=================================== Line animation ===================================//
// Every line of a line block rises in with a stagger when the block comes into view (once per page).
export function animateLines(root = document) {
    if (!window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll('[data-kalq-format="lines"]').forEach((block) => {
        if (block.dataset.kalqAnimated) return;
        block.dataset.kalqAnimated = "true";
        const lines = block.querySelectorAll(".kalq-line");
        if (!lines.length) return;
        const inHero = !!block.closest(".header");
        gsap.from(lines, {
            yPercent: 60, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.14,
            delay: inHero ? 0.3 : 0,
            ...(inHero || !window.ScrollTrigger ? {} : { scrollTrigger: { trigger: block, start: "top 85%", once: true } }),
            clearProps: "transform,opacity",
        });
    });
}
