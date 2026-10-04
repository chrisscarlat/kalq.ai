// Global header: logo collapse on scroll, language switcher, four dot menu.
// The header lives outside the Barba container, so it is initialised once and refreshed after each page transition.

import { applyLanguage, currentLang, t } from "./i18n.js";

const LANG_KEY = "kalq-lang";
let header, updateCompact = () => { }, setCurrentPage = () => { };

export function initHeader() {
    header = document.querySelector(".site-header");
    if (!header || header.dataset.ready) return;
    header.dataset.ready = "true";

    initLogoCollapse();
    initLangSwitcher(header.querySelector("[data-lang-switcher]"));
    initMenu(header.querySelector(".site-menu-toggle"), document.getElementById("site-menu"));
    initNav(header);
}

export function refreshHeader() {
    updateCompact();
    setCurrentPage();
    applyLanguage();
}

//=================================== Logo ===================================//
// The page scrolls inside smooth-scrollbar, not the window.
function getScrollY() {
    const container = document.querySelector(".scrollbar-container");
    const scrollbar = container && window.Scrollbar ? Scrollbar.get(container) : null;
    return scrollbar ? scrollbar.offset.y : window.scrollY;
}

function initLogoCollapse() {
    updateCompact = () => {
        const hero = document.querySelector('[data-barba="container"] > section');
        const threshold = (hero ? hero.offsetHeight : window.innerHeight) / 2;
        header.classList.toggle("is-compact", getScrollY() > threshold);
        header.classList.toggle("is-scrolled", getScrollY() > 60); // the bar navigations take the page's background
    };

    const container = document.querySelector(".scrollbar-container");
    const scrollbar = container && window.Scrollbar ? Scrollbar.get(container) : null;
    if (scrollbar) scrollbar.addListener(updateCompact);
    else window.addEventListener("scroll", updateCompact, { passive: true });
    window.addEventListener("resize", updateCompact);
    updateCompact();
}

//=================================== Language ===================================//
// English and German, both fully translated.
let chooseLanguage = null;
// Switch language from elsewhere (the magazine's own control): the same as picking it here, remembered
export const setLanguage = (code) => chooseLanguage?.(code);

// Another copy of the switcher (the magazine draws its own): the same look and behaviour; picking calls pick(code).
// signal: an AbortSignal that detaches its listeners when the copy goes away.
export const bindLangSwitcher = (root, { pick, signal } = {}) => initLangSwitcher(root, { pick, signal });

function initLangSwitcher(root, { pick = null, signal } = {}) {
    if (!root) return;
    const items = [...root.querySelectorAll("[data-lang]")];
    let lastPointer = "mouse";

    const open = () => root.classList.add("is-open");
    const close = () => {
        root.classList.remove("is-open");
        preview(null);
    };

    // Hovered letter expands to its full name, the active one collapses to its letter
    const preview = (target) => items.forEach(item => {
        item.classList.toggle("is-preview", item === target && !item.classList.contains("is-active"));
        item.classList.toggle("is-dimmed", item.classList.contains("is-active") && !!target && target !== item);
    });

    const mark = (code) => items.forEach(item => {
        const active = item.dataset.lang === code;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", active);
    });
    const setActive = (code, persist) => {
        mark(code);
        if (pick) return pick(code);
        applyLanguage(code);
        if (persist) {
            try { localStorage.setItem(LANG_KEY, code); } catch (e) { }
        }
    };

    if (pick) mark(currentLang()); // a copy shows the language in use and applies nothing by itself
    else {
        chooseLanguage = (code) => setActive(code, true);
        let stored = null;
        try { stored = localStorage.getItem(LANG_KEY); } catch (e) { }
        setActive(items.some(i => i.dataset.lang === stored) ? stored : "de", false); // German by default
    }

    root.addEventListener("pointerdown", e => { lastPointer = e.pointerType; });
    root.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") open(); });
    root.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") close(); });

    items.forEach(item => {
        // pointermove, not pointerenter: opening the list shifts items under a still cursor
        item.addEventListener("pointermove", e => {
            if (e.pointerType === "mouse" && !item.classList.contains("is-preview")) preview(item);
        });
        item.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") preview(null); });
        item.addEventListener("focus", () => {
            if (!item.matches(":focus-visible")) return;
            open();
            preview(item);
        });
        item.addEventListener("click", () => {
            // Touch: first tap opens the list, second tap picks
            if (lastPointer !== "mouse" && !root.classList.contains("is-open")) return open();
            setActive(item.dataset.lang, true);
            preview(null);
            if (lastPointer !== "mouse") close();
            lastPointer = "mouse";
        });
    });

    root.addEventListener("focusout", e => { if (!root.contains(e.relatedTarget)) close(); });
    document.addEventListener("pointerdown", e => { if (!root.contains(e.target)) close(); }, { signal });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); }, { signal });
}

//=================================== The library's navigations ===================================//
// One <nav> (css/components/_nav.scss): a bar (minimal, plain, mega) or a full-screen overlay, chosen in the style.
// The menu button opens it as a panel (phones; the overlay always): focus stays inside while it is open, Esc and the
// close button return focus to the menu button. The mega panel opens on hover after a short pause, and on click or
// Enter; Esc closes it; the arrow keys move between its items.
const phone = window.matchMedia("(max-width: 690px)");
function initNav(header) {
    const nav = document.getElementById("site-nav");
    const toggle = header.querySelector(".site-nav-toggle");
    if (!nav || !toggle) return;
    const root = document.documentElement;
    const isPanel = () => root.classList.contains("nav-overlay") || (root.classList.contains("nav-bar") && phone.matches);
    const focusables = () => [...nav.querySelectorAll("a[href], button")].filter((n) => n.offsetParent || n === document.activeElement);
    const setOpen = (open, { returnFocus = true } = {}) => {
        root.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", open);
        toggle.setAttribute("aria-label", t(open ? "aria.menuClose" : "aria.menuOpen"));
        if (open) requestAnimationFrame(() => focusables()[0]?.focus());
        else if (returnFocus && nav.contains(document.activeElement)) toggle.focus();
    };
    toggle.addEventListener("click", () => setOpen(!root.classList.contains("nav-open")));
    nav.querySelector(".site-nav__close")?.addEventListener("click", () => setOpen(false));
    nav.addEventListener("click", (e) => { if (e.target.closest("a[href]") && !e.target.closest(".site-nav__mega > .site-nav__link")) setOpen(false, { returnFocus: false }); });
    document.addEventListener("keydown", (e) => {
        if (!root.classList.contains("nav-open") || !isPanel()) return;
        if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
        if (e.key !== "Tab") return;
        // focus stays inside the open panel
        const list = focusables();
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    phone.addEventListener("change", () => setOpen(false, { returnFocus: false }));
    window.barba?.hooks?.before?.(() => setOpen(false, { returnFocus: false }));

    // the mega panel
    const item = nav.querySelector(".site-nav__mega");
    const trigger = item?.querySelector(":scope > .site-nav__link");
    const panel = item?.querySelector(".site-mega");
    if (item && trigger && panel) {
        const mega = () => root.classList.contains("nav-mega") && !phone.matches;
        let timer = 0;
        const show = (open, focusFirst = false) => {
            clearTimeout(timer);
            item.classList.toggle("is-open", open);
            trigger.setAttribute("aria-expanded", open);
            if (open && focusFirst) requestAnimationFrame(() => panel.querySelector("a")?.focus());
        };
        item.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && mega()) { clearTimeout(timer); timer = setTimeout(() => show(true), 140); } });
        item.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && mega()) { clearTimeout(timer); timer = setTimeout(() => show(false), 220); } });
        trigger.addEventListener("click", (e) => {
            if (!mega()) return;
            e.preventDefault(); // the panel holds the way to the page (its card)
            show(!item.classList.contains("is-open"), e.detail === 0);
        });
        item.addEventListener("keydown", (e) => {
            if (!mega() || !item.classList.contains("is-open")) return;
            const links = [...panel.querySelectorAll("a")];
            const i = links.indexOf(document.activeElement);
            if (e.key === "Escape") { e.preventDefault(); show(false); trigger.focus(); return; }
            const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
            if (step) { e.preventDefault(); links[(i + step + links.length) % links.length]?.focus(); }
            else if (e.key === "Home" || e.key === "End") { e.preventDefault(); links[e.key === "Home" ? 0 : links.length - 1].focus(); }
        });
        item.addEventListener("focusout", (e) => { if (mega() && !item.contains(e.relatedTarget)) show(false); });
        document.addEventListener("pointerdown", (e) => { if (!item.contains(e.target)) show(false); });
    }

    // the rolling copies of the labels follow the language
    const relabel = () => document.querySelectorAll(".site-roll").forEach((r) => r.setAttribute("data-label", r.firstElementChild?.textContent.trim() || ""));
    document.addEventListener("kalq:language", () => { relabel(); setOpen(root.classList.contains("nav-open"), { returnFocus: false }); });
    relabel();
}

//=================================== Menu ===================================//
function initMenu(toggle, menu) {
    if (!toggle || !menu) return;

    const setOpen = (isOpen) => {
        toggle.setAttribute("aria-expanded", isOpen);
        toggle.setAttribute("aria-label", t(isOpen ? "aria.menuClose" : "aria.menuOpen"));
        menu.classList.toggle("is-open", isOpen);
        document.documentElement.classList.toggle("menu-is-open", isOpen); // the panel menu recolours the header
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("pointerdown", e => {
        if (!menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape" || !menu.classList.contains("is-open")) return;
        setOpen(false);
        toggle.focus();
    });

    setCurrentPage = () => {
        const page = location.pathname.split("/").pop() || "index.html";
        [...menu.querySelectorAll("a"), ...document.querySelectorAll(".site-nav__link")].forEach(link => {
            if (link.getAttribute("href") === page) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    };
    setCurrentPage();

    // Keep the toggle label in the current language
    document.addEventListener("kalq:language", () => setOpen(menu.classList.contains("is-open")));
    setOpen(false);
}
