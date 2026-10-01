// POST { email }: editors invite a colleague. Adds the email to `invites` (so the signup hook lets it in) and
// sends a Supabase invite email; the invited person can also just log in with Google or LinkedIn.
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { json, readJson } from "../lib/http.js";
import { isConfigured, supabaseUrl, upsert } from "../lib/supabase-admin.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
    const session = await verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);
    if (!session) return json({ error: "gate" }, 401);
    if (session.role !== "editor") return json({ error: "forbidden" }, 403);
    if (!isConfigured()) return json({ error: "config" }, 500);

    const email = String((await readJson(request)).email || "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) return json({ error: "email" }, 400);

    await upsert("invites", { email, invited_by: /^[0-9a-f-]{36}$/i.test(session.uid) ? session.uid : null });

    const origin = new URL(request.url).origin;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const res = await fetch(`${supabaseUrl()}/auth/v1/invite?redirect_to=${encodeURIComponent(`${origin}/gate.html`)}`, {
        method: "POST",
        headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    // Already has an account: the invite still counts, they can log in right away
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 422 || /already/i.test(text)) return json({ ok: true, existing: true });
        console.error("invite email failed", res.status, text);
        return json({ ok: true, emailed: false });
    }
    return json({ ok: true, emailed: true });
}
