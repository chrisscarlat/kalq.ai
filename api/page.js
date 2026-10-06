// GET ?p=home: the page as HTML, rendered on the server from the built page, its layout and its newest content
// (lib/render-page.js). The middleware sends page requests here, so crawlers and visitors without JavaScript get
// the current page. Gated like the static pages, except the public legal pages.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCookie, verifyGate } from "../lib/gate-token.js";
import { renderGate, renderPage } from "../lib/render-page.js";
import { isConfigured, rpc } from "../lib/supabase-admin.js";

const FILES = { home: "index.html", platform: "platform.html", company: "company.html", impressum: "impressum.html", datenschutz: "datenschutz.html", gate: "gate.html" };
const PUBLIC_PAGES = new Set(["impressum", "datenschutz"]);
const templates = new Map(); // built HTML per page, read once per instance

async function template(page) {
    if (!templates.has(page)) templates.set(page, await readFile(path.join(process.cwd(), FILES[page]), "utf8"));
    return templates.get(page);
}

const html = (body, status = 200) => new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
});

// The default style variant's navigation and footer, so the page arrives with them (the browser can switch later)
async function defaultLook() {
    const rows = await rpc("latest_content", { page: "variants" }).catch(() => []);
    const variants = rows.filter((r) => r.block_key.startsWith("variant.")).map((r) => { try { return JSON.parse(r.content); } catch { return null; } })
        .filter((v) => v && v.status === "published");
    const v = variants.find((x) => x.is_default) || variants.sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50) || String(a.letter).localeCompare(String(b.letter)))[0];
    // its look, and what the page's pictures are drawn from (pictures are per style: js/styleMedia.js)
    return v ? { id: v.id, menu_style: v.menu_style, footer_style: v.footer_style, footer_wordmark: v.footer_wordmark, footer_gradient: v.footer_gradient,
        images: v.images || {}, hero_video: v.hero_video || "" } : null;
}

// The gate, with the cookie bar's stored mode and texts (the site blocks); as built if Supabase is not reachable
async function gatePage() {
    const built = await template("gate");
    if (!isConfigured()) return built;
    try { return renderGate(built, await rpc("latest_content", { page: "site" })); }
    catch (error) { console.error("gate render failed", error.message); return built; }
}

export async function GET(request) {
    const page = new URL(request.url).searchParams.get("p");
    if (!FILES[page]) return new Response("Not found", { status: 404 });

    // The gate itself: shown with 401 to anyone without the cookie (the middleware sends them here)
    if (page === "gate") return html(await gatePage(), 401);

    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
    if (!session && !PUBLIC_PAGES.has(page)) return html(await gatePage(), 401);

    const built = await template(page);
    if (!isConfigured()) return html(built);
    try {
        const [rows, look] = await Promise.all([rpc("latest_content", { page }), defaultLook()]);
        return html(renderPage(built, page, rows, { editor: session?.role === "editor", look }));
    } catch (error) {
        // The built page is always a working page: better than an error
        console.error("page render failed", page, error.message);
        return html(built);
    }
}
