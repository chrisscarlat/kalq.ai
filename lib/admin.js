// Admins (admins table): only they create, edit, delete or publish style variants.
import { getUserById, rpc } from "./supabase-admin.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache = new Map(); // uid -> { admin, until }

export async function isAdmin(session) {
    if (!session || session.role !== "editor" || !UUID.test(session.uid)) return false;
    const cached = cache.get(session.uid);
    if (cached && cached.until > Date.now()) return cached.admin;
    const user = await getUserById(session.uid).catch(() => null);
    const admin = !!user?.email && (await rpc("is_admin_email", { email: user.email }).catch(() => false)) === true;
    cache.set(session.uid, { admin, until: Date.now() + 60_000 });
    return admin;
}
