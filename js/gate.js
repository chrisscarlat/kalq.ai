// Gate page: access code for guests (no account), Google or LinkedIn for editors.
// The server decides (see api/code.js, api/session.js); this only drives the UI and the Supabase session.
import { logoAnimation } from "./logoAnimation.js";
import { sanitizeSvg } from "../lib/svg-sanitize.js";

const TEXT = {
    de: {
        label: "Zugangscode",
        or: "oder",
        google: "Weiter mit Google",
        linkedin: "Weiter mit LinkedIn",
        wrong: "Dieser Code stimmt nicht.",
        rate: "Zu viele Versuche. Bitte warten Sie einige Minuten.",
        domain: "Dieser Login ist für Kolleginnen und Kollegen von Certil und Neurawork. Nutzen Sie den Zugangscode oder bitten Sie um eine Einladung.",
        failed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
        impressum: "Impressum",
        privacy: "Datenschutz",
    },
    en: {
        label: "Access code",
        or: "or",
        google: "Continue with Google",
        linkedin: "Continue with LinkedIn",
        wrong: "That code isn't right.",
        rate: "Too many attempts. Please wait a few minutes.",
        domain: "This login is for Certil and Neurawork colleagues. Use the access code or ask for an invite.",
        failed: "Something went wrong. Please try again.",
        impressum: "Legal notice",
        privacy: "Privacy",
    },
};

let lang = "de";
try { if (localStorage.getItem("kalq-lang") === "en") lang = "en"; } catch (e) { }
const t = (key) => TEXT[lang][key];
document.documentElement.lang = lang;
document.querySelectorAll("[data-gate-text]").forEach((el) => { el.textContent = t(el.dataset.gateText); });

const form = document.querySelector(".gate_form");
const cells = [...document.querySelectorAll(".gate_cell")];
const cellsWrap = document.querySelector(".gate_cells");
const message = document.querySelector(".gate_message");
const loginButtons = [...document.querySelectorAll(".gate_login")];

const say = (key) => { message.textContent = key ? t(key) : ""; };

// Where to go afterwards: ?next= or the gated URL the middleware rewrote to this page. Same origin paths only.
const safeNext = (path) => {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
    return path.startsWith("/gate") ? "/" : path;
};
const params = new URLSearchParams(location.search);
const nextPath = safeNext(params.get("next") || (location.pathname.startsWith("/gate") ? "/" : location.pathname + location.search));
const go = () => location.replace(nextPath);

const mark = document.querySelector(".gate_mark");
if (mark && window.gsap) logoAnimation(mark, { delay: 0.8 });

//=================================== Style variants ===================================//
// Only the logo cycles through the published variants, one per second with a crossfade; the rest stays still.
// A variant with its own logo shows it (sanitised), one without shows the Kalq mark in its accent colour.
async function cycleVariantLogos() {
    const stack = document.querySelector(".gate_logo__stack");
    if (!stack || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const res = await fetch("/api/variants").catch(() => null);
    if (!res?.ok) { res?.body?.cancel(); return; }
    const { variants = [] } = await res.json();
    if (variants.length < 2) return;
    const base = stack.querySelector('[data-variant="default"]');
    const layers = variants.map((v) => {
        if (v.is_default && !v.logo_svg) return base; // the animated mark
        const layer = document.createElement("div");
        layer.className = "gate_logo__layer";
        layer.dataset.variant = v.letter;
        const clean = v.logo_svg ? sanitizeSvg(v.logo_svg) : "";
        const doc = clean ? new DOMParser().parseFromString(clean, "image/svg+xml") : null;
        if (doc && !doc.querySelector("parsererror")) layer.append(document.importNode(doc.documentElement, true));
        else {
            const copy = base.querySelector("svg").cloneNode(true); // keeps the gate_mark size
            copy.style.color = v.colors?.accent || "#fff";
            layer.append(copy);
        }
        stack.append(layer);
        return layer;
    });
    let i = 0;
    setInterval(() => {
        layers[i].classList.remove("is-active");
        i = (i + 1) % layers.length;
        layers[i].classList.add("is-active");
    }, 1000);
}
cycleVariantLogos();

//=================================== Supabase ===================================//
let supabase = null;
async function client() {
    if (supabase) return supabase;
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("config");
    const { supabaseUrl, supabaseAnonKey } = await res.json();
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    });
    return supabase;
}

const post = (url, body) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
});

//=================================== Code cells ===================================//
const code = () => cells.map((c) => c.value).join("");
const setBusy = (busy) => {
    form.classList.toggle("is-busy", busy);
    cells.forEach((c) => { c.disabled = busy; });
};

function fill(from, text) {
    const letters = text.replace(/[^a-z0-9]/gi, "").toUpperCase().split("");
    let i = from;
    letters.forEach((letter) => { if (i < cells.length) cells[i++].value = letter; });
    cells.forEach((c) => c.classList.toggle("is-filled", !!c.value));
    if (code().length === cells.length) submitCode();
    else cells[Math.min(i, cells.length - 1)].focus();
}

cells.forEach((cell, index) => {
    cell.addEventListener("input", () => {
        const value = cell.value;
        cell.value = "";
        if (value) fill(index, value);
        cell.classList.toggle("is-filled", !!cell.value);
    });
    cell.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !cell.value && index > 0) {
            e.preventDefault();
            cells[index - 1].value = "";
            cells[index - 1].classList.remove("is-filled");
            cells[index - 1].focus();
        } else if (e.key === "ArrowLeft" && index > 0) {
            cells[index - 1].focus();
        } else if (e.key === "ArrowRight" && index < cells.length - 1) {
            cells[index + 1].focus();
        }
    });
    cell.addEventListener("paste", (e) => {
        e.preventDefault();
        fill(0, (e.clipboardData || window.clipboardData).getData("text"));
    });
    cell.addEventListener("focus", () => cell.select());
});
form.addEventListener("submit", (e) => e.preventDefault());

function wrong(key) {
    say(key);
    cellsWrap.classList.remove("is-wrong");
    void cellsWrap.offsetWidth; // restart the shake
    cellsWrap.classList.add("is-wrong");
    cells.forEach((c) => { c.value = ""; c.classList.remove("is-filled"); });
    cells[0].focus();
}

async function submitCode() {
    say(null);
    setBusy(true);
    try {
        // Guests need no account, the server checks the code and sets the gate cookie
        return finishCode(await post("/api/code", { code: code() }));
    } catch (error) {
        console.error(error);
        setBusy(false);
        wrong("failed");
    }
}

async function finishCode(res) {
    if (res.ok) return go();
    const { error } = await res.json().catch(() => ({}));
    setBusy(false);
    wrong(error === "wrong_code" ? "wrong" : error === "rate_limited" ? "rate" : "failed");
}

//=================================== Google and LinkedIn ===================================//
loginButtons.forEach((button) => button.addEventListener("click", async () => {
    say(null);
    loginButtons.forEach((b) => { b.disabled = true; });
    try {
        const sb = await client();
        const redirectTo = `${location.origin}/gate.html?next=${encodeURIComponent(nextPath)}`;
        const { error } = await sb.auth.signInWithOAuth({ provider: button.dataset.provider, options: { redirectTo } });
        if (error) throw error;
    } catch (error) {
        console.error(error);
        loginButtons.forEach((b) => { b.disabled = false; });
        say("failed");
    }
}));

// Back from the provider: Supabase finishes the session from the URL, then the server checks the email
async function finishLogin() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const error = params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error");
    if (error) {
        history.replaceState(null, "", `${location.pathname}?next=${encodeURIComponent(nextPath)}`);
        // The Before User Created hook rejects other domains with our own message
        say(/certil|neurawork|not allowed|signup|403/i.test(error) ? "domain" : "failed");
        return;
    }
    if (!params.get("code") && !hash.get("access_token")) return;

    try {
        const sb = await client();
        // Links from invite emails carry the session in the URL hash
        if (hash.get("access_token") && hash.get("refresh_token")) {
            await sb.auth.setSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token") });
            history.replaceState(null, "", `${location.pathname}?next=${encodeURIComponent(nextPath)}`);
        }
        const { data: { session } } = await sb.auth.getSession();
        if (!session || session.user.is_anonymous) return;
        loginButtons.forEach((b) => { b.disabled = true; });
        const res = await post("/api/session", { access_token: session.access_token });
        if (res.ok) {
            await sb.auth.refreshSession();
            return go();
        }
        const { error: reason } = await res.json().catch(() => ({}));
        await sb.auth.signOut();
        loginButtons.forEach((b) => { b.disabled = false; });
        say(reason === "domain" ? "domain" : "failed");
    } catch (err) {
        console.error(err);
        say("failed");
    }
}

finishLogin();
cells[0].focus();
