// Vercel Routing Middleware: the temporary full-site gate.
// Every request needs a valid signed kalq_gate cookie, otherwise it is rewritten to /gate.html.
import { next, rewrite } from "@vercel/functions";
import { readCookie, safeNext, verifyGate } from "./lib/gate-cookie.js";

// What the gate page itself needs, plus the API
const PUBLIC = [
    /^\/api\//,
    /^\/fonts\//,
    /^\/assets\/kalq-mark\.svg$/,
    /^\/assets\/favicon\.(svg|png)$/,
    /^\/assets\/apple-touch-icon\.png$/,
    /^\/favicon\.ico$/,
    /^\/css\/gate\.css$/,
    /^\/js\/(gate|logoAnimation)\.js$/,
    /^\/robots\.txt$/,
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
    return rewrite(new URL("/gate.html", request.url));
}
