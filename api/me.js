// GET: who the visitor is, for presence, cursors and comments. Needs the gate cookie.
// Also returns the realtime channel key: channels are named presence:<page>:<key>, so only people
// through the gate can find them (guests have no Supabase account, so the channels cannot be private).
import { createHmac } from "node:crypto";
import { readCookie, verifyGate } from "../lib/gate-token.js";
import { json } from "../lib/http.js";
import { colorFromUid, identityFromHash } from "../lib/identity.js";
import { isAdmin } from "../lib/admin.js";
import { getUserById, isConfigured, upsert } from "../lib/supabase-admin.js";

export async function GET(request) {
    const secret = process.env.GATE_COOKIE_SECRET;
    const session = await verifyGate(readCookie(request.headers.get("cookie")), secret);
    if (!session) return json({ error: "gate" }, 401);

    const channelKey = createHmac("sha256", secret).update("realtime-v1").digest("hex").slice(0, 24);
    let me;

    if (session.role === "guest") {
        // The first 16 hex characters come from the connection, as in /api/code, so the animal matches guest_identities
        const { animal, emoji, color } = identityFromHash(session.uid.replace(/^guest-/, ""));
        me = { uid: session.uid, kind: "guest", name: `Guest ${animal}`, animal, emoji, color, avatar_url: null };
    } else {
        const user = isConfigured() ? await getUserById(session.uid).catch(() => null) : null;
        const meta = user?.user_metadata || {};
        const name = meta.full_name || meta.name || (user?.email || "").split("@")[0] || "Editor";
        me = {
            uid: session.uid, kind: "editor", name, emoji: null,
            color: user?.app_metadata?.color || colorFromUid(session.uid),
            avatar_url: meta.avatar_url || meta.picture || null,
        };
    }

    // Profiles are filled on first session (best effort, the table may not exist yet)
    if (isConfigured()) {
        // Awaited: a serverless function may stop as soon as the response is sent
        await upsert("profiles", { id: me.uid, kind: me.kind, display_name: me.name, avatar_url: me.avatar_url, color: me.color, updated_at: new Date().toISOString() })
            .catch((error) => console.error("profiles", error.message));
    }

    return json({ ...me, channelKey, is_admin: isConfigured() ? await isAdmin(session) : false });
}
