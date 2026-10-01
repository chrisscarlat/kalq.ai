// Uploads to Supabase Storage with progress, for the editor (js/edit.js) and the Styles panel (js/styles.js).
// XMLHttpRequest instead of supabase-js, because only it reports upload progress. While a file is on its way a thin
// white line fills along the bottom of the image; a tick shows when it is done.
let config = null;

// Resolves with the public URL; onProgress gets 0 to 1
export async function uploadMedia(sb, path, file, onProgress = () => { }) {
    const { data: auth } = await sb.auth.getSession();
    if (!auth?.session) throw new Error("relogin");
    config ||= await fetch("/api/config").then((r) => r.json());
    const base = config.supabaseUrl.replace(/\/$/, "");
    const type = file.type || (/\.woff2$/i.test(file.name) ? "font/woff2" : "application/octet-stream");
    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${base}/storage/v1/object/site-media/${path.split("/").map(encodeURIComponent).join("/")}`);
        xhr.setRequestHeader("Authorization", `Bearer ${auth.session.access_token}`);
        xhr.setRequestHeader("apikey", config.supabaseAnonKey);
        xhr.setRequestHeader("Content-Type", type);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("upload"));
        xhr.send(file);
    });
    onProgress(1);
    return `${base}/storage/v1/object/public/site-media/${path}`;
}

// The line at the bottom of `host`: set(0..1) while uploading, done() removes it
export function progressLine(host) {
    host.querySelector(":scope > .kalq-progress")?.remove();
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const line = document.createElement("span");
    line.className = "kalq-progress";
    line.setAttribute("role", "progressbar");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    const bar = document.createElement("span");
    bar.style.width = "3%";
    line.append(bar);
    host.append(line);
    const start = performance.now();
    return {
        set: (p) => { const v = Math.round(p * 100); bar.style.width = `${Math.max(3, v)}%`; line.setAttribute("aria-valuenow", v); },
        // Fill to the end and fade, so even a quick upload is seen to finish (at least ~0.8 s on screen)
        done: () => {
            bar.style.width = "100%";
            const wait = Math.max(350, 800 - (performance.now() - start));
            setTimeout(() => { line.classList.add("is-done"); setTimeout(() => line.remove(), 300); }, wait);
        },
    };
}

// A green tick in the middle of `host`, fading out
export function showDone(host) {
    host.querySelector(":scope > .kalq-done")?.remove();
    const tick = document.createElement("span");
    tick.className = "kalq-done";
    tick.textContent = "✓";
    tick.setAttribute("aria-hidden", "true");
    host.append(tick);
    setTimeout(() => tick.remove(), 2600);
}
