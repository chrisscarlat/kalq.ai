// GET: the public Supabase settings for the browser. Never the service role key.
import { json } from "../lib/http.js";

export function GET() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Legacy anon key or the newer publishable key
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "config" }, 500);
    return json({ supabaseUrl, supabaseAnonKey }, 200, { "Cache-Control": "public, max-age=300" });
}
