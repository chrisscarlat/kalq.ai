// Page translations: German (default) and English.
// Strings come from i18n/strings.json via tools/build_pages.py. strings-public.js is served without the gate
// cookie (legal pages), strings.js holds the rest of the copy and stays behind the gate.
import { STRINGS as PUBLIC_STRINGS } from "./strings-public.js";

const STRINGS = { ...PUBLIC_STRINGS };
let settled = false;
import("./strings.js")
    .then(({ STRINGS: gated }) => Object.assign(STRINGS, gated))
    .catch(() => { }) // outside the gate on a legal page: only the public copy exists
    .finally(() => { settled = true; applyLanguage(); });

const CONTENT_LANGS = ["en", "de"];
const MARQUEE_REPEAT = 60;
let current = "de"; // matches the generated HTML

export const contentLang = code => CONTENT_LANGS.includes(code) ? code : "de";

export function t(key) {
    const entry = STRINGS[key];
    return entry ? (entry[current] ?? entry.en) : key;
}

export function applyLanguage(code = current) {
    current = contentLang(code);
    document.documentElement.lang = current;

    // Keys not loaded yet keep their HTML text
    document.querySelectorAll("[data-i18n]").forEach(el => { if (STRINGS[el.dataset.i18n]) el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.querySelectorAll("[data-i18n-marquee]").forEach(el => {
        el.textContent = " " + `${t(el.dataset.i18nMarquee)} `.repeat(MARQUEE_REPEAT);
    });

    // During a Barba transition the new container is the last one
    const containers = document.querySelectorAll('[data-barba="container"]');
    const page = containers.length ? containers[containers.length - 1].dataset.page : null;
    if (page && STRINGS[`title.${page}`]) document.title = t(`title.${page}`);
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", t("meta.description"));

    if (settled) document.documentElement.classList.remove("i18n-pending");
    document.dispatchEvent(new CustomEvent("kalq:language", { detail: current }));
}
