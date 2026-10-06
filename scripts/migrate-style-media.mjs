// One-time migration: pictures and videos become each style's own (js/styleMedia.js); modules, their order and every
// text stay shared. For every style and every picture slot it writes what that style shows today into the style's own
// block "<slot>@<style id>": its old replacement (images / hero_video in the style record) if it has one, else the
// page's file. So every style looks exactly as before; nothing is merged, nothing deleted (the old replacements stay in
// each style's history, and the archive keeps the record). Slots a style already has its own block for are left.
//
//   node scripts/migrate-style-media.mjs                  # plan only: counts per style and page
//   node scripts/migrate-style-media.mjs --archive FILE   # plan, and the full record to FILE (JSON)
//   node scripts/migrate-style-media.mjs --apply          # write, one batch per style (restorable in Versions)
// Needs SUPABASE_URL and the service role key in .env.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
if (existsSync(`${ROOT}.env`)) {
    for (const line of readFileSync(`${ROOT}.env`, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
const URL_ = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (.env)"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const ARCHIVE = process.argv.includes("--archive") ? process.argv[process.argv.indexOf("--archive") + 1] : null;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const get = async (q) => { const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H }); if (!r.ok) throw new Error(`${q}: ${r.status}`); return r.json(); };
const rpc = async (fn, args) => { const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) }); if (!r.ok) throw new Error(`${fn}: ${r.status}`); return r.json(); };
const post = async (table, rows, prefer = "") => { const r = await fetch(`${URL_}/rest/v1/${table}`, { method: "POST", headers: { ...H, Prefer: prefer }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`); };
const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

// every style, newest version (deleted ones skipped)
const vrows = await get("revisions?select=block_key,content,created_at&page=eq.variants&order=created_at.desc&limit=5000");
const latest = new Map();
for (const r of vrows) if (!latest.has(r.block_key)) latest.set(r.block_key, r);
const styles = [...latest.values()].map((r) => { try { const v = JSON.parse(r.content); return v && { ...v, id: r.block_key.slice(8) }; } catch { return null; } }).filter((v) => v && v.letter)
    .sort((a, b) => String(a.letter).localeCompare(String(b.letter)));

// every page's newest picture and video blocks
const PAGES = ["home", "platform", "company", "impressum", "datenschutz"];
const pageMedia = new Map(); // slot → file
const own = new Set(); // "<slot>@<style id>" blocks that exist already
for (const page of PAGES) {
    for (const r of await rpc("latest_content", { page })) {
        if (r.type !== "image" && r.type !== "video") continue;
        if (r.block_key.includes("@")) own.add(r.block_key);
        else if (r.content) pageMedia.set(r.block_key, r.content);
    }
}
const legacy = (v, key) => (key === "home.hero.video" ? v.hero_video : v.images?.[key]) || "";
const slots = [...new Set([...pageMedia.keys(), ...styles.flatMap((v) => [...Object.keys(v.images || {}), ...(v.hero_video ? ["home.hero.video"] : [])])])].sort();

const plan = styles.map((v) => {
    const writes = [];
    for (const key of slots) {
        if (own.has(`${key}@${v.id}`)) continue;
        const mine = legacy(v, key);
        const file = mine || pageMedia.get(key) || "";
        if (!file) continue;
        writes.push({ key, page: key.split(".")[0], file, from: mine ? "own" : "page" });
    }
    return { id: v.id, letter: v.letter, name: v.name, status: v.status, is_default: !!v.is_default, writes };
});

console.log(`slots with a picture or video: ${slots.length}; styles: ${styles.length}\n`);
for (const s of plan) {
    const by = {};
    s.writes.forEach((w) => { const b = (by[w.page] ||= { own: 0, page: 0 }); b[w.from]++; });
    console.log(`style ${s.letter} (${s.name}${s.status === "draft" ? ", draft" : ""}${s.is_default ? ", default" : ""}): ${s.writes.length} slots`
        + Object.entries(by).map(([p, b]) => `\n    ${p}: ${b.own + b.page} (${b.own} its own, ${b.page} the page's)`).join(""));
}
const total = plan.reduce((a, s) => a + s.writes.length, 0);
console.log(`\ntotal: ${total} blocks to write, in ${plan.filter((s) => s.writes.length).length} batches (one per style)`);
if (ARCHIVE) {
    writeFileSync(ARCHIVE, JSON.stringify({ at: new Date().toISOString(), rule: "each style keeps what it shows: its own replacement, else the page's file", slots, pageMedia: Object.fromEntries(pageMedia),
        styles: styles.map((v) => ({ id: v.id, letter: v.letter, name: v.name, status: v.status, is_default: !!v.is_default, hero_video: v.hero_video || "", images: v.images || {} })), plan }, null, 1));
    console.log(`archive: ${ARCHIVE}`);
}
if (!APPLY) { console.log("plan only: nothing written (--apply writes it)"); process.exit(0); }
for (const s of plan) {
    if (!s.writes.length) continue;
    const batch = randomUUID();
    await post("blocks", s.writes.map((w) => ({ key: `${w.key}@${s.id}`, page: w.page, type: VIDEO.test(w.file) ? "video" : "image" })), "resolution=ignore-duplicates");
    await post("revisions", s.writes.map((w) => ({ block_key: `${w.key}@${s.id}`, page: w.page, lang: null, content: w.file, batch_id: batch, batch_scope: "site",
        batch_label: `Pictures per style: style ${s.letter} keeps what it showed` })));
    console.log(`written: style ${s.letter}, ${s.writes.length} blocks (${batch})`);
}
