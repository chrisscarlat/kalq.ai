// TEMPORARY diagnostic: which expected variables exist. Names and true/false only, never values. Remove after setup.
import { json } from "../lib/http.js";

const EXPECTED = ["ACCESS_CODE", "GATE_COOKIE_SECRET", "IP_HASH_SALT", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

export function GET() {
    const present = Object.fromEntries(EXPECTED.map((name) => [name, Boolean(process.env[name])]));
    const related = Object.keys(process.env).filter((n) => /SUPABASE|ACCESS_CODE|GATE_|IP_HASH/i.test(n)).sort();
    return json({ env: process.env.VERCEL_ENV || null, present, related });
}
