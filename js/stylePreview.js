// The design panel's previews beside the Menu, Navigation and Notifications tabs: a browser drawn in white lines with
// the page inside it as a wireframe (white bars for text, pills for buttons), showing what is selected the way it
// looks on the site: the header of each menu style with its own buttons (the four dots, the panels icon, the two
// lines), the menu opening as it does there (the dropdown card, the three panels wiping down, the mega panel, the
// full-screen sheet), the footer, and the cookie bar with its running line. A menu that opens does so in a loop;
// under reduced motion it is shown open and still. Styles: css/collab.scss (.kalq-wire).

const h = (tag, className = "", ...children) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
};
// a line of text as a white bar, its width in % of the space it sits in (or a fixed width in px)
const bar = (w, extra = "") => { const b = h("span", `kalq-wire__txt ${extra}`); b.style.width = typeof w === "number" ? `${w}%` : w; return b; };
const pill = (extra = "") => h("span", `kalq-wire__pill ${extra}`, bar("58%"), h("span", "kalq-wire__pill-dot"));
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The browser: its bar (three dots, the address), and the page inside
function browser(page, label) {
    const frame = h("div", "kalq-wire", h("div", "kalq-wire__chrome", h("span", "kalq-wire__lights", h("i"), h("i"), h("i")), h("span", "kalq-wire__address")), page);
    frame.setAttribute("role", "img");
    frame.setAttribute("aria-label", label);
    return frame;
}

// Opens and closes in a loop while it is on screen (open and still under reduced motion)
function loop(frame, { open = 2600, closed = 1500 } = {}) {
    if (still()) { frame.classList.add("is-open", "is-still"); return frame; }
    let on = false;
    const step = () => {
        if (!frame.isConnected) return; // replaced (another choice, another tab): the loop ends
        on = !on;
        frame.classList.toggle("is-open", on);
        setTimeout(step, on ? open : closed);
    };
    setTimeout(step, 700);
    return frame;
}

// The header's left side: the mark's square and the wordmark
const logo = () => h("span", "kalq-wire__logo", h("span", "kalq-wire__mark"), bar("34px", "is-word"));
// the sun/moon switch and the language letter, at the right of every header
const tools = () => [h("span", "kalq-wire__mode"), bar("8px", "is-lang")];
const dots = () => h("span", "kalq-wire__dots", h("i"), h("i"), h("i"), h("i"));
const panelsIcon = () => h("span", "kalq-wire__panels-icon", h("i", "is-top"), h("i"), h("i"), h("i"));
const twoLines = () => h("span", "kalq-wire__lines", h("i"), h("i"));
const links = (extra = "") => h("span", `kalq-wire__links ${extra}`, bar("22px", "is-current"), bar("30px", "is-mega-link"), bar("28px"));

// A page behind the header: a hero with its title, and some text below
const hero = () => h("div", "kalq-wire__hero", bar(46, "is-title"), bar(34, "is-title"), bar(28, "is-sub"));
const body = (rows = 3) => h("div", "kalq-wire__body", ...Array.from({ length: rows }, (_, i) => bar([82, 64, 74, 56][i % 4])));

//=================================== Menu ===================================//
export function menuPreview(style, label) {
    const head = h("div", "kalq-wire__head");
    const right = h("span", "kalq-wire__right");
    let open = null;
    if (style === "dropdown") {
        right.append(...tools(), dots());
        open = h("div", "kalq-wire__drop", ...[60, 74, 66].map((w, i) => h("span", `kalq-wire__drop-row${i === 0 ? " is-current" : ""}`, bar(w, "is-big"))));
    } else if (style === "panels") {
        right.append(...tools(), panelsIcon());
        open = h("div", "kalq-wire__panes", ...[1, 2, 3].map((n) => h("span", `kalq-wire__pane is-${n}`, h("span", `kalq-wire__pane-num${n === 1 ? " is-current" : ""}`), bar(56, "is-big"))));
    } else if (style === "overlay") {
        right.append(...tools(), twoLines());
        open = h("div", "kalq-wire__sheet", h("span", "kalq-wire__sheet-close"), ...[44, 58, 52].map((w, i) => bar(w, `is-huge${i === 0 ? " is-current" : ""}`)), pill("is-sheet"));
    } else {
        // the bar menus: links (in the middle for A, at the right for B and C), the button for A and C
        const centred = style === "minimal";
        if (centred) head.append(links("is-centred"));
        else right.append(links());
        if (style !== "plain") right.append(pill());
        right.append(...tools());
        if (style === "mega") {
            const thumbs = Array.from({ length: 6 }, () => h("span", "kalq-wire__item", h("span", "kalq-wire__thumb"), h("span", "kalq-wire__item-text", bar(70), bar(90, "is-faint"))));
            open = h("div", "kalq-wire__mega",
                h("span", "kalq-wire__feature", h("span", "kalq-wire__image"), bar(40, "is-big"), bar(84, "is-faint"), bar(66, "is-faint")),
                h("span", "kalq-wire__grid", ...thumbs));
        }
    }
    head.prepend(logo());
    head.append(right);
    const page = h("div", `kalq-wire__page is-menu-${style}`, hero(), body(2), open);
    page.prepend(head);
    const frame = browser(page, label);
    return open ? loop(frame) : frame;
}

//=================================== Footer ===================================//
export function footerPreview({ style, wordmark, gradient }, label) {
    let foot;
    if (style === "harbor") {
        const word = document.querySelector(".site-logo__word svg")?.cloneNode(true);
        word?.removeAttribute("class");
        foot = h("div", `kalq-wire__foot is-harbor${gradient ? " has-gradient" : ""}`,
            h("div", "kalq-wire__foot-cols",
                h("span", "kalq-wire__col", bar(62, "is-big"), bar(48, "is-faint"), bar(56, "is-link")),
                h("span", "kalq-wire__col", bar(40), bar(52), bar(46)),
                h("span", "kalq-wire__col is-social", h("span", "kalq-wire__circle"))),
            h("div", "kalq-wire__legal", bar(36, "is-faint")),
            wordmark ? h("div", "kalq-wire__wordmark", word || bar(100, "is-huge")) : null);
    } else {
        foot = h("div", "kalq-wire__foot is-classic",
            bar(52, "is-huge"), bar(40, "is-huge"), bar(46, "is-faint is-sub"),
            h("span", "kalq-wire__buttons", h("span", "kalq-wire__outline", bar(60)), h("span", "kalq-wire__outline", bar(64))),
            h("div", "kalq-wire__legal", bar(30, "is-faint")));
    }
    // the end of a page: a little of its text, then the footer
    const page = h("div", "kalq-wire__page is-footer", body(3), foot);
    return browser(page, label);
}

//=================================== Cookie bar ===================================//
export function cookiePreview(mode, label) {
    const icon = document.querySelector(".kalq-cookie__icon")?.cloneNode(true) || h("span", "kalq-wire__circle");
    icon.classList?.add("kalq-wire__cookie-icon");
    const actions = mode === "consent" ? h("span", "kalq-wire__cookie-actions", h("span", "kalq-wire__pill is-accept", bar("70%")), h("span", "kalq-wire__pill is-deny", bar("70%"))) : null;
    const pillBar = h("div", `kalq-wire__cookie is-${mode}${still() ? " is-still" : ""}`, icon, actions, bar("120px", "is-cookie-text"), h("span", "kalq-wire__cookie-line"));
    const page = h("div", "kalq-wire__page is-cookie", h("div", "kalq-wire__head", logo(), h("span", "kalq-wire__right", ...tools(), dots())), hero(), body(2), pillBar);
    return browser(page, label);
}
