import { expertiseHover } from "./expertiseHoverimg.js";
import { mouseMoveParallaxLine } from "./verticleLine.js";
import { initHeader, refreshHeader } from "./header.js";
import { logoAnimation } from "./logoAnimation.js";
import { applyLanguage } from "./i18n.js";
import { loadPageContent } from "./content.js";
import { animateLines } from "./blocks.js";
import { initVariants, refreshHeroMark } from "./variants.js";
import { initHeroTone } from "./heroTone.js";
import { initHeroReveal } from "./heroReveal.js";
import { initModules } from "./moduleBehaviour.js";
import { initMagazine } from "./magazine.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.addEventListener("DOMContentLoaded", async () => {
    gsap.registerPlugin(ScrollTrigger);
    [barbaPageTransition, smoothScroller, initHeader, logoAnimation, mouseMoveParallaxLine].forEach(func => func());
    initVariants(); // style variant: colours, fonts, logo, images; switcher next to the logo
    initHeroTone(); // light or dark text over the hero image, the header follows
    initHeroReveal(); // style variant option: liquid reveal that follows the pointer over the hero video
    stayOnSamePage();
    // Counters, hover images and the video read their content, so they start after edited content is applied
    await loadPageContent();
    [animateNumbering, expertiseHover, heroVideo, parallaxImg, animateLines, initModules, initMagazine].forEach(func => func());
    // The page builder changed the sections (an insert, a move, someone else's change): new modules start working,
    // the scroller and the scroll animations measure the page again
    document.addEventListener("kalq:layout", () => {
        initModules();
        animateLines();
        ScrollTrigger.refresh();
        window.dispatchEvent(new Event("resize"));
    });
});

let bodyScrollBar;

// Smooth Scroll Setup
function smoothScroller() {
    const scroller = document.querySelector('.scrollbar-container');
    if (!scroller) return console.error("Scrollbar container not found.");
    bodyScrollBar = Scrollbar.init(scroller, { damping: 0.05, delegateTo: document, thumbMinSize: 20 });
    ScrollTrigger.scrollerProxy(scroller, {
        scrollTop(value) { return arguments.length ? bodyScrollBar.scrollTop = value : bodyScrollBar.scrollTop; }
    });
    bodyScrollBar.addListener(ScrollTrigger.update);
    ScrollTrigger.defaults({ scroller });

    const updateProgressBar = () => {
        const progress = (bodyScrollBar.offset.y / bodyScrollBar.limit.y) * 100;
        gsap.to(".progressBar", { width: `${progress}%`, ease: "none", duration: 0.3 });
    };
    bodyScrollBar.addListener(updateProgressBar);
    window.addEventListener("resize", updateProgressBar);
    updateProgressBar();
}

// A link to the page you are on (the logo on Home, the current menu entry): Barba skips it and the browser would
// reload, which loses a style variant preview. Scroll back to the top instead.
function stayOnSamePage() {
    document.addEventListener("click", (e) => {
        const link = e.target.closest?.("a[href]");
        if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === "_blank") return;
        const url = new URL(link.href, location.href);
        const page = (p) => p.replace(/\/(index\.html)?$/, "/");
        if (url.origin !== location.origin || page(url.pathname) !== page(location.pathname) || url.hash) return;
        e.preventDefault();
        if (bodyScrollBar) bodyScrollBar.scrollTo(0, 0, 900);
        else window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// BarbaJs page Setup
function barbaPageTransition() {
    const loader = {
        init() { gsap.set('.loader', { scaleX: 0, rotation: 10, xPercent: -5, yPercent: -50, transformOrigin: 'left center', autoAlpha: 1 }); },
        in: () => gsap.fromTo('.loader', { rotation: 10, scaleX: 0, xPercent: -5 }, { duration: 1.5, xPercent: 0, scaleX: 1, rotation: 0, ease: 'power4.inOut', transformOrigin: 'left center' }),
        away: () => gsap.to('.loader', { duration: 1.5, scaleX: 0, xPercent: 5, rotation: -10, transformOrigin: 'right center', ease: 'power4.inOut' })
    };
    loader.init();

    barba.init({
        // Barba loads the page in full when the next page takes longer than this (default 2 s)
        timeout: 10000,
        transitions: [{
            async leave(data) {
                const done = this.async();
                loader.in();
                await new Promise(r => setTimeout(r, 1500));
                done();
            },
            async enter(data) {
                await loadPageContent(data.next.container); // still behind the loader, so no flash
                loader.away();
                reinitializeFunctions();
            },
        }]
    });

    barba.hooks.before(() => {
        document.querySelector('html').classList.add('is-transitioning');
        // The page being left is discarded: stop its video downloads so the next page arrives quickly
        document.querySelectorAll('[data-barba="container"] video').forEach(video => {
            video.pause();
            video.removeAttribute('src');
            video.querySelectorAll('source').forEach(source => source.removeAttribute('src'));
            video.load();
        });
    });
    barba.hooks.after(() => {
        document.querySelector('html').classList.remove('is-transitioning');
        applyLanguage(); // Barba resets the title from the fetched page
    });

    function reinitializeFunctions() {
        // Call functions that need to be reinitialized after page change
        [recalculateLayout,
            scrollToTop,
            smoothScroller,
            ScrollTrigger.refresh,
            refreshHeader,
            mouseMoveParallaxLine,
            animateNumbering,
            expertiseHover,
            heroVideo,
            refreshHeroMark,
            initHeroTone,
            initHeroReveal,
            initModules,
            initMagazine,
            parallaxImg,
            animateLines].forEach(func => func());
    }

    const scrollToTop = () => bodyScrollBar ? bodyScrollBar.scrollTo(0, 0, 0) : window.scrollTo(0, 0);
    const recalculateLayout = () => gsap.to(window, { duration: 0.1, onComplete: () => window.dispatchEvent(new Event('resize')) });
}

//=================================== Home Page ===================================//
// Animate Numbering For About Section
function animateNumbering() {
    document.querySelectorAll('.numbering h2').forEach(h2 => {
        const endValue = parseInt(h2.textContent.replace(/[^\d]/g, ''));
        gsap.timeline({ scrollTrigger: { trigger: h2, start: "top bottom", toggleActions: "play none none none" }, defaults: { duration: 1.5, ease: "power1.inOut" } })
            .fromTo(h2, { innerText: 0 }, {
                innerText: endValue, roundProps: "innerText", ease: "power3.inOut",
                onUpdate: () => h2.textContent = Math.ceil(gsap.getProperty(h2, "innerText")),
                onComplete: () => h2.textContent = endValue
            });
    });
}

// Hero video: paused for reduced motion, restarted after Barba swaps the container
function heroVideo() {
    const video = document.querySelector(".hero_video");
    if (!video || video.tagName !== "VIDEO") return; // a style variant can put an image there
    if (reducedMotion.matches) {
        video.removeAttribute("autoplay");
        video.pause();
        return;
    }
    video.muted = true;
    video.preload = "auto"; // loaded only now, after the page scripts (see the hero markup)
    const playing = video.play();
    if (playing) playing.catch(() => { });
}

//=================================== About Parrallax Image  ===================================//
function parallaxImg() {
    let parallaxImages = gsap.utils.toArray(".parallax_img");

    if (parallaxImages.length === 0) {
        return;
    }

    parallaxImages.forEach(function (parallaxCnt) {
        let pimage = parallaxCnt.querySelector("img, video"); // a slot can hold either

        let tl8 = gsap.timeline({
            scrollTrigger: {
                trigger: parallaxCnt,
                scrub: true,
                pin: false,
            },
        });

        tl8.fromTo(pimage,
            { yPercent: -10 },
            { yPercent: 10, ease: "none" });
    });
}

