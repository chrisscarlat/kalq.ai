// Style variants.
//   GET                          published variants (without a cookie only what the gate needs: letter, logo, colours);
//                                with the gate cookie also votes and voters; admins also drafts
//   GET  ?history=<id>           a variant's versions (admins)
//   POST { action: "save", id?, data }        admins: create or update (validated, logo sanitised)
//   POST { action: "delete", id }             admins: mark deleted (stays in history, restorable)
//   POST { action: "restore", id, batch_id }  admins: back to that version
//   POST { action: "vote", id }               everyone through the gate: toggle own vote
import { randomUUID } from "node:crypto";
import { readCookie, verifyGate } from "../lib/gate-cookie.js";
import { json, readJson } from "../lib/http.js";
import { isAdmin } from "../lib/admin.js";
import { insert, isConfigured, remove, rpc, select, supabaseUrl } from "../lib/supabase-admin.js";
import { normalizeVariant } from "../lib/variant.js";

const ID = /^[a-z0-9-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const gate = (request) => verifyGate(readCookie(request.headers.get("cookie")), process.env.GATE_COOKIE_SECRET);

// Latest state of every variant
async function allVariants() {
    const rows = await rpc("latest_content", { page: "variants" });
    return rows
        .filter((r) => r.block_key.startsWith("variant."))
        .map((r) => { try { return { id: r.block_key.slice(8), ...JSON.parse(r.content), updated_at: r.created_at }; } catch { return null; } })
        .filter((v) => v && v.status !== "deleted")
        .sort((a, b) => (a.sort - b.sort) || a.letter.localeCompare(b.letter));
}

async function people(ids) {
    if (!ids.length) return {};
    const list = ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
    const rows = await select("profiles", `id=in.(${encodeURIComponent(list)})&select=id,kind,display_name,avatar_url,color`).catch(() => []);
    return Object.fromEntries(rows.map((r) => [r.id, { kind: r.kind, name: r.display_name, avatar_url: r.avatar_url, color: r.color }]));
}

async function writeBatch(variants, author, label) {
    const batch = randomUUID();
    for (const v of variants) {
        await insert("blocks", { key: `variant.${v.id}`, page: "variants", type: "text" }, { ignoreDuplicates: true });
    }
    await insert("revisions", variants.map(({ id, updated_at, ...data }) => ({
        block_key: `variant.${id}`, page: "variants", lang: null, content: JSON.stringify(data),
        author_id: UUID.test(author) ? author : null, batch_id: batch, batch_scope: variants.length > 1 ? "page" : "block", batch_label: label,
    })));
    return batch;
}

export async function GET(request) {
    if (!isConfigured()) return json({ variants: [] });
    const session = await gate(request);
    const params = new URL(request.url).searchParams;
    const admin = await isAdmin(session);

    const history = params.get("history");
    if (history) {
        if (!admin) return json({ error: "forbidden" }, 403);
        if (!ID.test(history)) return json({ error: "id" }, 400);
        const rows = await select("revisions", `block_key=eq.variant.${history}&select=batch_id,created_at,author_id,batch_label,content&order=seq.desc&limit=60`);
        const versions = rows.map((r) => { let d = {}; try { d = JSON.parse(r.content); } catch { } return { batch_id: r.batch_id, created_at: r.created_at, author_id: r.author_id, label: r.batch_label, status: d.status, name: d.name, letter: d.letter }; });
        return json({ versions, people: await people([...new Set(rows.map((r) => r.author_id).filter(Boolean))]) });
    }

    const variants = (await allVariants()).filter((v) => admin || v.status === "published");
    if (!session) {
        // The gate page: only what its logo cycle needs
        return json({ variants: variants.map(({ id, letter, logo_svg, colors, is_default }) => ({ id, letter, logo_svg, colors, is_default })) }, 200, { "Cache-Control": "public, max-age=30" });
    }
    const votes = await select("variant_votes", `select=variant_key,voter_id,created_at&order=created_at.asc`).catch(() => []);
    const byVariant = {};
    votes.forEach((v) => { (byVariant[v.variant_key.slice(8)] ||= []).push(v.voter_id); });
    // Admins: every image and video slot of the site, for the per-image replacements in the Styles panel
    const slots = admin ? await select("blocks", `type=in.(image,video)&select=key,page,type&order=key.asc`).catch(() => []) : undefined;
    return json({ variants, votes: byVariant, people: await people([...new Set(votes.map((v) => v.voter_id))]), admin, me: session.uid, slots });
}

export async function POST(request) {
    const session = await gate(request);
    if (!session) return json({ error: "gate" }, 401);
    if (!isConfigured()) return json({ error: "config" }, 500);
    const body = await readJson(request);
    const id = body.id ? String(body.id) : null;
    if (id && !ID.test(id)) return json({ error: "id" }, 400);

    if (body.action === "vote") {
        if (!id) return json({ error: "id" }, 400);
        const variant = (await allVariants()).find((v) => v.id === id && v.status === "published");
        if (!variant) return json({ error: "not_found" }, 404);
        const key = `variant.${id}`;
        const mine = `variant_key=eq.${encodeURIComponent(key)}&voter_id=eq.${encodeURIComponent(session.uid)}`;
        const [existing] = await select("variant_votes", `${mine}&select=voter_id`);
        if (existing) await remove("variant_votes", mine);
        else await insert("variant_votes", { variant_key: key, voter_id: session.uid }, { ignoreDuplicates: true });
        return json({ voted: !existing });
    }

    if (!(await isAdmin(session))) return json({ error: "forbidden" }, 403);
    const variants = await allVariants();

    if (body.action === "save") {
        let data;
        try { data = normalizeVariant(body.data, supabaseUrl()); }
        catch (error) { return json({ error: "invalid", field: error.message }, 400); }
        const current = id ? variants.find((v) => v.id === id) : null;
        if (id && !current) return json({ error: "not_found" }, 404);
        if (variants.some((v) => v.letter === data.letter && v.id !== id)) return json({ error: "letter_taken" }, 409);
        const wasDefault = current?.is_default;
        if (data.is_default && data.status !== "published") return json({ error: "default_must_be_published" }, 400);
        if (wasDefault && !data.is_default) return json({ error: "choose_another_default" }, 400);

        const saved = { id: id || randomUUID().slice(0, 8), ...data };
        // One default: the others lose the flag in the same batch
        const others = data.is_default ? variants.filter((v) => v.id !== saved.id && v.is_default).map((v) => ({ ...v, is_default: false })) : [];
        const batch = await writeBatch([saved, ...others], session.uid, `${current ? "Edited" : "Created"} variant ${data.letter}`);
        return json({ variant: saved, batch_id: batch });
    }

    if (body.action === "delete") {
        const current = variants.find((v) => v.id === id);
        if (!current) return json({ error: "not_found" }, 404);
        if (current.is_default) return json({ error: "default_cannot_be_deleted" }, 400);
        await writeBatch([{ ...current, status: "deleted" }], session.uid, `Deleted variant ${current.letter}`);
        return json({ ok: true });
    }

    if (body.action === "restore") {
        if (!id || !UUID.test(String(body.batch_id))) return json({ error: "input" }, 400);
        const [result] = await rpc("restore_to", {
            from_batch: body.batch_id, scope: "block", page: "variants", block: `variant.${id}`,
            author: UUID.test(session.uid) ? session.uid : null, label: `Restored variant.${id} to ${new Date().toISOString()}`,
        });
        // A restore must not leave two defaults or none: re-check and repair in a follow-up batch
        const after = await allVariants();
        const defaults = after.filter((v) => v.is_default);
        if (defaults.length > 1) {
            const keep = defaults.find((v) => v.id === id) || defaults[0];
            await writeBatch(defaults.filter((v) => v !== keep).map((v) => ({ ...v, is_default: false })), session.uid, "Kept one default variant");
        }
        return json({ added: result.added_rows });
    }

    return json({ error: "action" }, 400);
}
