// POST { code }: guest entry with the access code. Guests need no account.
// Checks the code in constant time, rate limits per hashed IP, gives the guest an animal and sets the gate cookie.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { gateCookieHeader, signGate } from "../lib/gate-cookie.js";
import { clientIp, json, readJson } from "../lib/http.js";
import { identityFromHash } from "../lib/identity.js";
import { count, insert, isConfigured, select } from "../lib/supabase-admin.js";

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

    const { code } = await readJson(request);
    const ipHash = sha256(IP_HASH_SALT + clientIp(request)).toString("hex"); // the raw IP is never stored

    if (await tooManyAttempts(ipHash)) return json({ error: "rate_limited" }, 429);
    if (!sameCode(String(code || "").trim().toUpperCase(), ACCESS_CODE.trim().toUpperCase())) {
        return json({ error: "wrong_code" }, 401);
    }

    // Guests have no Supabase account: the code alone lets them in. Their animal is stored per salted IP hash,
    // so the same connection keeps the same animal.
    let identity = identityFromHash(ipHash);
    if (isConfigured()) {
        try {
            identity = await guestIdentity(ipHash);
        } catch (error) {
            console.error("guest_identities unavailable, using the hash alone", error.message);
        }
    }
    // uid = animal part (from the connection) + a per-browser part, so two people in one office stay two people
    const uid = `guest-${ipHash.slice(0, 16)}${randomBytes(4).toString("hex")}`;
    const cookie = await signGate({ role: "guest", uid }, GATE_COOKIE_SECRET);
    return json({ role: "guest", ...identity }, 200, { "Set-Cookie": gateCookieHeader(cookie) });
}
