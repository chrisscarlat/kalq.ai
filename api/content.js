// GET ?page=home: newest content per block and language for a page, plus the shared site blocks.
// Needs the gate cookie, except for the public legal pages.
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { json } from "../lib/http.js";
import { isConfigured, rpc } from "../lib/supabase-admin.js";
import { layoutKey, parseLayout, sectionPrefix } from "../js/layout.js";

const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];
const PUBLIC_PAGES = ["impressum", "datenschutz"];

export async function GET(request) {
    const page = new URL(request.url).searchParams.get("page");
    if (!PAGES.includes(page)) return json({ error: "page" }, 400);

    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
    if (!PUBLIC_PAGES.includes(page) && !session) return json({ error: "gate" }, 401);

    // Nothing stored yet (or Supabase not connected): the page keeps its built-in content
    if (!isConfigured()) return json({ blocks: [] });
    try {
        const rows = await rpc("latest_content", { page });
        const visible = session?.role === "editor" ? rows : withoutDrafts(rows, page);
        return json({ blocks: visible.map(({ block_key, lang, content, type }) => ({ key: block_key, lang, content, type })) });
    } catch (error) {
        console.error("latest_content failed", error.message);
        return json({ blocks: [] });
    }
}

// Drafts are for editors only: their sections leave the layout and their blocks are not sent
function withoutDrafts(rows, page) {
    const key = layoutKey(page);
    const layoutRow = rows.find((r) => r.block_key === key);
    const layout = parseLayout(layoutRow?.content);
    if (!layout) return rows;
    const drafts = layout.sections.filter((s) => s.state === "draft").map((s) => sectionPrefix(page, s.id));
    if (!drafts.length) return rows;
    const live = JSON.stringify({ ...layout, sections: layout.sections.filter((s) => s.state !== "draft") });
    return rows.filter((r) => !drafts.some((prefix) => r.block_key.startsWith(prefix)))
        .map((r) => (r === layoutRow ? { ...r, content: live } : r));
}
