// Vercel Routing Middleware: the temporary full-site gate.
// Every request needs a valid signed kalq_gate cookie, otherwise the gate page is shown.
import { next, rewrite } from "@vercel/functions";
import { readCookie, safeNext, verifyGate } from "./lib/gate-cookie.js";

// Public without a cookie: the gate and its files, the API, and the legal pages with their styles and scripts.
// The site's copy stays gated: page HTML and js/strings.js are not listed here (legal copy is in strings-public.js).
const PUBLIC = [
    /^\/api\//,
    /^\/fonts\//,
    /^\/assets\/kalq-mark\.svg$/,
    /^\/assets\/favicon\.(svg|png)$/,
    /^\/assets\/apple-touch-icon\.png$/,
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
    /^\/css\/(gate|main|collab)\.css$/,
    /^\/js\/(gate|logoAnimation|main|header|i18n|strings-public|content|blocks|collab|expertiseHoverimg|verticleLine)\.js$/,
    /^\/(impressum|datenschutz)(\.html)?$/,
];

export default async function middleware(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (PUBLIC.some((rule) => rule.test(path))) return next();

    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);

    if (path === "/gate.html" || path === "/gate") {
        // Already through the gate: go where they were heading
        if (session) return Response.redirect(new URL(safeNext(url.searchParams.get("next")), url), 302);
        return next();
    }

    if (session) return next();

    // Gate with status 401, so a Barba page transition from a public legal page falls back to a full page load
    try {
        const gate = await fetch(new URL("/gate.html", url));
        if (gate.ok) {
            return new Response(gate.body, {
                status: 401,
                headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            });
        }
    } catch (error) {
        console.error("gate fetch failed", error);
    }
    return rewrite(new URL("/gate.html", request.url));
}
