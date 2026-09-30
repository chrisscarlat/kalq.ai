// POST { code, access_token }: guest entry with the access code.
// Checks the code in constant time, rate limits per hashed IP, gives the anonymous user an animal and sets the gate cookie.
import { createHash, timingSafeEqual } from "node:crypto";
import { gateCookieHeader, signGate } from "../lib/gate-cookie.js";
import { clientIp, json, readJson } from "../lib/http.js";
import { identityFromHash } from "../lib/identity.js";
import { count, getUser, insert, isConfigured, select, updateAppMetadata } from "../lib/supabase-admin.js";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const memoryAttempts = new Map(); // per instance fallback if the table is unavailable

const sha256 = (text) => createHash("sha256").update(text).digest();

// Hashing first makes both sides the same length for timingSafeEqual
const sameCode = (a, b) => timingSafeEqual(sha256(a), sha256(b));

async function tooManyAttempts(ipHash) {
    const now = Date.now();
    const recent = (memoryAttempts.get(ipHash) || []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    memoryAttempts.set(ipHash, recent);

    let stored = 0;
    if (!isConfigured()) return recent.length > MAX_ATTEMPTS;
    try {
        stored = await count("gate_attempts", `ip_hash=eq.${ipHash}&created_at=gte.${new Date(now - WINDOW_MS).toISOString()}`);
        await insert("gate_attempts", { ip_hash: ipHash });
        stored += 1;
    } catch (error) {
        console.error("gate_attempts unavailable, using memory only", error.message);
    }
    return Math.max(stored, recent.length) > MAX_ATTEMPTS;
}

async function guestIdentity(ipHash) {
    const [row] = await select("guest_identities", `ip_hash=eq.${ipHash}&select=animal,emoji,color`);
    if (row) return row;
    const identity = identityFromHash(ipHash);
    await insert("guest_identities", { ip_hash: ipHash, ...identity }, { ignoreDuplicates: true });
    return identity;
}

export async function POST(request) {
    const { ACCESS_CODE, GATE_COOKIE_SECRET, IP_HASH_SALT } = process.env;
    if (!ACCESS_CODE || !GATE_COOKIE_SECRET || !IP_HASH_SALT) return json({ error: "config" }, 500);

    const { code, access_token: accessToken } = await readJson(request);
    const ipHash = sha256(IP_HASH_SALT + clientIp(request)).toString("hex"); // the raw IP is never stored

    if (await tooManyAttempts(ipHash)) return json({ error: "rate_limited" }, 429);
    if (!sameCode(String(code || "").trim().toUpperCase(), ACCESS_CODE.trim().toUpperCase())) {
        return json({ error: "wrong_code" }, 401);
    }

    // Until Supabase is connected: guests still get in, with an animal from the IP hash and no stored session
    if (!isConfigured()) {
        const identity = identityFromHash(ipHash);
        const cookie = await signGate({ role: "guest", uid: `guest-${ipHash.slice(0, 16)}` }, GATE_COOKIE_SECRET);
        return json({ role: "guest", ...identity, supabase: false }, 200, { "Set-Cookie": gateCookieHeader(cookie) });
    }

    const user = await getUser(accessToken);
    if (!user) return json({ error: "session" }, 401);

    // A returning browser keeps its animal even from another connection
    const meta = user.app_metadata || {};
    const identity = meta.animal ? { animal: meta.animal, emoji: meta.emoji, color: meta.color } : await guestIdentity(ipHash);
    if (user.is_anonymous) await updateAppMetadata(user.id, { role: "guest", ...identity });

    const role = meta.role === "editor" ? "editor" : "guest";
    const cookie = await signGate({ role, uid: user.id }, GATE_COOKIE_SECRET);
    return json({ role, ...identity }, 200, { "Set-Cookie": gateCookieHeader(cookie) });
}
