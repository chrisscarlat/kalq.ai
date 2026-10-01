// Comments for everyone through the gate. Guests have no Supabase account, so all reads and writes go
// through here with the service role; the author is always the gate cookie's uid, never the request body.
//   GET   ?page=home                       threads of a page plus the people who wrote them
//   POST  { page, block_key | anchor_selector, x_pct, y_pct, parent_id?, body }
//   PATCH { id, resolved }                  editors, or the comment's author
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { json, readJson } from "../lib/http.js";
import { count, insertReturning, isConfigured, patch, select } from "../lib/supabase-admin.js";

const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9-]+(\.[a-z0-9-]+){1,5}$/;
const MAX_PER_10_MIN = 30;
const FIELDS = "id,page,block_key,anchor_selector,x_pct,y_pct,parent_id,body,author_id,created_at,resolved_at,resolved_by";

const pct = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);

async function gate(request) {
    return verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
}

async function people(ids) {
    if (!ids.length) return {};
    const list = ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
    const rows = await select("profiles", `id=in.(${encodeURIComponent(list)})&select=id,kind,display_name,avatar_url,color`).catch(() => []);
    return Object.fromEntries(rows.map((r) => [r.id, { kind: r.kind, name: r.display_name, avatar_url: r.avatar_url, color: r.color }]));
}

export async function GET(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    const page = new URL(request.url).searchParams.get("page");
    if (!PAGES.includes(page)) return json({ error: "page" }, 400);
    if (!isConfigured()) return json({ comments: [], people: {} });

    const comments = await select("comments", `page=eq.${page}&select=${FIELDS}&order=created_at.asc&limit=2000`);
    const ids = [...new Set(comments.flatMap((c) => [c.author_id, c.resolved_by]).filter(Boolean))];
    return json({ comments, people: await people(ids) });
}

export async function POST(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    if (!isConfigured()) return json({ error: "config" }, 500);

    const input = await readJson(request);
    const body = String(input.body || "").trim();
    if (!PAGES.includes(input.page)) return json({ error: "page" }, 400);
    if (body.length < 1 || body.length > 2000) return json({ error: "body" }, 400);

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await count("comments", `author_id=eq.${encodeURIComponent(session.uid)}&created_at=gte.${since}`).catch(() => 0);
    if (recent >= MAX_PER_10_MIN) return json({ error: "rate_limited" }, 429);

    const row = { page: input.page, body, author_id: session.uid };
    if (input.parent_id) {
        // Replies attach to the thread's first comment and take its position
        if (!UUID.test(input.parent_id)) return json({ error: "parent" }, 400);
        const [parent] = await select("comments", `id=eq.${input.parent_id}&select=${FIELDS}`);
        if (!parent || parent.page !== input.page) return json({ error: "parent" }, 400);
        const root = parent.parent_id ? (await select("comments", `id=eq.${parent.parent_id}&select=${FIELDS}`))[0] : parent;
        Object.assign(row, { parent_id: root.id, block_key: root.block_key, anchor_selector: root.anchor_selector, x_pct: root.x_pct, y_pct: root.y_pct });
    } else {
        const blockKey = typeof input.block_key === "string" && KEY.test(input.block_key) ? input.block_key : null;
        const selector = !blockKey && typeof input.anchor_selector === "string" ? input.anchor_selector.slice(0, 300) : null;
        const x = pct(input.x_pct);
        const y = pct(input.y_pct);
        if (x === null || y === null) return json({ error: "position" }, 400);
        Object.assign(row, { block_key: blockKey, anchor_selector: selector, x_pct: x, y_pct: y });
    }

    const comment = await insertReturning("comments", row);
    return json({ comment, people: await people([session.uid]) }, 201);
}

export async function PATCH(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    if (!isConfigured()) return json({ error: "config" }, 500);

    const { id, resolved } = await readJson(request);
    if (!UUID.test(String(id)) || typeof resolved !== "boolean") return json({ error: "input" }, 400);
    const [comment] = await select("comments", `id=eq.${id}&select=${FIELDS}`);
    if (!comment) return json({ error: "not_found" }, 404);
    if (session.role !== "editor" && comment.author_id !== session.uid) return json({ error: "forbidden" }, 403);

    const updated = await patch("comments", `id=eq.${id}`, resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: session.uid }
        : { resolved_at: null, resolved_by: null });
    return json({ comment: updated });
}
