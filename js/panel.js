// Side panel with tabs, opened from the clock button in the toolbar (or H). Comments add a tab here,
// version history adds another. A plain <aside>, never a <nav>, and outside the blended header.
import { currentLang } from "./i18n.js";

const tabs = [];
let root, body, tabBar, button, active = null, collab;

const TEXT = { de: { title: "Verlauf (H)", close: "Schließen" }, en: { title: "History (H)", close: "Close" } };
const t = (key) => TEXT[currentLang() === "en" ? "en" : "de"][key];

function renderTabs() {
    tabBar.replaceChildren(...tabs.map((tab) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kalq-panel__tab";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", tab.id === active);
        b.textContent = tab.label();
        b.addEventListener("click", () => show(tab.id));
        return b;
    }));
    tabBar.hidden = tabs.length < 2;
}

function show(id) {
    active = id;
    renderTabs();
    body.replaceChildren();
    tabs.find((tab) => tab.id === id)?.render(body);
}

export const panel = {
    get isOpen() { return root.classList.contains("is-open"); },
    get active() { return active; },
    // Tabs sorted by `order`; the first one is the default
    addTab(tab) {
        tabs.push(tab);
        tabs.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
        active = tabs[0].id;
        renderTabs();
    },
    open(id = active) {
        root.classList.add("is-open");
        root.removeAttribute("inert");
        button.setAttribute("aria-pressed", "true");
        show(id);
    },
    close() {
        root.classList.remove("is-open");
        root.setAttribute("inert", "");
        button.setAttribute("aria-pressed", "false");
    },
    // Re-render the tab if it is the one showing
    refresh(id) { if (this.isOpen && active === id) show(id); },
};

export function initPanel(api) {
    collab = api;
    root = document.createElement("aside");
    root.className = "kalq-panel";
    root.setAttribute("inert", "");
    root.innerHTML = '<div class="kalq-panel__head"><div class="kalq-panel__tabs" role="tablist"></div><button type="button" class="kalq-panel__close"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div><div class="kalq-panel__body"></div>';
    tabBar = root.querySelector(".kalq-panel__tabs");
    body = root.querySelector(".kalq-panel__body");
    root.querySelector(".kalq-panel__close").addEventListener("click", () => panel.close());
    document.body.append(root);

    button = document.createElement("button");
    button.type = "button";
    button.className = "kalq-toolbar__btn";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const label = () => {
        button.title = t("title");
        button.setAttribute("aria-label", t("title"));
        root.querySelector(".kalq-panel__close").setAttribute("aria-label", t("close"));
        root.setAttribute("aria-label", t("title"));
    };
    label();
    button.addEventListener("click", () => (panel.isOpen ? panel.close() : panel.open()));
    collab.addTool(button, 30);

    collab.on("key:h", () => button.click());
    collab.on("escape", () => panel.close());
    document.addEventListener("kalq:language", () => { label(); renderTabs(); if (panel.isOpen) show(active); });
    return panel;
}
