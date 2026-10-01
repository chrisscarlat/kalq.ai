// One-time seed: every data-kalq-key block of every page becomes a row in `blocks`, plus one initial revision
// per block and language, all in a single site batch "Initial site content".
// Safe to re-run: blocks that already have a revision are skipped.
//
//   node scripts/seed-blocks.mjs --dry-run   # print what would be inserted
//   node scripts/seed-blocks.mjs             # insert (needs SUPABASE_URL and the service role key in .env)
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // decoded, the folder name has ™ in it
const PAGES = { "index.html": "home", "platform.html": "platform", "company.html": "company", "impressum.html": "impressum", "datenschutz.html": "datenschutz" };
const DRY = process.argv.includes("--dry-run");

// .env without a dependency
if (existsSync(`${ROOT}.env`)) {
    for (const line of readFileSync(`${ROOT}.env`, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

const strings = JSON.parse(readFileSync(`${ROOT}i18n/strings.json`, "utf8"));
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const clean = (html) => decode(html.replace(/<(?!\/?(br|em|strong|a)\b)[^>]+>/gi, "").replace(/\s+/g, " ").trim());

const blocks = new Map(); // key -> { page, type }
const revisions = []; // { block_key, page, lang, content }

for (const [file, pageName] of Object.entries(PAGES)) {
    const html = readFileSync(`${ROOT}${file}`, "utf8");
    for (const m of html.matchAll(/<(\w+)((?:[^>"]|"[^"]*")*\sdata-kalq-key="([^"]+)"(?:[^>"]|"[^"]*")*)>/g)) {
        const [whole, tagName, , key] = m;
        if (blocks.has(key)) continue; // shared site.* blocks appear on every page
        const page = key.startsWith("site.") ? "site" : pageName;
        const type = attr(whole, "data-kalq-type") || "text";
        blocks.set(key, { page, type });

        if (type === "image") {
            revisions.push({ block_key: key, page, lang: null, content: attr(whole, "src") || attr(whole, "data-image") });
        } else if (type === "video") {
            const after = html.slice(m.index);
            revisions.push({ block_key: key, page, lang: null, content: attr(after.match(/<source[^>]*>/)[0], "src") });
        } else {
            const i18n = attr(whole, "data-i18n") || attr(whole, "data-i18n-marquee");
            const inner = html.slice(m.index + whole.length, html.indexOf(`</${tagName}>`, m.index + whole.length));
            const de = i18n ? strings[i18n].de ?? strings[i18n].en : clean(inner);
            const en = i18n ? strings[i18n].en : clean(inner);
            revisions.push({ block_key: key, page, lang: "de", content: de }, { block_key: key, page, lang: "en", content: en });
        }
    }
}

console.log(`${blocks.size} blocks, ${revisions.length} revisions`);
if (DRY) {
    for (const r of revisions) console.log(`${r.block_key.padEnd(48)} ${String(r.lang).padEnd(4)} ${r.content.slice(0, 70)}`);
    process.exit(0);
}
if (!URL_ || !KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (put them in .env, e.g. via `npx vercel env pull .env`).");
    process.exit(1);
}

const headers = { apikey: KEY, ...(KEY.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {}), "Content-Type": "application/json" };
const rest = async (path, init = {}) => {
    const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) throw new Error(`${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 || res.status === 201 ? null : res.json();
};

await rest("blocks", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify([...blocks].map(([key, b]) => ({ key, page: b.page, type: b.type }))),
});

const existing = new Set((await rest("revisions?select=block_key")).map((r) => r.block_key));
const batchId = randomUUID();
const fresh = revisions
    .filter((r) => !existing.has(r.block_key))
    .map((r) => ({ ...r, batch_id: batchId, batch_scope: "site", batch_label: "Initial site content" }));

if (fresh.length) await rest("revisions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fresh) });
console.log(`Inserted ${fresh.length} revisions in batch ${batchId}, skipped ${revisions.length - fresh.length} already seeded.`);
