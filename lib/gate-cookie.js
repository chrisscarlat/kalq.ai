// Signed gate cookie: base64url(JSON {role, uid, exp}) + "." + base64url(HMAC SHA-256).
// Uses Web Crypto only, so the same code runs in the edge middleware and in Node functions.

export const COOKIE_NAME = "kalq_gate";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

const toB64url = (bytes) => {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (text) => {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const hmacKey = (secret) =>
    crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function signGate({ role, uid }, secret) {
    const payload = toB64url(encoder.encode(JSON.stringify({ role, uid, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
    const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
    return `${payload}.${toB64url(new Uint8Array(signature))}`;
}

// Returns {role, uid, exp} or null. Missing secret fails closed.
export async function verifyGate(value, secret) {
    if (!value || !secret) return null;
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    try {
        const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(signature), encoder.encode(payload));
        if (!valid) return null;
        const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
        if (!["editor", "guest"].includes(data.role) || typeof data.exp !== "number") return null;
        return data.exp > Date.now() / 1000 ? data : null;
    } catch {
        return null;
    }
}

export function readCookie(header, name = COOKIE_NAME) {
    if (!header) return null;
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return null;
}

export const gateCookieHeader = (value) =>
    `${COOKIE_NAME}=${value}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;

export const clearGateCookieHeader = () =>
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

// Only same-origin paths, never back to the gate itself
export function safeNext(next) {
    if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
    if (next.startsWith("/gate")) return "/";
    return next;
}
