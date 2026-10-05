// Header symbol animation. The letters K, A, L, Q are formed only from the mark's own rays:
// every ray stays on its own axis and just grows or shrinks along it. Between letters the mark opens again.
// Then the mark turns in 3D (perspective projection, depth shading) and the loop restarts.

const CENTER = 87;
const STROKE = 11;
const DEPTH = 420; // perspective distance in viewBox units

// Mark rays as drawn in the SVG: inner point, outer point. The centre stays open (24 units); the down right ray,
// the Q tail, starts closer (10) and so stands out.
const RAYS = {
    e: [111, 86.99, 173.98, 86.99],
    w: [63, 87.01, 0, 87.01],
    s: [87.01, 111, 87.01, 174],
    n: [87.01, 63, 87.01, 0],
    se: [94.07, 94.07, 135.29, 135.29],
    ne: [104.3, 70.36, 132.83, 41.82],
    sw: [70.2, 104.14, 40.85, 133.49],
    nw: [70.19, 69.87, 40.83, 40.51],
};

// Each ray as an axis: foot point nearest the centre, unit direction, and the mark's [tIn, tOut] along it
const AXES = {};
Object.entries(RAYS).forEach(([ray, [x1, y1, x2, y2]]) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const k = (CENTER - x1) * ux + (CENTER - y1) * uy;
    const fx = x1 + k * ux, fy = y1 + k * uy;
    AXES[ray] = { fx, fy, ux, uy, mark: [-k, len - k] };
});

const mark = ray => AXES[ray].mark;
const HALF = STROKE / 2;

// States: [tIn, tOut] per ray. [0, 0] means shrunk into the centre.
const MARK = Object.fromEntries(Object.keys(RAYS).map(r => [r, mark(r)]));
const LETTERS = [
    // K: the vertical rays join into the stem, up right and down right open as the arms
    { n: [0, mark("n")[1]], s: [0, mark("s")[1]], ne: [0, mark("ne")[1]], se: [0, mark("se")[1]], e: [0, 0], w: [0, 0], nw: [0, 0], sw: [0, 0] },
    // A: the two lower diagonals meet in the centre
    { sw: [0, 74], se: [0, 74], n: [0, 0], s: [0, 0], e: [0, 0], w: [0, 0], ne: [0, 0], nw: [0, 0] },
    // L: top ray down to the centre, then the centre out to the right, joined in a square corner
    { n: [-HALF, mark("n")[1]], e: [-HALF, mark("e")[1]], s: [0, 0], w: [0, 0], ne: [0, 0], se: [0, 0], sw: [0, 0], nw: [0, 0] },
    // Q: every ray shrinks outwards into a ring, the down right diagonal stays whole as the tail
    { n: [62, 87], s: [62, 87], e: [62, 87], w: [62, 87], ne: [62, 87], nw: [62, 87], sw: [62, 87], se: [0, 87] },
];

// Diagonals tilt out of the plane during the 3D turn (sign per ray keeps opposite rays on one straight axis)
const LIFT = { ne: 1, sw: -1, nw: -1, se: 1, n: 0, s: 0, e: 0, w: 0 };

// Runs on the header mark by default. The gate page passes its own larger mark.
export function logoAnimation(svg = document.querySelector(".site-logo__mark"), { delay = 2.5 } = {}) {
    if (!svg || svg.dataset.animated) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    svg.dataset.animated = "true";

    const lines = {};
    svg.querySelectorAll("line[data-ray]").forEach(line => { lines[line.dataset.ray] = line; });

    // Animated values: t per ray, plus the 3D view
    const t = Object.fromEntries(Object.keys(RAYS).map(r => [r, { a: MARK[r][0], b: MARK[r][1] }]));
    const view = { rx: 0, rz: 0, ry: 0, lift: 0 };

    const project = (ray, tt) => {
        const { fx, fy, ux, uy } = AXES[ray];
        let x = fx + tt * ux - CENTER, y = fy + tt * uy - CENTER, z = LIFT[ray] * view.lift * tt;
        const rad = Math.PI / 180;
        // spin in the mark's own plane
        let c = Math.cos(view.rz * rad), s = Math.sin(view.rz * rad);
        [x, y] = [x * c - y * s, x * s + y * c];
        // tilt towards the viewer (isometric look)
        c = Math.cos(view.rx * rad); s = Math.sin(view.rx * rad);
        [y, z] = [y * c - z * s, y * s + z * c];
        // turn around the vertical axis
        c = Math.cos(view.ry * rad); s = Math.sin(view.ry * rad);
        [x, z] = [x * c + z * s, -x * s + z * c];
        const p = DEPTH / (DEPTH - z);
        return [CENTER + x * p, CENTER + y * p, p];
    };

    // The drawing stays inside the mark's own square (it never runs over the wordmark beside it): when the 3D turn
    // brings rays nearer and larger than the square, the whole frame is scaled down about the centre to fit
    const render = () => {
        const ends = Object.keys(lines).map(ray => [ray, project(ray, t[ray].a), project(ray, t[ray].b)]);
        let reach = 0;
        ends.forEach(([, [x1, y1, p1], [x2, y2, p2]]) => {
            // a butt-capped stroke: its corners stand out by half its width, across the line
            const len = Math.hypot(x2 - x1, y2 - y1) || 1;
            const half = (STROKE * ((p1 + p2) / 2) ** 2) / 2;
            const hx = half * Math.abs(y2 - y1) / len, hy = half * Math.abs(x2 - x1) / len;
            reach = Math.max(reach, Math.abs(x1 - CENTER) + hx, Math.abs(x2 - CENTER) + hx, Math.abs(y1 - CENTER) + hy, Math.abs(y2 - CENTER) + hy);
        });
        const fit = reach > CENTER ? CENTER / reach : 1;
        const at = v => CENTER + (v - CENTER) * fit;
        ends.forEach(([ray, [x1, y1, p1], [x2, y2, p2]]) => {
            const p = (p1 + p2) / 2;
            const line = lines[ray];
            line.setAttribute("x1", at(x1).toFixed(2));
            line.setAttribute("y1", at(y1).toFixed(2));
            line.setAttribute("x2", at(x2).toFixed(2));
            line.setAttribute("y2", at(y2).toFixed(2));
            // nearer lines thicker and brighter, farther ones thinner and dimmer
            line.setAttribute("stroke-width", (STROKE * p * p * fit).toFixed(2));
            line.setAttribute("opacity", Math.min(1, Math.max(0.35, 1 - (1 - p) * 3)).toFixed(2));
        });
    };

    const toShape = (tl, shape, at) => {
        Object.entries(shape).forEach(([ray, [a, b]], i) => {
            tl.to(t[ray], { a, b, duration: 0.8, ease: "power3.inOut" }, at + i * 0.03);
        });
    };

    const tl = gsap.timeline({ repeat: -1, delay, repeatDelay: 2.5, onUpdate: render });

    LETTERS.forEach(letter => {
        toShape(tl, letter, tl.duration());   // unused rays shrink, the rest open into the letter
        tl.to({}, { duration: 1.1 });         // hold
        toShape(tl, MARK, tl.duration());     // open all
        tl.to({}, { duration: 0.35 });
    });

    // 3D: tilt into an isometric view while the diagonals rise out of the plane, turn, then settle flat
    tl.to(view, { rx: 60, rz: 45, lift: 0.9, duration: 1, ease: "power2.inOut" })
        .to(view, { rz: 405, ry: 360, duration: 2.8, ease: "power1.inOut" })
        .to(view, { rx: 0, rz: 360, lift: 0, duration: 1, ease: "power2.inOut" })
        .set(view, { rz: 0, ry: 0 });

    render();
    return tl; // the viewer stops its copies when it closes
}
