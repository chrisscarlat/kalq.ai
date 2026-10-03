// GET ?p=home: the page as HTML, rendered on the server from the built page, its layout and its newest content
// (lib/render-page.js). The middleware sends page requests here, so crawlers and visitors without JavaScript get
// the current page. Gated like the static pages, except the public legal pages.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { renderPage } from "../lib/render-page.js";
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

export async function GET(request) {
    const page = new URL(request.url).searchParams.get("p");
    if (!FILES[page]) return new Response("Not found", { status: 404 });

    // The gate itself: shown with 401 to anyone without the cookie (the middleware sends them here)
    if (page === "gate") return html(await template("gate"), 401);

    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
    if (!session && !PUBLIC_PAGES.has(page)) return html(await template("gate"), 401);

    const built = await template(page);
    if (!isConfigured()) return html(built);
    try {
        const rows = await rpc("latest_content", { page });
        return html(renderPage(built, page, rows, { editor: session?.role === "editor" }));
    } catch (error) {
        // The built page is always a working page: better than an error
        console.error("page render failed", page, error.message);
        return html(built);
    }
}
