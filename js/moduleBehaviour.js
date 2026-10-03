// Behaviour of page builder modules for visitors. Everything works as plain HTML first: FAQ answers are in the page
// and visible; with this script they fold into an accordion (the first stays open).
export function initModules(root = document) {
    root.querySelectorAll(".kalq-m-faq").forEach((faq) => {
        faq.querySelectorAll(".kalq-m-faq__toggle").forEach((toggle, i) => {
            if (toggle.dataset.ready) return;
            toggle.dataset.ready = "true";
            const answer = faq.querySelector(`#${CSS.escape(toggle.getAttribute("aria-controls"))}`);
            if (!answer) return;
            const set = (open) => { toggle.setAttribute("aria-expanded", open); answer.hidden = !open; };
            set(i === 0);
            toggle.addEventListener("click", () => {
                set(toggle.getAttribute("aria-expanded") !== "true");
                window.dispatchEvent(new Event("resize")); // the smooth scroller measures the page again
            });
        });
    });
}
