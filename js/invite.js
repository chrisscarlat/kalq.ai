// "Invite colleague" for editors: a small form above the toolbar, sent to /api/invite.
import { EDITOR_LANG } from "./i18n.js";

const TEXT = {
    de: { title: "Kollegin oder Kollegen einladen", placeholder: "name@firma.de", send: "Einladen", sent: (e) => `Einladung an ${e} gesendet.`, existing: (e) => `${e} kann sich jetzt anmelden.`, bad: "Bitte eine gültige E-Mail-Adresse eingeben.", failed: "Einladung fehlgeschlagen." },
    en: { title: "Invite colleague", placeholder: "name@company.com", send: "Invite", sent: (e) => `Invite sent to ${e}.`, existing: (e) => `${e} can log in now.`, bad: "Please enter a valid email address.", failed: "The invite did not work." },
};
const t = (key) => TEXT[EDITOR_LANG][key];

export function initInvite(collab) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kalq-toolbar__btn";
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

    const form = document.createElement("form");
    form.className = "kalq-invite";
    form.hidden = true;
    form.innerHTML = '<label class="kalq-invite__label"></label><div class="kalq-invite__row"><input type="email" required autocomplete="email"><button type="submit" class="kalq-btn kalq-btn--primary"></button></div>';
    const input = form.querySelector("input");
    const submit = form.querySelector("button");
    const label = () => {
        button.title = t("title");
        button.setAttribute("aria-label", t("title"));
        form.querySelector(".kalq-invite__label").textContent = t("title");
        input.placeholder = t("placeholder");
        input.setAttribute("aria-label", t("title"));
        submit.textContent = t("send");
    };
    label();
    document.body.append(form);

    const setOpen = (open) => {
        form.hidden = !open;
        button.setAttribute("aria-expanded", open);
        if (open) input.focus();
    };
    button.addEventListener("click", () => setOpen(form.hidden));
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); });
    document.addEventListener("pointerdown", (e) => { if (!form.hidden && !form.contains(e.target) && !button.contains(e.target)) setOpen(false); });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = input.value.trim();
        if (!input.checkValidity() || !email) return collab.toast(t("bad"), "error");
        submit.disabled = true;
        try {
            const res = await fetch("/api/invite", {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "failed");
            collab.toast(data.emailed ? t("sent")(email) : t("existing")(email));
            input.value = "";
            setOpen(false);
        } catch (error) {
            collab.toast(error.message === "email" ? t("bad") : t("failed"), "error");
        } finally {
            submit.disabled = false;
        }
    });

    document.addEventListener("kalq:language", label);
    collab.addTool(button, 40);
}
