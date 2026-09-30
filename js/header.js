// Global header: logo collapse on scroll, language switcher, four dot menu.
// The header lives outside the Barba container, so it is initialised once and refreshed after each page transition.

import { applyLanguage, t } from "./i18n.js";

const LANG_KEY = "kalq-lang";
let header, updateCompact = () => { }, setCurrentPage = () => { };

export function initHeader() {
    header = document.querySelector(".site-header");
    if (!header || header.dataset.ready) return;
    header.dataset.ready = "true";

    initLogoCollapse();
    initLangSwitcher(header.querySelector("[data-lang-switcher]"));
    initMenu(header.querySelector(".site-menu-toggle"), document.getElementById("site-menu"));
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
function initLangSwitcher(root) {
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

    const setActive = (code, persist) => {
        items.forEach(item => {
            const active = item.dataset.lang === code;
            item.classList.toggle("is-active", active);
            item.setAttribute("aria-pressed", active);
        });
        applyLanguage(code);
        if (persist) {
            try { localStorage.setItem(LANG_KEY, code); } catch (e) { }
        }
    };

    let stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { }
    setActive(items.some(i => i.dataset.lang === stored) ? stored : "de", false); // German by default

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
    document.addEventListener("pointerdown", e => { if (!root.contains(e.target)) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

//=================================== Menu ===================================//
function initMenu(toggle, menu) {
    if (!toggle || !menu) return;

    const setOpen = (isOpen) => {
        toggle.setAttribute("aria-expanded", isOpen);
        toggle.setAttribute("aria-label", t(isOpen ? "aria.menuClose" : "aria.menuOpen"));
        menu.classList.toggle("is-open", isOpen);
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
        menu.querySelectorAll("a").forEach(link => {
            if (link.getAttribute("href") === page) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    };
    setCurrentPage();

    // Keep the toggle label in the current language
    document.addEventListener("kalq:language", () => setOpen(menu.classList.contains("is-open")));
    setOpen(false);
}
