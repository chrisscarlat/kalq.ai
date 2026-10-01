// Server-only Supabase access over REST with the service role key. Never import this from browser code.

const env = (name) => process.env[name] || process.env[`NEXT_PUBLIC_${name}`];

export const supabaseUrl = () => (env("SUPABASE_URL") || "").replace(/\/$/, "");
// Legacy (service_role) or new (sb_secret_) key, depending on how the Supabase integration named it
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export const isConfigured = () => Boolean(supabaseUrl() && serviceKey());

// Legacy keys are JWTs and go in both headers; new sb_secret_ keys only in apikey
const serviceHeaders = (extra = {}) => {
    const key = serviceKey();
    return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), ...extra };
};

// Resolves a user access token to the user, or null
export async function getUser(accessToken) {
    if (!accessToken) return null;
    const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
        headers: { apikey: serviceKey(), Authorization: `Bearer ${accessToken}` },
    });
    return res.ok ? res.json() : null;
}

export async function updateAppMetadata(userId, appMetadata) {
    const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: serviceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ app_metadata: appMetadata }),
    });
    if (!res.ok) throw new Error(`app_metadata update failed: ${res.status}`);
    return res.json();
}

export async function rpc(fn, args) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`rpc ${fn} failed: ${res.status}`);
    return res.json();
}

export async function select(table, query) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
    return res.json();
}

// Row count via the Content-Range header
export async function count(table, query) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}&select=*`, {
        method: "HEAD",
        headers: serviceHeaders({ Prefer: "count=exact" }),
    });
    if (!res.ok) throw new Error(`count ${table} failed: ${res.status}`);
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

export async function insert(table, row, { ignoreDuplicates = false } = {}) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
        method: "POST",
        headers: serviceHeaders({
            "Content-Type": "application/json",
            Prefer: ignoreDuplicates ? "resolution=ignore-duplicates,return=minimal" : "return=minimal",
        }),
        body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`insert ${table} failed: ${res.status}`);
}

export async function getUserById(userId) {
    const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: serviceHeaders() });
    return res.ok ? res.json() : null;
}

export async function upsert(table, row) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`upsert ${table} failed: ${res.status}`);
}

export async function insertReturning(table, row) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`insert ${table} failed: ${res.status} ${await res.text()}`);
    return (await res.json())[0];
}

export async function patch(table, query, values) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error(`update ${table} failed: ${res.status} ${await res.text()}`);
    return (await res.json())[0];
}
