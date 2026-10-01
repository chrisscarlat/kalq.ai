// GET ?page=home: newest content per block and language for a page, plus the shared site blocks.
// Needs the gate cookie, except for the public legal pages.
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { json } from "../lib/http.js";
import { isConfigured, rpc } from "../lib/supabase-admin.js";

const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];
const PUBLIC_PAGES = ["impressum", "datenschutz"];

export async function GET(request) {
    const page = new URL(request.url).searchParams.get("page");
    if (!PAGES.includes(page)) return json({ error: "page" }, 400);

    if (!PUBLIC_PAGES.includes(page)) {
        const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
        if (!session) return json({ error: "gate" }, 401);
    }

    // Nothing stored yet (or Supabase not connected): the page keeps its built-in content
    if (!isConfigured()) return json({ blocks: [] });
    try {
        const rows = await rpc("latest_content", { page });
        return json({ blocks: rows.map(({ block_key, lang, content, type }) => ({ key: block_key, lang, content, type })) });
    } catch (error) {
        console.error("latest_content failed", error.message);
        return json({ blocks: [] });
    }
}
