// Behaviour of page builder modules and of the built-in sections on two screens. Everything works as plain HTML
// first: FAQ answers are in the page and visible. With this script:
//   one screen: the FAQ folds into an accordion (the first answer open);
//   two screens (a device spanning both, css/utilities/_dual.scss): the FAQ questions become tabs on the left screen
//   and the selected answer fills the right one; the platform list shows the picture of the row in focus on the right
//   screen; call-to-action bands show their picture on the right screen.
// A foldable can change posture while the page is open: everything switches back and forth.
import { fillScreen2 } from "./modules/registry.js";
import { CHAT_WORDS } from "./modules/library.js";
import { storedEntry } from "./content.js";

const spanned = window.matchMedia("(horizontal-viewport-segments: 2)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

//=================================== FAQ ===================================//
function faqParts(faq) {
    return [...faq.querySelectorAll(".kalq-m-faq__toggle")].map((toggle) => {
        const answer = faq.querySelector(`#${CSS.escape(toggle.getAttribute("aria-controls"))}`);
        if (!toggle.id) toggle.id = `${toggle.getAttribute("aria-controls")}-q`;
        return { toggle, answer };
    }).filter((p) => p.answer);
}

// Open or close one answer; closed it is hidden "until found" (find in page opens it, see beforematch)
function setOpen(toggle, answer, open) {
    toggle.setAttribute("aria-expanded", open);
    if (open) answer.removeAttribute("hidden");
    else answer.setAttribute("hidden", "until-found");
}

function accordion(faq) {
    const parts = faqParts(faq);
    faq.classList.remove("is-tabs");
    faq.querySelector(".kalq-m-faq__list")?.removeAttribute("role");
    faq.querySelector(".kalq-m-faq__list")?.removeAttribute("aria-orientation");
    parts.forEach(({ toggle, answer }, i) => {
        ["role", "aria-selected", "tabindex"].forEach((a) => toggle.removeAttribute(a));
        answer.removeAttribute("tabindex");
        toggle.parentElement.removeAttribute("role"); // the <h3>
        // each answer a region named by its question; a closed one stays in the page, found by the browser's search
        answer.setAttribute("role", "region");
        answer.setAttribute("aria-labelledby", toggle.id);
        setOpen(toggle, answer, i === 0);
    });
}

// Questions as vertical tabs (arrow keys, Home, End), the selected answer as its panel
function tabs(faq) {
    const parts = faqParts(faq);
    faq.classList.add("is-tabs");
    const list = faq.querySelector(".kalq-m-faq__list");
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-orientation", "vertical");
    const select = (index, focus) => parts.forEach(({ toggle, answer }, i) => {
        const on = i === index;
        toggle.setAttribute("aria-selected", on);
        toggle.tabIndex = on ? 0 : -1;
        answer.hidden = !on;
        if (on && focus) toggle.focus();
    });
    parts.forEach(({ toggle, answer }) => {
        toggle.removeAttribute("aria-expanded");
        toggle.setAttribute("role", "tab");
        toggle.parentElement.setAttribute("role", "presentation"); // the <h3> around a tab
        answer.setAttribute("role", "tabpanel");
        answer.setAttribute("aria-labelledby", toggle.id);
        answer.tabIndex = 0;
    });
    const current = parts.findIndex(({ toggle }) => toggle.getAttribute("aria-selected") === "true");
    select(current < 0 ? 0 : current, false);
}

function setupFaq(faq) {
    if (!faq.dataset.ready) {
        faq.dataset.ready = "true";
        faq.addEventListener("click", (e) => {
            const toggle = e.target.closest(".kalq-m-faq__toggle");
            if (!toggle) return;
            const parts = faqParts(faq);
            const i = parts.findIndex((p) => p.toggle === toggle);
            if (faq.classList.contains("is-tabs")) {
                parts.forEach(({ toggle: t, answer }, j) => { t.setAttribute("aria-selected", j === i); t.tabIndex = j === i ? 0 : -1; answer.hidden = j !== i; });
            } else {
                setOpen(toggle, parts[i].answer, toggle.getAttribute("aria-expanded") !== "true");
            }
            window.dispatchEvent(new Event("resize")); // the smooth scroller measures the page again
        });
        // the browser's find in page reached a closed answer: open it (as a tab on two screens)
        faq.addEventListener("beforematch", (e) => {
            const part = faqParts(faq).find((p) => p.answer === e.target);
            if (!part) return;
            if (faq.classList.contains("is-tabs")) part.toggle.click();
            else setOpen(part.toggle, part.answer, true);
        });
        faq.addEventListener("keydown", (e) => {
            if (!faq.classList.contains("is-tabs") || !e.target.closest(".kalq-m-faq__toggle")) return;
            const parts = faqParts(faq);
            const i = parts.findIndex((p) => p.toggle === e.target.closest(".kalq-m-faq__toggle"));
            const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: parts.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const j = (next + parts.length) % parts.length;
            parts[j].toggle.click();
            parts[j].toggle.focus();
        });
    }
    if (spanned.matches) tabs(faq); else accordion(faq);
}

//=================================== Two-screen panels ===================================//
// The platform list: the picture of the row in focus fills the right screen (the first row's to begin with)
function setupListPanel(section) {
    const rows = [...section.querySelectorAll(".elem[data-image]")];
    let panel = section.querySelector(":scope > .kalq-span-panel");
    if (!spanned.matches || !rows.length) { panel?.remove(); return; }
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "kalq-span-panel";
        panel.setAttribute("aria-hidden", "true");
        panel.append(Object.assign(document.createElement("img"), { alt: "" }));
        section.append(panel);
    }
    const img = panel.querySelector("img");
    const show = (row) => { const src = row.getAttribute("data-image"); if (src && img.getAttribute("src") !== src) img.setAttribute("src", src); };
    show(rows[0]);
    rows.forEach((row) => {
        if (row.dataset.spanReady) return;
        row.dataset.spanReady = "true";
        ["pointerenter", "focusin"].forEach((ev) => row.addEventListener(ev, () => show(row)));
    });
}

// Call-to-action bands: their right-screen picture plays only while it is shown
function setupScreen2(container) {
    fillScreen2(container, document);
    container.querySelectorAll(".kalq-m-cta__screen2 video").forEach((v) => {
        if (spanned.matches && !reducedMotion.matches) { v.muted = true; v.play?.()?.catch(() => { }); }
        else v.pause?.();
    });
}

//=================================== Logo belt ===================================//
// The row drifts by CSS; here: the pause button, and still while off screen (no work for nothing)
const en = () => document.documentElement.lang === "en";
function setupBelt(belt) {
    const pause = belt.querySelector(".kalq-m-belt__pause");
    if (pause) {
        pause.setAttribute("aria-label", en() ? "Pause the logos" : "Laufband anhalten");
        if (!pause.dataset.ready) {
            pause.dataset.ready = "true";
            pause.addEventListener("click", () => {
                const on = pause.getAttribute("aria-pressed") !== "true";
                pause.setAttribute("aria-pressed", on);
                belt.classList.toggle("is-paused", on);
            });
        }
    }
    if (!belt.dataset.watched && "IntersectionObserver" in window) {
        belt.dataset.watched = "true";
        new IntersectionObserver(([e]) => belt.classList.toggle("is-offscreen", !e.isIntersecting)).observe(belt);
    }
}

//=================================== Hero ===================================//
// The title rises in, word by word (the words stay the h1's own text, only wrapped); the rotating word turns every
// 2.5 s; a video plays muted. One pause control stops all of it. Under reduced motion all is still and complete.
function words(el) {
    if (el.dataset.split) return;
    el.dataset.split = "true";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest(".kalq-sr") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const texts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
    let i = 0;
    texts.forEach((n) => {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const w = document.createElement("span");
            w.className = "kalq-word";
            w.style.setProperty("--i", i++);
            w.textContent = part;
            frag.append(w);
        });
        n.replaceWith(frag);
    });
}

// The rotating word: the word in the title keeps its text (the h1 stays the sentence); what turns is drawn by CSS
// over it (::after, from data-word), so no other word ever becomes part of the heading's text
function rotate(title, hero) {
    let list;
    try { list = JSON.parse(title.dataset.rotate || "[]"); } catch { list = []; }
    if (list.length < 2 || title.querySelector(".kalq-m-hero__rot") || reducedMotion.matches) return;
    const word = [...title.querySelectorAll(".kalq-word")].find((w) => w.textContent.replace(/[^\p{L}\p{N}-]/gu, "") === list[0]);
    if (!word) return;
    // each word's own width, so the line closes up around the shorter ones (the width eases from one to the next)
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    title.append(probe);
    const widths = list.map((w) => { probe.textContent = w; return Math.ceil(probe.getBoundingClientRect().width); });
    probe.remove();
    word.classList.add("kalq-m-hero__rot");
    word.style.width = `${widths[0]}px`;
    word.dataset.word = list[0];
    let n = 0;
    hero.rotateTimer = setInterval(() => {
        if (hero.classList.contains("is-paused") || !word.isConnected) return;
        word.classList.add("is-out");
        setTimeout(() => {
            n = (n + 1) % list.length;
            word.dataset.word = list[n];
            word.style.width = `${widths[n]}px`;
            word.classList.remove("is-out");
            word.classList.add("is-in");
            requestAnimationFrame(() => requestAnimationFrame(() => word.classList.remove("is-in")));
        }, 320);
    }, 2500);
}

function setupHero(hero) {
    const title = hero.querySelector(".kalq-m-hero__title");
    if (!document.body.classList.contains("kalq-edit") && title && !hero.dataset.ready) {
        hero.dataset.ready = "true";
        if (!reducedMotion.matches) { words(title); hero.classList.add("is-entering"); }
        else words(title);
        rotate(title, hero);
    }
    const video = hero.querySelector(".kalq-m-hero__media video");
    if (video) { video.muted = true; if (reducedMotion.matches) video.pause(); }
    const pause = hero.querySelector(".kalq-m-hero__pause");
    if (pause) {
        pause.setAttribute("aria-label", en() ? "Pause the motion" : "Bewegung anhalten");
        const still = reducedMotion.matches;
        if (still) { pause.setAttribute("aria-pressed", "true"); hero.classList.add("is-paused"); }
        if (!pause.dataset.ready) {
            pause.dataset.ready = "true";
            pause.addEventListener("click", () => {
                const on = pause.getAttribute("aria-pressed") !== "true";
                pause.setAttribute("aria-pressed", on);
                hero.classList.toggle("is-paused", on);
                if (video) on ? video.pause() : video.play?.()?.catch(() => { });
            });
        }
    }
    const next = hero.querySelector(".kalq-m-hero__next");
    if (next) next.setAttribute("aria-label", en() ? "To the next section" : "Zum nächsten Abschnitt");
}

//=================================== Reveals (library, batch 2) ===================================//
// Sections with data-reveal (visitors only): words rise in, items fade up one after another, or a soft blur-up, once
// the section comes into view. The text is the page's own text, only wrapped; under reduced motion nothing is armed.
let revealObserver = null;
function setupReveal(section) {
    if (section.dataset.revealReady || reducedMotion.matches) return;
    section.dataset.revealReady = "true";
    section.querySelectorAll(".kalq-reveal-words").forEach(words);
    section.classList.add("is-armed");
    revealObserver ||= new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        revealObserver.unobserve(e.target);
    }), { threshold: 0.15 });
    revealObserver.observe(section);
}

//=================================== Testimonials ===================================//
// The slider: one quote shown at a time (the others visually hidden, still read in order), a counter, previous and
// next buttons, a swipe on touch. It never moves on its own.
const quoteWords = () => (en() ? { prev: "Previous quote", next: "Next quote" } : { prev: "Vorheriges Zitat", next: "Nächstes Zitat" });
function setupQuotes(section) {
    const slides = [...section.querySelectorAll(".kalq-m-quotes__slide")];
    if (slides.length < 2 || document.body.classList.contains("kalq-edit")) return;
    let bar = section.querySelector(".kalq-m-quotes__controls");
    if (!bar) {
        section.classList.add("is-slider");
        bar = document.createElement("div");
        bar.className = "kalq-m-quotes__controls";
        const arrow = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        bar.innerHTML = `<button type="button" class="kalq-m-quotes__prev">${arrow("M15 5l-7 7 7 7")}</button><p class="kalq-m-quotes__count" aria-live="polite"></p><button type="button" class="kalq-m-quotes__next">${arrow("M9 5l7 7-7 7")}</button>`;
        section.querySelector(".kalq-m-quotes__list").after(bar);
        let at = 0;
        const show = (n) => {
            at = (n + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle("is-off", i !== at));
            bar.querySelector(".kalq-m-quotes__count").textContent = `${at + 1} / ${slides.length}`;
        };
        bar.querySelector(".kalq-m-quotes__prev").addEventListener("click", () => show(at - 1));
        bar.querySelector(".kalq-m-quotes__next").addEventListener("click", () => show(at + 1));
        // touch: a swipe sideways turns to the next or previous quote
        let x0 = null;
        section.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
        section.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1)); });
        show(0);
    }
    const w = quoteWords();
    bar.querySelector(".kalq-m-quotes__prev").setAttribute("aria-label", w.prev);
    bar.querySelector(".kalq-m-quotes__next").setAttribute("aria-label", w.next);
}

// A card's rating reads in the page's language ("Bewertung: 4,5 von 5" / "Rating: 4.5 of 5")
function relabelRatings(root) {
    root.querySelectorAll(".kalq-m-cards__rating[data-rating] .kalq-m-cards__rating-text").forEach((t) => {
        const n = t.parentElement.dataset.rating;
        t.textContent = en() ? `Rating: ${n} of 5` : `Bewertung: ${n.replace(".", ",")} von 5`;
    });
}

//=================================== Cards ===================================//
// Card carousels (2.14, 2.15): the row scrolls sideways; here the drag (mouse, pen, touch), the sideways wheel, the
// previous/next buttons, the position ("1–4 / 12"), the optional slow drift (with its pause control), the category
// filters and the "Drag" pill that follows the cursor on desktops (decoration).
const fine = window.matchMedia("(pointer: fine)");
const carWords = () => (en()
    ? { prev: "Previous cards", next: "Next cards", pause: "Pause the drift", filters: "Filter by category", all: "All", drag: "Drag" }
    : { prev: "Vorherige Karten", next: "Nächste Karten", pause: "Gleiten anhalten", filters: "Nach Kategorie filtern", all: "Alle", drag: "Ziehen" });
const arrowSvg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function setupCarousel(sec) {
    const track = sec.querySelector(".kalq-m-car__track");
    if (!track) return;
    const w = carWords();
    if (sec.dataset.ready) { relabelCarousel(sec, w); return; }
    sec.dataset.ready = "true";
    const items = () => [...track.children].filter((li) => !li.hidden);
    const step = () => { const a = items()[0], b = items()[1]; return a ? (b ? b.offsetLeft - a.offsetLeft : a.offsetWidth) : track.clientWidth; };
    const bar = document.createElement("div");
    bar.className = "kalq-m-car__controls";
    bar.innerHTML = `<button type="button" class="kalq-m-car__prev">${arrowSvg("M15 5l-7 7 7 7")}</button><p class="kalq-m-car__count" aria-live="polite"></p>`
        + `<span class="kalq-m-car__progress" aria-hidden="true"><span></span></span><button type="button" class="kalq-m-car__next">${arrowSvg("M9 5l7 7-7 7")}</button>`;
    sec.querySelector(".kalq-m-car__viewport").after(bar);
    const update = () => {
        // the cards wholly in view (by where they are, so uneven gaps, as on two screens, count right)
        const list = items(), box = track.getBoundingClientRect();
        const inView = list.map((li, i) => { const r = li.getBoundingClientRect(); return r.left >= box.left - 2 && r.right <= box.right + 2 ? i + 1 : 0; }).filter(Boolean);
        const n = list.length, first = inView[0] || 1, last = inView.at(-1) || first;
        bar.querySelector(".kalq-m-car__count").textContent = first === last ? `${first} / ${n}` : `${first}–${last} / ${n}`;
        const max = track.scrollWidth - track.clientWidth;
        bar.querySelector(".kalq-m-car__prev").disabled = track.scrollLeft <= 2;
        bar.querySelector(".kalq-m-car__next").disabled = track.scrollLeft >= max - 2;
        bar.querySelector(".kalq-m-car__progress span").style.width = `${max > 0 ? Math.max(8, (track.clientWidth / track.scrollWidth) * 100) : 100}%`;
        bar.querySelector(".kalq-m-car__progress span").style.marginLeft = `${max > 0 ? (track.scrollLeft / track.scrollWidth) * 100 : 0}%`;
        bar.hidden = max <= 2 && !sec.querySelector(".kalq-m-car__filters");
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reducedMotion.matches ? "auto" : "smooth" });
    bar.querySelector(".kalq-m-car__prev").addEventListener("click", () => go(-1));
    bar.querySelector(".kalq-m-car__next").addEventListener("click", () => go(1));
    let raf = 0;
    track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); });
    window.addEventListener("resize", update);
    // drag with mouse, pen or finger (the page still scrolls up and down: touch-action pan-y)
    let drag = null;
    track.addEventListener("pointerdown", (e) => { if (e.button) return; drag = { x: e.clientX, left: track.scrollLeft, moved: false, id: e.pointerId }; sec.classList.add("is-held"); });
    track.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; try { track.setPointerCapture(drag.id); } catch { /* the pointer is already gone */ } sec.classList.add("is-dragging"); }
        if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    const end = () => { if (!drag) return; const moved = drag.moved; drag = null; sec.classList.remove("is-dragging", "is-held"); if (moved) { sec.dataset.justDragged = "true"; setTimeout(() => delete sec.dataset.justDragged, 0); } };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    track.addEventListener("click", (e) => { if (sec.dataset.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true); // a drag is not a click
    track.addEventListener("dragstart", (e) => e.preventDefault());
    // a sideways wheel or trackpad swipe scrolls the row (not the page)
    track.addEventListener("wheel", (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        track.scrollLeft += e.deltaX;
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
    if (sec.dataset.filter !== undefined) filters(sec, track, update);
    if (sec.dataset.carousel === "drag") dragPill(sec);
    if (Number(sec.dataset.drift) > 0) drift(sec, track, bar);
    relabelCarousel(sec, w);
    update();
}

function relabelCarousel(sec, w) {
    sec.querySelector(".kalq-m-car__prev")?.setAttribute("aria-label", w.prev);
    sec.querySelector(".kalq-m-car__next")?.setAttribute("aria-label", w.next);
    sec.querySelector(".kalq-m-car__pause")?.setAttribute("aria-label", w.pause);
    sec.querySelector(".kalq-m-car__filters")?.setAttribute("aria-label", w.filters);
    const all = sec.querySelector(".kalq-m-car__filter[data-all]");
    if (all) all.textContent = w.all;
    const pill = sec.querySelector(".kalq-m-car__cursor");
    if (pill) pill.textContent = w.drag;
}

// Filter buttons from the cards' categories (two or more): real buttons, the chosen one pressed
function filters(sec, track, update) {
    const cats = [...new Set([...track.children].map((li) => li.dataset.category).filter(Boolean))];
    if (cats.length < 2) return;
    const box = document.createElement("div");
    box.className = "kalq-m-car__filters";
    box.setAttribute("role", "group");
    const make = (label, cat) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kalq-m-car__filter";
        b.textContent = label;
        if (cat == null) b.dataset.all = "";
        b.setAttribute("aria-pressed", cat == null ? "true" : "false");
        b.addEventListener("click", () => {
            box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
            [...track.children].forEach((li) => { li.hidden = cat != null && li.dataset.category !== cat; });
            track.scrollLeft = 0;
            update();
        });
        return b;
    };
    box.append(make(carWords().all, null), ...cats.map((c) => make(c, c)));
    sec.querySelector(".kalq-m-car__viewport").before(box);
}

// The "Drag" pill: follows the cursor over the row on desktops; decoration only (aria-hidden, never over the text it
// would hide: it sits beside the pointer and lets every click through)
function dragPill(sec) {
    const view = sec.querySelector(".kalq-m-car__viewport");
    const pill = document.createElement("span");
    pill.className = "kalq-m-car__cursor";
    pill.setAttribute("aria-hidden", "true");
    sec.append(pill);
    view.addEventListener("pointermove", (e) => {
        if (!fine.matches || e.pointerType !== "mouse") return;
        pill.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
        pill.classList.add("is-on");
    });
    view.addEventListener("pointerleave", () => pill.classList.remove("is-on"));
}

// The slow drift: the row glides on its own (looping to the start), paused by its button, by hover or focus, when off
// screen, and never under reduced motion
function drift(sec, track, bar) {
    if (reducedMotion.matches) return;
    const speed = Number(sec.dataset.drift) * 0.25;
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "kalq-m-car__pause";
    pause.setAttribute("aria-pressed", "false");
    pause.innerHTML = PAUSE_SVG;
    pause.addEventListener("click", () => pause.setAttribute("aria-pressed", pause.getAttribute("aria-pressed") !== "true"));
    bar.append(pause);
    let held = false, seen = true;
    sec.addEventListener("pointerenter", () => { held = true; });
    sec.addEventListener("pointerleave", () => { held = false; });
    sec.addEventListener("focusin", () => { held = true; });
    sec.addEventListener("focusout", () => { held = false; });
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(sec);
    let pos = track.scrollLeft;
    const tick = () => {
        if (!sec.isConnected) return;
        if (!held && seen && pause.getAttribute("aria-pressed") !== "true" && !sec.classList.contains("is-held")) {
            pos = Math.abs(pos - track.scrollLeft) > 2 ? track.scrollLeft : pos; // the visitor moved it: go on from there
            pos += speed;
            if (pos >= track.scrollWidth - track.clientWidth - 1) pos = 0;
            track.scrollLeft = pos;
        } else pos = track.scrollLeft;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

// The full-width slider (2.18): one slide shown (the others visually hidden, still in order; focusing into one shows
// it), arrows, dots; on its own only when the editor set seconds, then with a pause control and a ring filling in the
// current dot; never under reduced motion
const slideWords = () => (en() ? { prev: "Previous slide", next: "Next slide", slide: "Slide", pause: "Pause the slides" } : { prev: "Vorherige Folie", next: "Nächste Folie", slide: "Folie", pause: "Folien anhalten" });
function setupSlides(sec) {
    const slides = [...sec.querySelectorAll(".kalq-m-slides__slide")];
    if (slides.length < 2) return;
    let bar = sec.querySelector(".kalq-m-slides__controls");
    if (!bar) {
        sec.classList.add("is-slider");
        bar = document.createElement("div");
        bar.className = "kalq-m-slides__controls";
        bar.innerHTML = `<button type="button" class="kalq-m-slides__prev">${arrowSvg("M15 5l-7 7 7 7")}</button><div class="kalq-m-slides__dots"></div><button type="button" class="kalq-m-slides__next">${arrowSvg("M9 5l7 7-7 7")}</button>`;
        const dots = bar.querySelector(".kalq-m-slides__dots");
        slides.forEach((_, i) => {
            const d = document.createElement("button");
            d.type = "button";
            d.className = "kalq-m-slides__dot";
            d.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" pathLength="1"/></svg>';
            d.addEventListener("click", () => show(i));
            dots.append(d);
        });
        sec.append(bar);
        let at = 0;
        const show = (n) => {
            at = (n + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle("is-off", i !== at));
            dots.querySelectorAll("button").forEach((d, i) => { if (i === at) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
            sec.elapsed = 0; // the ring of the current dot starts over (css: it fills over --auto)
        };
        sec.slidesShow = show;
        bar.querySelector(".kalq-m-slides__prev").addEventListener("click", () => show(at - 1));
        bar.querySelector(".kalq-m-slides__next").addEventListener("click", () => show(at + 1));
        slides.forEach((s, i) => s.addEventListener("focusin", () => { if (i !== at) show(i); }));
        let x0 = null;
        sec.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
        sec.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1)); });
        const secs = Number(sec.dataset.auto);
        if (secs > 0 && !reducedMotion.matches) {
            sec.classList.add("is-auto");
            sec.style.setProperty("--auto", `${secs}s`);
            const pause = document.createElement("button");
            pause.type = "button";
            pause.className = "kalq-m-slides__pause";
            pause.setAttribute("aria-pressed", "false");
            pause.innerHTML = PAUSE_SVG;
            pause.addEventListener("click", () => { const on = pause.getAttribute("aria-pressed") !== "true"; pause.setAttribute("aria-pressed", on); sec.classList.toggle("is-paused", on); });
            bar.append(pause);
            let held = false, seen = true;
            sec.addEventListener("pointerenter", () => { held = true; sec.classList.add("is-held"); });
            sec.addEventListener("pointerleave", () => { held = false; sec.classList.remove("is-held"); });
            sec.addEventListener("focusin", () => { held = true; sec.classList.add("is-held"); });
            sec.addEventListener("focusout", () => { held = false; sec.classList.remove("is-held"); });
            new IntersectionObserver(([e]) => { seen = e.isIntersecting; sec.classList.toggle("is-away", !seen); }).observe(sec);
            const timer = setInterval(() => {
                if (!sec.isConnected) return clearInterval(timer);
                if (held || !seen || sec.classList.contains("is-paused")) return; // the ring pauses with it
                sec.elapsed += 200;
                if (sec.elapsed >= secs * 1000) show(at + 1);
            }, 200);
        }
        show(0);
    }
    const w = slideWords();
    bar.querySelector(".kalq-m-slides__prev").setAttribute("aria-label", w.prev);
    bar.querySelector(".kalq-m-slides__next").setAttribute("aria-label", w.next);
    bar.querySelectorAll(".kalq-m-slides__dot").forEach((d, i) => d.setAttribute("aria-label", `${w.slide} ${i + 1}`));
    bar.querySelector(".kalq-m-slides__pause")?.setAttribute("aria-label", w.pause);
}

// Depth (2.16, 2.17, 2.19): [data-depth] layers drift with the scroll, a little, at their own speed; desktops only,
// never under reduced motion (a CSS variable, so the layers' own transforms stay theirs)
const desk = window.matchMedia("(min-width: 1000px) and (pointer: fine)");
let depthHooked = false;
function placeDepth() {
    const still = reducedMotion.matches || !desk.matches;
    const mid = window.innerHeight / 2;
    document.querySelectorAll("[data-depth]").forEach((n) => {
        if (still) { n.style.removeProperty("--depth-y"); return; }
        const r = n.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        n.style.setProperty("--depth-y", `${Math.round((r.top + r.height / 2 - mid) * Number(n.dataset.depth))}px`);
    });
}
function setupDepth() {
    if (!document.querySelector("[data-depth]")) return;
    const container = document.querySelector(".scrollbar-container");
    const bar = container && window.Scrollbar ? Scrollbar.get(container) : null;
    if (!depthHooked) {
        depthHooked = true;
        if (bar) bar.addListener(placeDepth);
        window.addEventListener("scroll", placeDepth, { passive: true });
        window.addEventListener("resize", placeDepth);
    }
    placeDepth();
}

//=================================== The inquiry chat ===================================//
// Plays the questions in the HTML as a conversation: the greeting, then one question at a time (tap a choice or type
// a short answer), the contact details if the editor asks for them, a summary, and two real links that open the
// visitor's own WhatsApp or mail with the inquiry filled in. Nothing leaves the visitor's device until they send it
// themselves; their progress is kept in their own browser (localStorage) so they can resume. Under reduced motion no
// typing pause and no animation: each message is simply there.
const CHAT_UI = {
    de: {
        placeholder: "Ihre Antwort", send: "Senden", skip: "Überspringen", country: "Ländervorwahl", answer: "Ihre Antwort", langs: "Sprache des Chats",
        resumeAsk: "Willkommen zurück! Weitermachen, wo Sie aufgehört haben?", resume: "Weitermachen", restart: "Neu beginnen", again: "Neue Anfrage",
        thanks: "Danke! Hier ist Ihre Anfrage. Senden Sie sie, wie es Ihnen lieber ist:", sent: "Ihre App öffnet sich mit der Anfrage. Danke, wir melden uns!",
        badEmail: "Das sieht nicht nach einer E-Mail-Adresse aus. Noch einmal?", badPhone: "Bitte die Nummer mit Ziffern, die Ländervorwahl steht davor.",
        badLink: "Bitte den Link zu Ihrem Profil oder den Namen darin.", needName: "Ihren Namen brauchen wir, damit wir wissen, wen wir ansprechen.",
    },
    en: {
        placeholder: "Your answer", send: "Send", skip: "Skip", country: "Country code", answer: "Your answer", langs: "Chat language",
        resumeAsk: "Welcome back! Pick up where you left off?", resume: "Continue", restart: "Start over", again: "New inquiry",
        thanks: "Thank you! Here is your inquiry. Send it whichever way you like:", sent: "Your app opens with the inquiry in it. Thank you, we'll be in touch!",
        badEmail: "That doesn't look like an email address. Once more?", badPhone: "Please type the number in digits; the country code goes in front.",
        badLink: "Please the link to your profile, or the name in it.", needName: "We need your name, so we know who to address.",
    },
};
const COUNTRIES = ["+49 DE", "+43 AT", "+41 CH", "+44 GB", "+1 US", "+33 FR", "+39 IT", "+34 ES", "+31 NL", "+32 BE", "+48 PL", "+420 CZ", "+45 DK", "+46 SE", "+47 NO",
    "+358 FI", "+351 PT", "+353 IE", "+30 GR", "+90 TR", "+971 AE", "+82 KR", "+81 JP", "+86 CN", "+91 IN", "+61 AU", "+55 BR", "+52 MX"];
const flagOf = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const chatLang = () => (en() ? "en" : "de");
const ui = () => CHAT_UI[chatLang()];
const chatText = () => CHAT_WORDS[chatLang()];
const OPTIONAL = new Set(["email", "phone", "linkedin"]);

function setupChat(sec) {
    if (sec.dataset.ready) { relabelChat(sec); return; }
    sec.dataset.ready = "true";
    sec.classList.add("is-live");
    const log = sec.querySelector(".kalq-m-chat__log");
    const script = sec.querySelector(".kalq-m-chat__script");
    const finish = sec.querySelector(".kalq-m-chat__finish");
    const steps = [...script.children].map((li) => ({ id: li.dataset.q, kind: li.dataset.kind, li }));
    const store = `kalq-chat:${location.pathname}:${sec.dataset.section}`;
    const load = () => { try { return JSON.parse(localStorage.getItem(store)) || null; } catch { return null; } };
    const save = () => { try { localStorage.setItem(store, JSON.stringify(st)); } catch { /* private window: this visit only */ } };
    let st = { at: 0, answers: {}, labels: {} };
    let busy = false;
    finish.hidden = true;
    log.setAttribute("aria-live", "polite");
    const greeting = log.querySelector(".is-greeting");

    // the answer bar: a short text (and for the phone, the country code)
    const bar = document.createElement("div");
    bar.className = "kalq-m-chat__bar";
    bar.hidden = true;
    const inputId = `${sec.dataset.section}-chat-input`;
    bar.innerHTML = `<label class="kalq-sr" for="${inputId}"></label><select class="kalq-m-chat__cc" hidden></select><input class="kalq-m-chat__input" id="${inputId}" type="text" autocomplete="off" maxlength="500"><button type="button" class="kalq-m-chat__sendbtn"></button>`;
    const cc = bar.querySelector("select"), input = bar.querySelector("input");
    COUNTRIES.forEach((c) => { const [code, iso] = c.split(" "); const o = document.createElement("option"); o.value = code; o.textContent = `${flagOf(iso)} ${code}`; cc.append(o); });
    finish.after(bar);
    let onSubmit = null;
    const submit = () => { const v = input.value.trim(); if (v && onSubmit) onSubmit(v); };
    bar.querySelector("button").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

    const avatarCopy = () => { const a = greeting?.querySelector(".kalq-chat-avatar, .kalq-m-chat__avatar")?.cloneNode(true); if (!a) return null; a.setAttribute("aria-hidden", "true"); a.querySelectorAll("img").forEach((i) => { i.alt = ""; i.removeAttribute("data-kalq-key"); }); a.removeAttribute("data-kalq-key"); return a; };
    const scrollToEnd = (node) => {
        const bar0 = document.querySelector(".scrollbar-container");
        const sb = bar0 && window.Scrollbar ? Scrollbar.get(bar0) : null;
        if (sb) sb.scrollIntoView(node, { onlyScrollIfNeeded: true, offsetBottom: 140, alignToTop: false });
        else node.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "auto" : "smooth" });
    };
    const wasInside = () => sec.contains(document.activeElement);
    const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion.matches ? 0 : ms));

    function message(kind, nodes) {
        const m = document.createElement("div");
        m.className = `kalq-m-chat__msg is-${kind}`;
        const b = document.createElement("div");
        b.className = "kalq-m-chat__bubble";
        nodes.forEach((n) => n && b.append(n));
        if (kind === "bot") { const a = avatarCopy(); if (a) m.append(a); }
        m.append(b);
        log.append(m);
        return m;
    }
    const para = (text) => Object.assign(document.createElement("p"), { textContent: text });
    async function bot(nodes, instant = false) {
        if (!instant && !reducedMotion.matches) {
            const typing = message("bot", [Object.assign(document.createElement("p"), { className: "kalq-m-chat__typing", textContent: "…" })]);
            typing.setAttribute("aria-hidden", "true");
            typing.classList.add("is-typing");
            await wait(600 + Math.random() * 400);
            typing.remove();
        }
        return message("bot", nodes);
    }
    const user = (text) => { const m = message("user", [para(text)]); scrollToEnd(m); return m; };

    // chips: the choices to tap (real buttons)
    function chips(list, onPick) {
        const row = document.createElement("div");
        row.className = "kalq-m-chat__chips";
        list.forEach(({ label, value }) => {
            const c = document.createElement("button");
            c.type = "button";
            c.className = "kalq-m-chat__chip";
            c.textContent = label;
            c.addEventListener("click", () => { if (busy) return; row.remove(); onPick(value ?? label, label); });
            row.append(c);
        });
        return row;
    }

    function askBar(step, focus) {
        const contact = step.kind === "contact";
        cc.hidden = !(contact && step.id === "phone");
        input.type = contact && step.id === "email" ? "email" : contact && step.id === "phone" ? "tel" : contact && step.id === "linkedin" ? "url" : "text";
        input.autocomplete = contact ? { name: "name", email: "email", phone: "tel-national", linkedin: "url" }[step.id] : "off";
        input.value = "";
        bar.hidden = false;
        if (focus) input.focus({ preventScroll: true });
    }
    const hideBar = () => { bar.hidden = true; onSubmit = null; };

    // the words of a question, as on the page (the copy follows a language switch: it keeps its block's key)
    const askNodes = (step) => [step.li.querySelector(".kalq-m-chat__ask").cloneNode(true)];

    async function ask(i, { instant = false } = {}) {
        if (i >= steps.length) return done(instant);
        const step = steps[i];
        const focus = wasInside();
        busy = true;
        const m = await bot(askNodes(step), instant);
        busy = false;
        if (step.kind === "choice") {
            hideBar();
            const list = [...step.li.querySelectorAll(".kalq-m-chat__choices li")].map((li) => ({ label: li.textContent.trim() }));
            const row = chips(list, (value) => answer(i, value, value));
            row.dataset.for = step.id;
            m.querySelector(".kalq-m-chat__bubble").append(row);
            if (focus) row.querySelector("button")?.focus({ preventScroll: true });
        } else {
            if (step.kind === "contact" && OPTIONAL.has(step.id)) {
                const row = chips([{ label: ui().skip, value: "" }], () => { hideBar(); answer(i, "", ui().skip); });
                m.querySelector(".kalq-m-chat__bubble").append(row);
            }
            onSubmit = (v) => check(step, v, i);
            askBar(step, focus);
        }
        if (focus || !instant) scrollToEnd(m);
    }

    // the contact details: checked, with a friendly word when something is off
    async function check(step, v, i) {
        let value = v, problem = null;
        if (step.kind === "contact") {
            if (step.id === "name" && v.length < 2) problem = ui().needName;
            if (step.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) problem = ui().badEmail;
            if (step.id === "phone") { const d = v.replace(/[\s()/.-]/g, "").replace(/^0+/, ""); if (!/^\d{4,14}$/.test(d)) problem = ui().badPhone; else value = `${cc.value} ${d}`; }
            if (step.id === "linkedin") {
                const m = v.match(/linkedin\.com\/(in|company)\/([\w%-]+)/i) || (/^[\w%-]{3,100}$/.test(v) ? [null, "in", v] : null);
                if (!m) problem = ui().badLink; else value = `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}`;
            }
        }
        if (problem) { user(v); input.value = ""; await bot([para(problem)]); input.focus({ preventScroll: true }); return; }
        hideBar();
        answer(i, value, value);
    }

    function answer(i, value, label) {
        const step = steps[i];
        log.querySelectorAll(".kalq-m-chat__msg .kalq-m-chat__chips").forEach((row) => { if (!row.closest(".kalq-m-chat__finish")) row.remove(); }); // answered: its chips go
        st.answers[step.id] = value;
        st.labels[step.id] = label;
        st.at = i + 1;
        save();
        user(label);
        ask(i + 1);
    }

    // the end: the summary as text, and the two links filled in
    async function done(instant) {
        hideBar();
        const w = chatText(), dl = finish.querySelector(".kalq-m-chat__summary");
        dl.replaceChildren();
        const lines = [];
        steps.forEach((step) => {
            const v = st.answers[step.id];
            if (v == null || v === "") return;
            const q = step.kind === "contact" ? w.contactLabels[["name", "email", "phone", "linkedin"].indexOf(step.id)] : step.li.querySelector(".kalq-m-chat__ask").textContent.trim();
            dl.append(Object.assign(document.createElement("dt"), { textContent: q }), Object.assign(document.createElement("dd"), { textContent: v }));
            lines.push(`${q}: ${v}`);
        });
        const title = sec.querySelector(".kalq-m-chat__title")?.textContent.trim() || w.title;
        const body = `${title}\n\n${lines.join("\n")}`;
        const name = st.answers.name;
        const wa = finish.querySelector(".is-wa"), mail = finish.querySelector(".is-mail");
        if (wa) wa.href = `${wa.href.split("?")[0]}?text=${encodeURIComponent(body)}`;
        if (mail) mail.href = `${mail.href.split("?")[0]}?subject=${encodeURIComponent(name ? `${title}: ${name}` : title)}&body=${encodeURIComponent(body)}`;
        st.done = true;
        save();
        const m = await bot([para(ui().thanks)], instant);
        m.querySelector(".kalq-m-chat__bubble").append(finish);
        finish.hidden = false;
        const again = chips([{ label: ui().again }], restart);
        finish.append(again);
        if (!instant || wasInside()) scrollToEnd(finish);
    }

    function restart() {
        try { localStorage.removeItem(store); } catch { /* nothing kept */ }
        st = { at: 0, answers: {}, labels: {} };
        finish.hidden = true;
        finish.querySelector(".kalq-m-chat__chips")?.remove();
        sec.querySelector(".kalq-m-chat__window").insertBefore(finish, bar);
        [...log.children].forEach((m) => { if (m !== greeting) m.remove(); });
        ask(0);
    }

    // sending: the visitor's own app opens; a word of thanks here
    finish.addEventListener("click", (e) => { if (e.target.closest(".kalq-m-chat__go")) setTimeout(() => bot([para(ui().sent)]), 300); });

    // the language pill: the site's language (the chat follows it)
    sec.querySelectorAll(".kalq-m-chat__lang").forEach((b) => b.addEventListener("click", async () => (await import("./header.js")).setLanguage(b.dataset.lang)));

    // start when it comes into view; a visitor who was here before may resume
    const begin = () => {
        const saved = load();
        if (saved && saved.at > 0 && steps.length) {
            bot([para(ui().resumeAsk)], true).then((m) => m.querySelector(".kalq-m-chat__bubble").append(chips([{ label: ui().resume, value: "resume" }, { label: ui().restart, value: "restart" }], (v) => {
                m.remove();
                if (v === "restart") return restart();
                st = { labels: {}, ...saved };
                for (let i = 0; i < Math.min(st.at, steps.length); i++) { message("bot", askNodes(steps[i])); message("user", [para(st.labels[steps[i].id] ?? st.answers[steps[i].id] ?? "")]); }
                ask(Math.min(st.at, steps.length), { instant: true });
            })));
        } else ask(0);
    };
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); begin(); }, { threshold: 0.2 });
    io.observe(sec);
    relabelChat(sec);
}

function relabelChat(sec) {
    const u = ui();
    // the choices in this language (the stored words; the other language where this one has none), and the chips of
    // the question now open
    sec.querySelectorAll("ul[data-choices]").forEach((ul) => {
        const e = storedEntry(ul.dataset.choices);
        const html = e && (e[chatLang()] ?? e[chatLang() === "en" ? "de" : "en"]);
        if (html == null) return;
        const list = html.split(/<br\s*\/?>|\n|<\/p>\s*<p>/i).map((x) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim()).filter(Boolean).slice(0, 8);
        ul.replaceChildren(...list.map((c) => Object.assign(document.createElement("li"), { textContent: c })));
        const row = sec.querySelector(`.kalq-m-chat__log .kalq-m-chat__chips[data-for="${ul.closest("li")?.dataset.q}"]`);
        if (row) [...row.children].forEach((c, k) => { if (list[k]) c.textContent = list[k]; });
    });
    sec.querySelector(".kalq-m-chat__bar label")?.replaceChildren(u.answer);
    sec.querySelector(".kalq-m-chat__input")?.setAttribute("placeholder", u.placeholder);
    const send = sec.querySelector(".kalq-m-chat__sendbtn");
    if (send) send.textContent = u.send;
    sec.querySelector(".kalq-m-chat__cc")?.setAttribute("aria-label", u.country);
    sec.querySelector(".kalq-m-chat__langs")?.setAttribute("aria-label", u.langs);
    sec.querySelectorAll(".kalq-m-chat__lang").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === chatLang())));
    const w = chatText();
    const wa = sec.querySelector(".kalq-m-chat__go.is-wa"), mail = sec.querySelector(".kalq-m-chat__go.is-mail");
    if (wa) wa.textContent = w.sendWa;
    if (mail) mail.textContent = w.sendMail;
    const t = sec.querySelector(".kalq-m-chat__summary-title");
    if (t) t.textContent = w.summary;
    const note = sec.querySelector(".kalq-m-chat__note");
    if (note) note.textContent = w.note;
    sec.querySelectorAll('.kalq-m-chat__q.is-contact').forEach((li) => { const k = ["name", "email", "phone", "linkedin"].indexOf(li.dataset.q); if (k >= 0) li.querySelector(".kalq-m-chat__ask").textContent = w.contactAsk[k]; });
}

//=================================== Start ===================================//
export function initModules(root = document) {
    const container = [...root.querySelectorAll('[data-barba="container"]')].pop();
    root.querySelectorAll(".kalq-m-faq").forEach(setupFaq);
    root.querySelectorAll(".kalq-m-belt").forEach(setupBelt);
    root.querySelectorAll(".kalq-m-hero").forEach(setupHero);
    root.querySelectorAll(".kalq-m[data-reveal]").forEach(setupReveal);
    root.querySelectorAll(".kalq-m-quotes").forEach(setupQuotes);
    relabelRatings(root);
    if (!document.body.classList.contains("kalq-edit")) {
        root.querySelectorAll(".kalq-m-car[data-carousel]").forEach(setupCarousel);
        root.querySelectorAll(".kalq-m-slides[data-slider]").forEach(setupSlides);
    }
    setupDepth();
    root.querySelectorAll(".kalq-m-chat[data-chat]").forEach(setupChat);
    root.querySelectorAll('[data-barba="container"] > section.expertise').forEach(setupListPanel);
    if (container) setupScreen2(container);
    if (!initModules.listening) {
        initModules.listening = true;
        spanned.addEventListener("change", () => initModules()); // the device folded or unfolded
        document.addEventListener("kalq:language", () => initModules()); // the controls' labels
    }
}
