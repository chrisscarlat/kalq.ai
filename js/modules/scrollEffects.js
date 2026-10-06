// The scroll modules' effects (js/modules/final.js), browser only, on the page's GSAP 3.12.5 ScrollTrigger (with the
// smooth scroller: the pins move by transform). Each module is a plain stacked list in its HTML; an effect arms it
// (.is-armed, css/components/_final.scss) only with motion allowed, outside edit mode and with ScrollTrigger on the
// page, and disarms it when that changes (reduced motion switched on, edit mode, the section gone):
//   stack       the testimonials lie on a pile; the section pins and each scroll step flicks the top card away
//   tether      each card pins at the top and the next slides up over it, 20px lower, an edge of each in view
//   horizontal  the section pins while its row of cards slides sideways until the last is in view
const still = window.matchMedia("(prefers-reduced-motion: reduce)");
const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const live = new Set();
const OVERLAP = 20; // px: how much of each pinned card the next one leaves in view

const scroller = () => { const c = document.querySelector(".scrollbar-container"); return c && window.Scrollbar ? window.Scrollbar.get(c) : null; };
const pinType = () => (scroller() ? "transform" : "fixed");
const smooth = (t) => t * t * (3 - 2 * t);
const scrollToY = (y) => { const sb = scroller(); if (sb) sb.scrollTo(0, y, 600); else window.scrollTo({ top: y, behavior: "smooth" }); };

//=================================== Stack (testimonials) ===================================//
function stack(sec) {
    const inner = sec.querySelector(".kalq-f-ts__inner");
    const cards = [...sec.querySelectorAll(".kalq-f-ts__card")];
    const n = cards.length;
    if (n < 2 || !inner) return null;
    sec.classList.add("is-armed");
    // f: how many cards have flown (0 to n - 1, continuous). The card flying lifts away up and to the right, turning;
    // those under it rise a step as it goes.
    const place = (f) => cards.forEach((c, j) => {
        const t = smooth(Math.min(1, Math.max(0, f - j)));
        const d = Math.min(3, Math.max(0, j - f));
        c.style.transform = `translate(${t * 30}%, ${-t * 115}%) rotate(${-t * 10}deg) translateY(${d * 0.9}rem) scale(${1 - d * 0.05})`;
        c.style.opacity = t >= 1 || j - f > 3 ? "0" : "1";
        c.style.zIndex = String(n - j);
    });
    place(0);
    const st = window.ScrollTrigger.create({
        trigger: sec, pin: inner, pinType: pinType(), start: "top top",
        end: () => `+=${Math.round((n - 1) * 0.75 * window.innerHeight)}`,
        invalidateOnRefresh: true,
        onUpdate: (self) => place(self.progress * (n - 1)),
    });
    return () => { st.kill(true); cards.forEach((c) => ["transform", "opacity", "z-index"].forEach((p) => c.style.removeProperty(p))); };
}

//=================================== Tether (stacking pinned cards) ===================================//
function tether(sec) {
    const cards = [...sec.querySelectorAll(".kalq-f-tether__card")];
    const n = cards.length;
    if (n < 2) return null;
    sec.classList.add("is-armed");
    const last = cards[n - 1];
    const pins = cards.slice(0, -1).map((c, i) => window.ScrollTrigger.create({
        trigger: c, pin: true, pinSpacing: false, pinType: pinType(),
        start: `top top+=${i * OVERLAP}`, endTrigger: last, end: `top top+=${(n - 1) * OVERLAP}`,
        invalidateOnRefresh: true,
    }));
    return () => pins.forEach((p) => p.kill(true));
}

//=================================== Horizontal ===================================//
function horizontal(sec) {
    const pin = sec.querySelector(".kalq-f-hs__pin");
    const track = sec.querySelector(".kalq-f-hs__track");
    if (!pin || !track || track.children.length < 2) return null;
    sec.classList.add("is-armed");
    const dist = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const tween = window.gsap.to(track, { x: () => -dist(), ease: "none" });
    const st = window.ScrollTrigger.create({
        trigger: sec, pin, pinType: pinType(), start: "top top", end: () => `+=${Math.max(1, dist())}`,
        animation: tween, scrub: 0.4, invalidateOnRefresh: true,
    });
    // a card reached with the keyboard is brought into view: the page scrolls to where the row shows it
    const onFocus = (e) => {
        const card = e.target.closest(".kalq-f-hs__card");
        if (!card || !e.target.matches(":focus-visible")) return;
        const p = Math.min(1, Math.max(0, (card.offsetLeft - track.firstElementChild.offsetLeft) / Math.max(1, dist())));
        scrollToY(st.start + p * (st.end - st.start));
    };
    track.addEventListener("focusin", onFocus);
    return () => { track.removeEventListener("focusin", onFocus); st.kill(true); tween.kill(); window.gsap.set(track, { clearProps: "transform" }); };
}

const EFFECTS = { stack, tether, horizontal };

//=================================== Arming ===================================//
function sweep() {
    for (const sec of live) if (!sec.isConnected) sec.kalqEffect?.kill();
}

export function setupScrollEffect(sec) {
    sweep();
    const make = EFFECTS[sec.dataset.scrollEffect];
    if (!make) return;
    if (sec.kalqEffect) { if (!sec.classList.contains("is-armed")) sec.kalqEffect.decide(); return; } // not armed yet (the page was still starting): try again
    let undo = null;
    const disarm = () => { undo?.(); undo = null; sec.classList.remove("is-armed"); };
    const decide = () => {
        disarm();
        if (sec.isConnected && !still.matches && !document.body.classList.contains("kalq-edit") && window.gsap && window.ScrollTrigger) undo = make(sec);
        window.ScrollTrigger?.refresh();
    };
    sec.kalqEffect = {
        decide,
        kill: () => { still.removeEventListener("change", decide); spanned.removeEventListener("change", decide); disarm(); live.delete(sec); delete sec.kalqEffect; },
    };
    still.addEventListener("change", decide);
    spanned.addEventListener("change", decide); // folded or unfolded: measured again
    live.add(sec);
    decide();
}

// Edit mode on: every effect stops (the editor works on plain lists); off: they start again
if (typeof MutationObserver !== "undefined") {
    let editing = document.body.classList.contains("kalq-edit");
    new MutationObserver(() => {
        const now = document.body.classList.contains("kalq-edit");
        if (now === editing) return;
        editing = now;
        if (now) [...live].forEach((sec) => sec.kalqEffect?.kill());
        else document.querySelectorAll(".kalq-f[data-scroll-effect]").forEach(setupScrollEffect);
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
