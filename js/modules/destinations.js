// Where a link can send a visitor besides a page: their own messaging app or mail, opened on the address the editor
// gives (a number, a user name, an ID, an email address). Nothing is sent from the site; the app opens and the visitor
// writes. Shared by the server render and the browser, so no browser globals.
import { plain } from "./kit.js";

const phoneDigits = (raw) => plain(raw).replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/(?!^)\+/g, "");

const telegram = (raw) => {
    const v = plain(raw).replace(/^https?:\/\/t\.me\//i, "");
    const user = v.replace(/^@/, "");
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(user)) return `https://t.me/${user}`;
    const d = phoneDigits(v);
    return /^\+\d{6,15}$/.test(d) ? `https://t.me/${d}` : null;
};

// id: stored on the link; label: the editor's name for it (English, the editor's language); hint: what the address is;
// href(value): the link, or null when the value is not valid for it; blank: opens in a new tab
export const SEND_DESTS = [
    { id: "whatsapp", label: "WhatsApp", hint: "Phone number with country code, e.g. +49 170 1234567", blank: true,
        href: (v) => { const d = phoneDigits(v); return /^\+?\d{6,15}$/.test(d) ? `https://wa.me/${d.replace("+", "")}` : null; } },
    { id: "telegram", label: "Telegram", hint: "User name (@name) or phone number", blank: true, href: telegram },
    { id: "threema", label: "Threema", hint: "Threema ID, 8 characters", blank: true,
        href: (v) => { const id = plain(v).toUpperCase(); return /^[A-Z0-9*]{8}$/.test(id) ? `https://threema.id/${id}` : null; } },
    { id: "sms", label: "SMS", hint: "Phone number with country code", blank: false,
        href: (v) => { const d = phoneDigits(v); return /^\+\d{6,15}$/.test(d) ? `sms:${d}` : null; } },
    { id: "email", label: "Email", hint: "Email address", blank: false,
        href: (v) => { const m = plain(v); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) ? `mailto:${m}` : null; } },
];

export const destOf = (id) => SEND_DESTS.find((d) => d.id === id) || null;
