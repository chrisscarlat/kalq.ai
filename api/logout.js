// POST: clears the gate cookie. The browser signs out of Supabase before calling this.
import { clearGateCookieHeader } from "../lib/gate-cookie.js";
import { json } from "../lib/http.js";

export function POST() {
    return json({ ok: true }, 200, { "Set-Cookie": clearGateCookieHeader() });
}
