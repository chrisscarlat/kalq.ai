// Version history for everyone through the gate; restore for editors only.
//   GET  ?page=home&scope=page|site     batches newest first, with authors
//   GET  ?page=home&preview=<batch>      the page right after that batch
//   POST { batch_id, scope, page }       restore (block | page | site), author from the gate cookie
import { readCookie, verifyGate } from "../lib/gate-token.js";
import { json, readJson } from "../lib/http.js";
import { isConfigured, rpc, select } from "../lib/supabase-admin.js";

const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];
const SCOPES = ["block", "page", "site"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const gate = (request) => verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);

async function people(ids) {
    if (!ids.length) return {};
    const list = ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
    const rows = await select("profiles", `id=in.(${encodeURIComponent(list)})&select=id,kind,display_name,avatar_url,color`).catch(() => []);
    return Object.fromEntries(rows.map((r) => [r.id, { kind: r.kind, name: r.display_name, avatar_url: r.avatar_url, color: r.color }]));
}

export async function GET(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    if (!isConfigured()) return json({ batches: [], people: {} });
    const params = new URL(request.url).searchParams;
    const page = params.get("page");
    if (!PAGES.includes(page)) return json({ error: "page" }, 400);

    const preview = params.get("preview");
    if (preview) {
        if (!UUID.test(preview)) return json({ error: "batch" }, 400);
        const rows = await rpc("content_at", { page, batch: preview });
        return json({ blocks: rows.map(({ block_key, lang, content, type }) => ({ key: block_key, lang, content, type })) });
    }

    const batches = await rpc("history_batches", { page: params.get("scope") === "site" ? null : page, max_rows: 150 });
    const ids = [...new Set(batches.map((b) => b.author_id).filter(Boolean))];
    return json({ batches, people: await people(ids) });
}

export async function POST(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    if (session.role !== "editor") return json({ error: "forbidden" }, 403);
    if (!isConfigured()) return json({ error: "config" }, 500);

    const { batch_id: batchId, scope, page } = await readJson(request);
    if (!UUID.test(String(batchId)) || !SCOPES.includes(scope)) return json({ error: "input" }, 400);
    if (scope !== "site" && !PAGES.includes(page)) return json({ error: "page" }, 400);

    // The batch being restored: its time for the label, its block for a block restore
    const rows = await select("revisions", `batch_id=eq.${batchId}&select=block_key,created_at&order=created_at.desc&limit=50`);
    if (!rows.length) return json({ error: "not_found" }, 404);
    const keys = [...new Set(rows.map((r) => r.block_key))];
    if (scope === "block" && keys.length !== 1) return json({ error: "not_single_block" }, 400);

    const label = `Restored ${scope === "block" ? keys[0] : scope === "page" ? page : "site"} to ${rows[0].created_at}`;
    const [result] = await rpc("restore_to", {
        from_batch: batchId, scope, page: scope === "page" ? page : null, block: scope === "block" ? keys[0] : null,
        author: UUID.test(session.uid) ? session.uid : null, label,
    });
    return json({ batch_id: result.new_batch_id, added: result.added_rows, keys: scope === "block" ? keys : null });
}
