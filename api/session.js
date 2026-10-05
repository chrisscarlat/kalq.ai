// POST { access_token }: finishes a Google or LinkedIn login.
// Only allowed domains or invited emails become editors and get the gate cookie.
import { gateCookieHeader, signGate } from "../lib/gate-token.js";
import { json, readJson } from "../lib/http.js";
import { colorFromUid } from "../lib/identity.js";
import { getUser, isConfigured, rpc, updateAppMetadata } from "../lib/supabase-admin.js";

export async function POST(request) {
    const { GATE_COOKIE_SECRET } = process.env;
    if (!GATE_COOKIE_SECRET || !isConfigured()) return json({ error: "config" }, 500);

    const { access_token: accessToken } = await readJson(request);
    const user = await getUser(accessToken);
    if (!user) return json({ error: "session" }, 401);
    if (user.is_anonymous || !user.email) return json({ error: "anonymous" }, 400);

    const allowed = await rpc("is_allowed_editor_email", { email: user.email });
    if (allowed !== true) return json({ error: "domain" }, 403);

    const meta = user.app_metadata || {};
    if (meta.role !== "editor" || !meta.color) {
        await updateAppMetadata(user.id, { role: "editor", color: meta.color || colorFromUid(user.id) });
    }

    const cookie = await signGate({ role: "editor", uid: user.id }, GATE_COOKIE_SECRET);
    return json({ role: "editor" }, 200, { "Set-Cookie": gateCookieHeader(cookie) });
}
