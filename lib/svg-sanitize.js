// SVG logo sanitiser, used unchanged in the browser (Styles panel, rendering) and on the server (/api/variants).
// No DOM needed: the SVG is tokenised and rebuilt from an allowlist, so only known shape elements and attributes
// survive. Scripts, event handlers, <foreignObject>, styles, external references and any url() that does not point
// inside the SVG are dropped. Returns "" when nothing usable is left.

const ELEMENTS = new Set([
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "defs", "clippath", "mask", "lineargradient", "radialgradient", "stop", "title", "desc", "use", "symbol",
]);
// Their whole content goes, not just the tag
const DROP_WITH_CONTENT = new Set(["script", "style", "foreignobject", "iframe", "object", "embed", "image", "a", "text", "animate", "set", "animatetransform", "animatemotion", "handler", "listener"]);
const ATTRIBUTES = new Set([
    "xmlns", "viewbox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
    "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
    "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "transform", "clip-path", "clip-rule", "mask",
    "id", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "spreadmethod", "fx", "fy",
    "preserveaspectratio", "clippathunits", "maskunits", "maskcontentunits", "href", "xlink:href", "xmlns:xlink",
    "vector-effect", "shape-rendering", "aria-hidden", "role", "focusable",
]);
const CASE = { viewbox: "viewBox", clippath: "clipPath", lineargradient: "linearGradient", radialgradient: "radialGradient", gradientunits: "gradientUnits", gradienttransform: "gradientTransform", spreadmethod: "spreadMethod", preserveaspectratio: "preserveAspectRatio", clippathunits: "clipPathUnits", maskunits: "maskUnits", maskcontentunits: "maskContentUnits" };
const MAX_LENGTH = 200000;

const escapeAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeText = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decode = (v) => v.replace(/&#(\d+);?/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);?/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function safeValue(name, raw) {
    const value = decode(raw).trim();
    if (/[<>"'`]/.test(value)) return null; // shape attributes never need these
    if (/(javascript|vbscript|data)\s*:/i.test(value.replace(/\s+/g, ""))) return null;
    // Only references inside the SVG: href="#id", url(#id)
    if (name === "href" || name === "xlink:href") return /^#[\w.-]+$/.test(value) ? value : null;
    const urls = value.match(/url\s*\(([^)]*)\)/gi) || [];
    if (urls.some((u) => !/^url\s*\(\s*['"]?#[\w.-]+['"]?\s*\)$/i.test(u))) return null;
    if (name === "xmlns" && value !== "http://www.w3.org/2000/svg") return null;
    if (name === "xmlns:xlink" && value !== "http://www.w3.org/1999/xlink") return null;
    return value.slice(0, 20000);
}

export function sanitizeSvg(input) {
    if (typeof input !== "string" || !input.trim() || input.length > MAX_LENGTH) return "";
    const source = input
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
        .replace(/<\?[\s\S]*?\?>/g, "")
        .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

    const out = [];
    const stack = []; // open elements we kept, or "drop" markers
    let dropDepth = 0;
    const token = /<\/?([A-Za-z][\w:.-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)|</g;
    let m;
    let seenRoot = false;
    while ((m = token.exec(source))) {
        const [whole, rawName, rawAttrs = "", selfClosing, text] = m;
        if (text !== undefined || !rawName) {
            if (!dropDepth && text && stack.length && /^(title|desc)$/.test(stack[stack.length - 1])) out.push(escapeText(decode(text)));
            continue;
        }
        const name = rawName.toLowerCase();
        const closing = whole.startsWith("</");

        if (closing) {
            if (dropDepth) {
                if (stack[stack.length - 1] === `drop:${name}`) { stack.pop(); dropDepth--; }
                continue;
            }
            const i = stack.lastIndexOf(name);
            if (i === -1) continue; // closing a tag we never kept
            while (stack.length > i) {
                const open = stack.pop();
                out.push(`</${CASE[open] || open}>`);
            }
            continue;
        }
        // Inside a dropped element, or a dropped element itself (also namespaced ones like <svg:script>)
        if (dropDepth || DROP_WITH_CONTENT.has(name) || name.includes(":")) {
            if (!selfClosing) { stack.push(`drop:${name}`); dropDepth++; }
            continue;
        }
        if (!ELEMENTS.has(name)) continue; // unknown element: tag dropped, children judged on their own
        if (!seenRoot && name !== "svg") continue;
        seenRoot = true;
        if (name === "use" && !/(?:^|\s)(?:xlink:)?href\s*=\s*["']#/i.test(rawAttrs)) continue;

        const attrs = [];
        const attr = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
        let a;
        while ((a = attr.exec(rawAttrs))) {
            const attrName = a[1].toLowerCase();
            if (!ATTRIBUTES.has(attrName) || attrName.startsWith("on")) continue;
            const value = safeValue(attrName, a[2] ?? a[3] ?? a[4] ?? "");
            if (value === null) continue;
            attrs.push(` ${CASE[attrName] || attrName}="${escapeAttr(value)}"`);
        }
        if (name === "svg" && !attrs.some((x) => x.startsWith(" xmlns="))) attrs.unshift(' xmlns="http://www.w3.org/2000/svg"');
        out.push(`<${CASE[name] || name}${attrs.join("")}${selfClosing ? "/" : ""}>`);
        if (!selfClosing) stack.push(name);
    }
    while (stack.length) {
        const name = stack.pop();
        if (!name.startsWith("drop:")) out.push(`</${CASE[name] || name}>`);
    }
    const svg = out.join("");
    return /^<svg[\s>]/.test(svg) && /<(path|rect|circle|ellipse|line|polyline|polygon|use)\b/.test(svg) ? svg : "";
}
