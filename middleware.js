// Vercel Routing Middleware: the temporary full-site gate.
// Every request needs a valid signed kalq_gate cookie, otherwise the gate page is shown.
import { next, rewrite } from "@vercel/functions";
import { readCookie, safeNext, verifyGate } from "./lib/gate-token.js";

// Public without a cookie: the gate and its files, the API, and what the legal pages need (styles, scripts).
// The legal pages themselves are public too, see PUBLIC_PAGES below.
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
    /^\/js\/(gate|logoAnimation|main|header|i18n|strings-public|content|blocks|layout|moduleBehaviour|variants|collab|expertiseHoverimg|verticleLine|heroTone|heroReveal|dontpanic)\.js$/,
    /^\/lib\/svg-sanitize\.js$/, // style variant logos are sanitised in the browser too
    /^\/js\/modules\/(registry|kit|final|destinations|scrollEffects)\.js$/, // modules on the legal pages render in the browser too (registry imports the others)
];

// Pages are rendered on the server (api/page.js) from the built HTML, the layout and the newest content
const PAGES = { "/": "home", "/index": "home", "/index.html": "home", "/platform": "platform", "/platform.html": "platform",
    "/company": "company", "/company.html": "company", "/impressum": "impressum", "/impressum.html": "impressum",
    "/datenschutz": "datenschutz", "/datenschutz.html": "datenschutz" };
const PUBLIC_PAGES = new Set(["impressum", "datenschutz"]);
const renderPage = (page, request) => rewrite(new URL(`/api/page?p=${page}`, request.url));

export default async function middleware(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const page = PAGES[path];
    if (page && PUBLIC_PAGES.has(page)) return renderPage(page, request);
    if (PUBLIC.some((rule) => rule.test(path))) return next();

    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);

    if (path === "/gate.html" || path === "/gate") {
        // Already through the gate: go where they were heading
        if (session) return Response.redirect(new URL(safeNext(url.searchParams.get("next")), url), 302);
        return next();
    }

    if (session) return page ? renderPage(page, request) : next();

    // The gate, with status 401 (api/page.js), so a Barba page transition from a public legal page falls back to a
    // full page load. Read from the deployment's files, never fetched over HTTP: on a protected preview that fetch
    // would get Vercel's login page instead of the gate.
    return rewrite(new URL("/api/page?p=gate", request.url));
}
