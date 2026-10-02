// Liquid reveal over the home hero (style variant option, html.has-hero-reveal). The pointer paints a soft trail into
// a small mask; a WebGL layer turns it into a liquid shape (noise warped edges, a light rim) and shows the video there
// in full colour and without the darkening layer; around it the hero video is grey. The trail flows out and dissolves.
const MASK_SCALE = 0.5; // the trail is drawn at half size, the shader smooths it
const FADE = 0.045; // how fast the trail dissolves per frame
const IDLE_FRAMES = 140; // keep drawing this long after the last move, until the trail is gone

const VERT = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D video, mask;
uniform vec2 cover; // object-fit: cover, as a scale around the centre
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
    vec2 v = (q - 0.5) * cover + 0.5 + n * 0.018 * shape;
    vec3 c = texture2D(video, v).rgb * 1.12 + 0.03; // full colour, a little brighter than the grey hero around it
    c = mix(c, vec3(1.0), rim * 0.22);
    float a = max(shape, rim * 0.6);
    gl_FragColor = vec4(c * a, a);
}`;

let state = null;

function setup(hero, media) {
    const canvas = document.createElement("canvas");
    canvas.className = "hero_reveal";
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
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
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
    const videoTex = texture(0), maskTex = texture(1);
    gl.uniform1i(gl.getUniformLocation(prog, "video"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "mask"), 1);
    const uCover = gl.getUniformLocation(prog, "cover"), uTime = gl.getUniformLocation(prog, "time");

    const maskCanvas = document.createElement("canvas");
    const mctx = maskCanvas.getContext("2d");
    // Above the darkening layer, under the title
    const layer = hero.querySelector(".hero_layer");
    hero.insertBefore(canvas, layer);
    return { hero, media, canvas, gl, videoTex, maskTex, uCover, uTime, maskCanvas, mctx, last: null, idle: IDLE_FRAMES, frame: 0, raf: 0, start: performance.now() };
}

function resize(s) {
    const r = s.hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    s.canvas.width = Math.round(r.width * dpr);
    s.canvas.height = Math.round(r.height * dpr);
    s.maskCanvas.width = Math.max(2, Math.round(r.width * MASK_SCALE));
    s.maskCanvas.height = Math.max(2, Math.round(r.height * MASK_SCALE));
    s.gl.viewport(0, 0, s.canvas.width, s.canvas.height);
}

function paint(s, x, y, speed) {
    const { mctx } = s;
    const radius = (60 + Math.min(speed, 60) * 1.4) * MASK_SCALE;
    const from = s.last || { x, y };
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
    s.last = { x, y };
}

function draw(s) {
    s.raf = 0;
    const { gl, media, mctx, maskCanvas } = s;
    // dissolve
    mctx.globalCompositeOperation = "destination-out";
    mctx.fillStyle = `rgba(0,0,0,${FADE})`;
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    const w = media.videoWidth || media.naturalWidth, h = media.videoHeight || media.naturalHeight;
    if (w && h) {
        try {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, s.videoTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, s.maskTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
            const ca = s.canvas.width / s.canvas.height, va = w / h;
            gl.uniform2f(s.uCover, va > ca ? ca / va : 1, va > ca ? 1 : va / ca);
            gl.uniform1f(s.uTime, (performance.now() - s.start) / 1000);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } catch (e) {
            return stop(); // a video from another origin without CORS cannot be drawn
        }
    }
    if (--s.idle > 0) s.raf = requestAnimationFrame(() => draw(s));
}

function wake(s) {
    s.idle = IDLE_FRAMES;
    if (!s.raf) s.raf = requestAnimationFrame(() => draw(s));
}

function onMove(e) {
    const s = state;
    if (!s) return;
    const r = s.hero.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) { s.last = null; return; }
    const x = (e.clientX - r.left) * MASK_SCALE, y = (e.clientY - r.top) * MASK_SCALE;
    const speed = s.last ? Math.hypot(x - s.last.x, y - s.last.y) / MASK_SCALE : 0;
    paint(s, x, y, speed);
    wake(s);
}

function stop() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    state.canvas.remove();
    state = null;
}

export function initHeroReveal() {
    if (!initHeroReveal.listening) {
        initHeroReveal.listening = true;
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("resize", () => state && resize(state));
        // The variant switched it on or off, or swapped the hero media
        document.addEventListener("kalq:look", () => initHeroReveal());
    }
    const enabled = document.documentElement.classList.contains("has-hero-reveal")
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = document.querySelector('[data-barba="container"] > section.header');
    const media = hero?.querySelector("video, img.hero_video");
    if (!enabled || !hero || !media) return stop();
    if (state && state.hero === hero && state.media === media) return;
    stop();
    state = setup(hero, media);
    if (!state) return;
    resize(state);
}
