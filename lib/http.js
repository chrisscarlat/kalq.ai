// Small helpers shared by the /api functions

export const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    });

export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

// First hop of x-forwarded-for, as set by Vercel
export function clientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "unknown";
}
