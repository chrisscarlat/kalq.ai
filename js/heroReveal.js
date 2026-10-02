// Liquid reveal (style variant option "Effekte": html.reveal-hero or html.reveal-all). Over the home hero, and with
// "Hero und Bilder" over the page's photos and videos too, the picture is grey; the pointer paints a soft trail into a
// small mask and a WebGL layer turns it into a liquid shape (noise warped edges, a light rim) that shows the picture
// in full colour. The trail flows out and dissolves on its own. One canvas moves to whichever picture is under the
// pointer, so there is only ever one WebGL context.
const MASK_SCALE = 0.5; // the trail is drawn at half size, the shader smooths it
const FADE = 0.045; // how fast the trail dissolves per frame
const IDLE_FRAMES = 140; // keep drawing this long after the last move, until the trail is gone
const HOSTS = '[data-barba="container"] > section.header, [data-barba="container"] .parallax_img';

const VERT = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D media, mask;
uniform vec4 box; // the picture's box inside the host: x, y, width, height (0..1)
uniform vec2 cover; // object-fit: cover, as a scale around the centre of that box
uniform float time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
    vec2 q = vec2(uv.x, 1.0 - uv.y);
    vec2 n = vec2(noise(q * 6.0 + time * 0.35), noise(q * 6.0 - time * 0.3 + 7.0)) - 0.5;
    float m = texture2D(mask, q + n * 0.035).a; // the trail lives in alpha (the colour is white wherever it is drawn)
    float shape = smoothstep(0.14, 0.34, m);
    float rim = smoothstep(0.08, 0.15, m) - smoothstep(0.15, 0.28, m);
    // inside, the picture bends a little like through water
    vec2 b = (q - box.xy) / box.zw;
    vec2 v = (b - 0.5) * cover + 0.5 + n * 0.018 * shape;
    vec3 c = texture2D(media, v).rgb * 1.12 + 0.03; // full colour, a little brighter than the grey around it
    c = mix(c, vec3(1.0), rim * 0.22);
    float a = max(shape, rim * 0.6);
    gl_FragColor = vec4(c * a, a);
}`;

let gfx = null; // the one WebGL canvas and its program
let target = null; // { host, media, isVideo, uploaded }
let raf = 0, idle = 0, last = null;
const start = performance.now();

const mode = () => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
    return root.classList.contains("reveal-all") ? "all" : root.classList.contains("reveal-hero") ? "hero" : "off";
};

function createGfx() {
    const canvas = document.createElement("canvas");
    canvas.className = "kalq-reveal";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const texture = (unit) => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((w) => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    };
    const mediaTex = texture(0), maskTex = texture(1);
    gl.uniform1i(gl.getUniformLocation(prog, "media"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "mask"), 1);
    const maskCanvas = document.createElement("canvas");
    return {
        canvas, gl, mediaTex, maskTex, maskCanvas, mctx: maskCanvas.getContext("2d"),
        uBox: gl.getUniformLocation(prog, "box"), uCover: gl.getUniformLocation(prog, "cover"), uTime: gl.getUniformLocation(prog, "time"),
    };
}

// Another origin (Storage, Unsplash) must be loaded in CORS mode before WebGL may read it
function corsReady(media) {
    const src = media.currentSrc || media.getAttribute("src") || media.querySelector?.("source")?.getAttribute("src");
    if (!src || new URL(src, location.href).origin === location.origin || media.crossOrigin === "anonymous") return true;
    media.crossOrigin = "anonymous";
    if (media.tagName === "VIDEO") media.load();
    else media.src = src;
    return false;
}

function attach(host) {
    const media = host.querySelector("video, img");
    if (!media || !corsReady(media)) return false;
    gfx ||= createGfx();
    if (!gfx) return false;
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    gfx.canvas.width = Math.round(r.width * dpr);
    gfx.canvas.height = Math.round(r.height * dpr);
    gfx.maskCanvas.width = Math.max(2, Math.round(r.width * MASK_SCALE));
    gfx.maskCanvas.height = Math.max(2, Math.round(r.height * MASK_SCALE));
    gfx.gl.viewport(0, 0, gfx.canvas.width, gfx.canvas.height);
    // In the hero: over the darkening layer, under the title. In an image box: on top of the picture.
    const layer = host.querySelector(":scope > .hero_layer");
    if (layer) host.insertBefore(gfx.canvas, layer);
    else host.append(gfx.canvas);
    target = { host, media, isVideo: media.tagName === "VIDEO", uploaded: false };
    last = null;
    return true;
}

function detach() {
    cancelAnimationFrame(raf);
    raf = 0;
    gfx?.canvas.remove();
    target = null;
}

function paint(x, y, speed) {
    const { mctx } = gfx;
    const radius = (60 + Math.min(speed, 60) * 1.4) * MASK_SCALE;
    const from = last || { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (radius * 0.5)));
    mctx.globalCompositeOperation = "lighter";
    for (let i = 1; i <= steps; i++) {
        const px = from.x + (x - from.x) * (i / steps), py = from.y + (y - from.y) * (i / steps);
        const g = mctx.createRadialGradient(px, py, 0, px, py, radius);
        g.addColorStop(0, "rgba(255,255,255,0.6)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        mctx.fillStyle = g;
        mctx.beginPath();
        mctx.arc(px, py, radius, 0, Math.PI * 2);
        mctx.fill();
    }
    last = { x, y };
}

function draw() {
    raf = 0;
    if (!target) return;
    const { gl, mctx, maskCanvas } = gfx;
    const { host, media } = target;
    mctx.globalCompositeOperation = "destination-out";
    mctx.fillStyle = `rgba(0,0,0,${FADE})`;
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    const w = media.videoWidth || media.naturalWidth, h = media.videoHeight || media.naturalHeight;
    if (w && h) {
        try {
            // A photo goes up once, a video every frame
            if (target.isVideo || !target.uploaded) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, gfx.mediaTex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
                target.uploaded = true;
            }
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, gfx.maskTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
            // Where the picture sits in the host right now (the scroll parallax moves photos inside their box)
            const hr = host.getBoundingClientRect(), mr = media.getBoundingClientRect();
            gl.uniform4f(gfx.uBox, (mr.left - hr.left) / hr.width, (mr.top - hr.top) / hr.height, mr.width / hr.width, mr.height / hr.height);
            const ba = mr.width / mr.height, va = w / h;
            gl.uniform2f(gfx.uCover, va > ba ? ba / va : 1, va > ba ? 1 : va / ba);
            gl.uniform1f(gfx.uTime, (performance.now() - start) / 1000);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } catch (e) {
            return detach(); // a picture from another origin without CORS cannot be drawn
        }
    }
    if (--idle > 0) raf = requestAnimationFrame(draw);
}

function hostAt(x, y) {
    const m = mode();
    if (m === "off") return null;
    for (const node of document.elementsFromPoint(x, y)) {
        const host = node.closest?.(HOSTS);
        if (!host) continue;
        if (m === "hero" && !host.matches("section.header")) return null;
        return host.querySelector("video, img") ? host : null;
    }
    return null;
}

function onMove(e) {
    const host = hostAt(e.clientX, e.clientY);
    if (!host) { last = null; return; }
    if (target?.host !== host) {
        detach();
        if (!attach(host)) return;
        gfx.mctx.clearRect(0, 0, gfx.maskCanvas.width, gfx.maskCanvas.height);
    }
    const r = host.getBoundingClientRect();
    const x = (e.clientX - r.left) * MASK_SCALE, y = (e.clientY - r.top) * MASK_SCALE;
    const speed = last ? Math.hypot(x - last.x, y - last.y) / MASK_SCALE : 0;
    paint(x, y, speed);
    idle = IDLE_FRAMES;
    if (!raf) raf = requestAnimationFrame(draw);
}

// Called on start, after every page change and when a variant changes the option
export function initHeroReveal() {
    if (!initHeroReveal.listening) {
        initHeroReveal.listening = true;
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("resize", detach);
        document.addEventListener("kalq:look", () => initHeroReveal());
    }
    // A new page or a new picture: start fresh where the pointer goes next
    if (!target || !document.contains(target.host) || mode() === "off" || !target.host.contains(target.media)) detach();
    // Let photos from other origins load in CORS mode now, so the first move over them already works
    if (mode() === "all") document.querySelectorAll(HOSTS).forEach((host) => { const m = host.querySelector("img, video"); if (m) corsReady(m); });
}
