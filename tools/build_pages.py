# Generates the HTML pages and js/strings.js. Run from anywhere: python3 tools/build_pages.py
# Translations live in i18n/strings.json; English text in the pages is tagged with data-i18n automatically.
import os, re, json
from html import escape
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRINGS = {k: v for k, v in json.load(open(f"{ROOT}/i18n/strings.json", encoding="utf-8")).items() if not k.startswith("_")}
wm = open(f"{ROOT}/assets/kalq-wordmark.svg").read().strip()
wm_paths = re.search(r'aria-label="KALQ">(.*)</svg>', wm).group(1)
wm_vb = re.search(r'viewBox="([^"]+)"', wm).group(1)

MARK = '<svg class="site-logo__mark" aria-hidden="true"></svg>'
WORD = f'<svg viewBox="{wm_vb}" fill="currentColor" aria-hidden="true">{wm_paths}</svg>'
HERO_WORD = f'<svg viewBox="{wm_vb}" fill="currentColor" role="img" aria-label="KALQ">{wm_paths}</svg>'

DESC = "Kalq turns a part's geometry into one technical truth and two separate commercial engines, for buyers and suppliers of manufactured parts."

LANGS = [("en", "E", "ENGLISH", "English"), ("de", "D", "DEUTSCH", "Deutsch")]
lang_items = "\n".join(
    f'''                <button type="button" class="lang__item" data-lang="{c}" lang="{c}" aria-label="{n}" aria-pressed="false">
                    <span class="lang__inner"><span class="lang__short"><span>{s}</span></span><span class="lang__full"><span>{f}</span></span></span>
                </button>''' for c, s, f, n in LANGS)

# The navigation for the bar, mega and overlay menus (style variant: menu). Kalq's two existing menus (the four dots
# and the panels) keep #site-menu below and never show this. Every link is a real link with its text; the second
# copy of each label (for the roll-up hover) is drawn by CSS, so the text is there once.
MODULE_KEYS = ["shouldCost", "supplierFit", "rfq", "machine", "mfgCost", "quote"]

def roll(key, en, kkey):
    # the label once; its rolling copy is drawn by CSS (::after, from data-label, kept in step by js/header.js)
    return f'<span class="site-roll" data-label="{en}"><span data-i18n="{key}" data-qs-key="{kkey}">{en}</span></span>'

def mega_html():
    # no stock pictures: each image is an empty slot showing the placeholder glyph until a Kalq picture is set
    items = "\n".join(
        f'''                        <li><a class="site-mega__item" href="platform.html"><span class="qs-media-slot site-mega__thumb" data-qs-key="site.nav.mega.{SLUGS[i]}.image" data-qs-type="image"></span><span><span class="site-mega__title" data-i18n="module.{k}" data-qs-key="site.nav.mega.{SLUGS[i]}.title">{MODULES[i][0]}</span><span class="site-mega__text" data-i18n="platform.{k}.lead" data-qs-key="site.nav.mega.{SLUGS[i]}.text">{MODULES[i][2]}</span></span></a></li>'''
        for i, k in enumerate(MODULE_KEYS))
    return f'''
                    <div class="site-mega" id="site-mega">
                        <a class="site-mega__card" href="platform.html"><span class="qs-media-slot site-mega__media" data-qs-key="site.nav.mega.card.image" data-qs-type="image"></span><span class="site-mega__card-title" data-i18n="nav.platform" data-qs-key="site.nav.mega.card.title">Platform</span><span class="site-mega__card-text" data-i18n="home.platformText" data-qs-key="site.nav.mega.card.text">A part enters as a STEP file and a drawing. Kalq turns it into features, process alternatives and a route on real machines.</span></a>
                        <ul class="site-mega__items">
{items}
                        </ul>
                    </div>'''

def nav_html(public=False):
    # the public legal pages (no gate) get the navigation without the mega panel: its copy stays behind the gate
    mega_attrs = "" if public else ' aria-haspopup="true" aria-expanded="false" aria-controls="site-mega"'
    return f'''        <nav class="site-nav" id="site-nav" aria-label="Main navigation" data-i18n-aria="aria.nav">
            <ul class="site-nav__links">
                <li><a class="site-nav__link" href="index.html">{roll("nav.home", "Home", "site.nav.home")}</a></li>
                <li class="site-nav__mega">
                    <a class="site-nav__link" href="platform.html"{mega_attrs}>{roll("nav.platform", "Platform", "site.nav.platform")}</a>
{"" if public else mega_html()}                </li>
                <li><a class="site-nav__link" href="company.html">{roll("nav.company", "Company", "site.nav.company")}</a></li>
            </ul>
            <a class="site-nav__cta qs-btn-round" href="mailto:office@kalq.ai?subject=Kalq%20pilot"><span class="qs-btn-round__text" data-i18n="nav.cta" data-qs-key="site.nav.cta">Start a pilot</span><span class="qs-btn-round__circle" aria-hidden="true"><span class="qs-btn-round__arrow"><svg viewBox="0 0 16 16" focusable="false"><path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="qs-btn-round__arrow is-next"><svg viewBox="0 0 16 16" focusable="false"><path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></a>
            <button type="button" class="site-nav__close" aria-label="Close menu" data-i18n-aria="aria.menuClose"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
        </nav>'''

ORG_JSONLD = json.dumps({
    "@context": "https://schema.org", "@type": "Organization", "name": "Kalq", "url": "https://www.kalq.ai",
    "logo": "https://www.kalq.ai/assets/logo.svg", "description": STRINGS["meta.description"]["de"],
    "email": "m.esser@kalq.ai",
    "parentOrganization": {"@type": "Organization", "name": "Kloepfel Engineering GmbH", "url": "https://www.kloepfel-engineering.com/",
        "address": {"@type": "PostalAddress", "streetAddress": "Pempelforterstraße 50", "postalCode": "40211", "addressLocality": "Düsseldorf", "addressCountry": "DE"},
        "parentOrganization": {"@type": "Organization", "name": "Kloepfel Group"}},
}, ensure_ascii=False).replace("</", "<\\/")

def head(title, public=False):
    return f'''<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <!-- Pages are German; hide translatable text until js/i18n.js has applied another stored language -->
    <script>try {{ var l = localStorage.getItem("qs-lang"); if (l && l !== "de") document.documentElement.classList.add("i18n-pending"); }} catch (e) {{ }}</script>
    <!-- Style variant: start in the last applied look (colours, fonts) before the first paint; js/variants.js takes over -->
    <script>try {{ document.documentElement.dataset.mode = localStorage.getItem("qs-mode") === "dark" ? "dark" : "light"; var v = JSON.parse(localStorage.getItem("qs-variant-look") || "null"); if (v && v.look && (v.mode || "light") === document.documentElement.dataset.mode) for (var k in v.look) if (/^--qs-[a-z-]+$/.test(k)) document.documentElement.style.setProperty(k, String(v.look[k]).replace(/[;{{}}<>]/g, "")); }} catch (e) {{ }}</script>
    <!-- Edited content: keyed blocks stay hidden until js/content.js applied it (1.5 s max, 3 s if scripts fail) -->
    <script>document.documentElement.classList.add("qs-loading"); setTimeout(function () {{ document.documentElement.classList.remove("qs-loading"); }}, 3000);</script>
    <meta name="description" content="{DESC}">
    <script type="application/ld+json">{ORG_JSONLD}</script>
    <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="./assets/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">
    <link rel="preload" href="./fonts/ClashGrotesk-Light.woff2" as="font" type="font/woff2" crossorigin>
    <!-- Every module the page script imports, fetched at once instead of one import level after the other -->
    <link rel="modulepreload" href="js/main.js">
    <link rel="modulepreload" href="js/header.js">
    <link rel="modulepreload" href="js/i18n.js">
    <link rel="modulepreload" href="js/strings-public.js">
    <link rel="modulepreload" href="js/blocks.js">
    <link rel="modulepreload" href="js/content.js">
    <link rel="modulepreload" href="js/variants.js">
    <link rel="modulepreload" href="lib/svg-sanitize.js">
    <link rel="modulepreload" href="js/logoAnimation.js">
    <link rel="modulepreload" href="js/expertiseHoverimg.js">
    <link rel="modulepreload" href="js/verticleLine.js">
    <link rel="modulepreload" href="js/heroTone.js">
    <link rel="modulepreload" href="js/heroReveal.js">
    <link rel="modulepreload" href="js/layout.js">
    <link rel="modulepreload" href="js/modules/registry.js">
    <link rel="modulepreload" href="js/moduleBehaviour.js">
    <link rel="modulepreload" href="js/collab.js">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- CSS -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/collab.css">
</head>

<body data-barba="wrapper">
    <!-- Kalq: under construction, a small glass pill floating over the page (css/_site.scss), taking no room -->
    <div class="kalq-construction" role="note"><span class="kalq-construction__dot" aria-hidden="true"></span><span class="kalq-construction__text">Under construction. Not launched yet.</span></div>
    <!-- Progress Bar -->
    <div class="progressBar"></div>

    <!-- Loader -->
    <div class="loader"></div>

    <!-- Header (outside the Barba container, persists across transitions) -->
    <header class="site-header">
        <a href="index.html" class="site-logo" aria-label="Kalq home" data-i18n-aria="aria.home">
            {MARK}
            <span class="site-logo__word"><span>{WORD}<span class="qs-wordmark" aria-hidden="true">KALQ</span></span></span>
        </a>
{nav_html(public)}
        <div class="site-header__right">
            <!-- Light and dark: a sun that morphs into a thin crescent moon (js/variants.js) -->
            <button type="button" class="mode-toggle" aria-pressed="false" aria-label="Dunkles Design">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <mask id="qs-moon-bite"><rect width="24" height="24" fill="#fff"/><circle class="mode-toggle__bite" cx="24" cy="2" r="7.4" fill="#000"/></mask>
                    <circle class="mode-toggle__core" cx="12" cy="12" r="4.4" fill="currentColor" mask="url(#qs-moon-bite)"/>
                    <g class="mode-toggle__rays" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                        <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5"/>
                    </g>
                </svg>
            </button>
            <div class="lang" data-lang-switcher role="group" aria-label="Language" data-i18n-aria="aria.language">
{lang_items}
            </div>
            <button type="button" class="site-menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu">
                <span class="dots" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
                <!-- Panel menu (style variant option): a bar the three panels drop out of, instead of the dots -->
                <!-- one connected block: a bar, and three graded bars that unfold beneath it touching it and each other -->
                <svg class="site-menu-toggle__panels" viewBox="0 0 24 24" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><g class="unit"><rect class="bar" x="4" y="10.25" width="16" height="3.5"/><rect class="drop drop-1" x="4" y="13.65" width="6.5" height="6.4"/><rect class="drop drop-2" x="10.4" y="13.65" width="5.4" height="4.9"/><rect class="drop drop-3" x="15.7" y="13.65" width="4.3" height="3.5"/></g></svg>
            </button>
            <!-- The bar navigations' menu button (phones; the overlay at every width): two lines -->
            <button type="button" class="site-nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu" data-i18n-aria="aria.menuOpen"><span aria-hidden="true"></span><span aria-hidden="true"></span></button>
        </div>
    </header>

    <!-- Menu dropdown (not a nav, not inside the blended header) -->
    <div class="site-menu" id="site-menu" aria-label="Main menu" data-i18n-aria="aria.menu">
        <a href="index.html">Home</a>
        <a href="platform.html">Platform</a>
        <a href="company.html">Company</a>
    </div>

    <!-- Image for platform hover list -->
    <div id="fixed-img"></div>

    <!---------- Content ---------->
    <div id="site-main">
        <div class="scrollbar-container" data-scrollbar style="overflow: hidden; height: 100vh;">
            <div id="main" data-barba="container">
'''

marquee = " ".join(["Follow Kalq ·"] * 60)
SOCIAL = f'''
                <!-- Social Section -->
                <section class="social">
                    <!-- marquee -->
                    <div class="marquee" aria-hidden="true">
                        <div class="track">
                            <h2 class="content fontLarge" data-i18n-marquee="social.marquee">&nbsp;{marquee}&nbsp;</h2>
                        </div>
                    </div>
                    <div id="container">
                        <p>Social Media and Contacts</p>
                    </div>
                    <div class="social_wrapper">
                        <a class="item" href="https://www.linkedin.com/company/kalq" target="_blank" rel="noopener">
                            <div class="overlay"></div>
                            <div id="container">
                                <h4>LinkedIn</h4>
                                <i class="fa-solid fa-arrow-right"></i>
                            </div>
                        </a>
                    </div>
                </section>
'''

# The library's footer (old/KALQ_MODULE_LIBRARY_SPEC.md 1.4), shown instead of the classic one when the style says so
# (html.footer-harbor). One <footer> either way: one contentinfo landmark. Empty lines (the address) render nothing.
LINKEDIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 9.5h3V19H5zM6.5 5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10.5 9.5h2.9v1.3h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6V19h-3v-4.6c0-1.1-.02-2.5-1.52-2.5-1.52 0-1.76 1.19-1.76 2.42V19h-3z" fill="currentColor"/></svg>'
# The footer's contacts row (Kalq): three real links (no phone: the number is only the chat's WhatsApp), every part an editable footer field. E-Mail opens a mail to the
# stored address; the address opens Google Maps in a new tab (a plain link: nothing loads from Google before the click);
# LinkedIn stays hidden until a LinkedIn address is filled in. js/kalq-site.js keeps the links' addresses in step with
# the fields; the address fields show only while editing. The full company details are in the Impressum.
# The company behind Kalq, one line in every footer style, linking to its website
KLOEPFEL_URL = "https://www.kloepfel-engineering.com/"
def parent_link(ns):
    return f'<a href="{KLOEPFEL_URL}" target="_blank" rel="noopener" data-i18n="footer.parent" data-qs-key="{ns}.parent">A Kloepfel Engineering GmbH company, Düsseldorf</a>'
# inside a bottom line (the classic footer's, which the "Pages and wordmark" footer copies): a line of its own
def parent_inline(ns):
    return f'<span class="kalq-parent kalq-parent--inline">{parent_link(ns)}</span>'
def parent_line(cls, ns):
    return f'<p class="{cls} kalq-parent"><a href="{KLOEPFEL_URL}" target="_blank" rel="noopener" data-i18n="footer.parent" data-qs-key="{ns}.parent">A Kloepfel Engineering GmbH company, Düsseldorf</a></p>'
MAIL_ICON = '<svg class="kalq-contact__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.75 6.5h16.5v11H3.75z M4.25 7l7.75 6.25L19.75 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
PIN_ICON = '<svg class="kalq-contact__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-6.25-6.1-6.25-11a6.25 6.25 0 0 1 12.5 0C18.25 14.9 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/></svg>'
MAPS = "https://www.google.com/maps/search/?api=1&amp;query=Pempelforterstra%C3%9Fe%2050%2C%2040211%20D%C3%BCsseldorf"
def contacts_row(cls, ns):
    li_icon = LINKEDIN.replace('<svg ', '<svg class="kalq-contact__icon" ', 1)
    return (f'<address class="{cls} kalq-contacts">'
        f'<a class="kalq-contact kalq-contact--email" href="mailto:m.esser@kalq.ai">{MAIL_ICON}<span data-i18n="footer.emailLabel" data-qs-key="{ns}.contact.emailLabel">Email</span><span class="kalq-contact__field" data-qs-key="{ns}.email" data-placeholder="name@kalq.ai">m.esser@kalq.ai</span></a>'
        f'<a class="kalq-contact kalq-contact--address" href="{MAPS}" target="_blank" rel="noopener">{PIN_ICON}<span class="qs-sr" data-i18n="footer.addressLabel" data-qs-key="{ns}.contact.addressLabel">Address</span><span class="qs-sr">: </span><span data-qs-key="{ns}.contact.address">Pempelforterstraße 50, 40211 Düsseldorf</span><span class="qs-sr"> </span><span class="qs-sr" data-i18n="footer.mapsHint" data-qs-key="{ns}.contact.mapsHint">(opens Google Maps in a new tab)</span></a>'
        f'<a class="kalq-contact kalq-contact--linkedin" target="_blank" rel="noopener" hidden>{li_icon}<span class="qs-sr" data-i18n="footer.linkedinLabel" data-qs-key="{ns}.contact.linkedinLabel">Kalq on LinkedIn</span><span class="kalq-contact__field" data-qs-key="{ns}.contact.linkedin" data-placeholder="https://www.linkedin.com/company/…"></span></a>'
        '</address>')
FOOTER_HARBOR = f'''                    <div class="footer-harbor">
                        <p class="footer-harbor__cta"><a href="mailto:office@kalq.ai?subject=Kalq%20pilot" data-i18n="footer.cta" data-qs-key="site.footer2.cta">Ready to prove it? Apply for the pilot.</a></p>
                        <div class="footer-harbor__top">
                            <div class="footer-harbor__contact">
                                <h2 class="footer-harbor__heading" data-i18n="footer.contactHeading" data-qs-key="site.footer2.heading">Contact</h2>
                                {contacts_row('footer-harbor__lines', 'site.footer2')}
                            </div>
                            <nav class="footer-harbor__nav" aria-label="Footer links" data-i18n-aria="aria.footerNav">
                                <ul>
                                    <li><a href="index.html"><span class="site-roll" data-label="Home"><span data-i18n="nav.home" data-qs-key="site.footer2.home">Home</span></span></a></li>
                                    <li><a href="platform.html"><span class="site-roll" data-label="Platform"><span data-i18n="nav.platform" data-qs-key="site.footer2.platform">Platform</span></span></a></li>
                                    <li><a href="company.html"><span class="site-roll" data-label="Company"><span data-i18n="nav.company" data-qs-key="site.footer2.company">Company</span></span></a></li>
                                </ul>
                            </nav>
                        </div>
                        <p class="footer-harbor__legal"><span>© <span data-current-year>2026</span> KALQ AI</span><span aria-hidden="true">·</span><a href="impressum.html" data-i18n="footer.impressum" data-qs-key="site.footer2.impressum">Legal notice</a><span aria-hidden="true">·</span><a href="datenschutz.html" data-i18n="footer.privacy" data-qs-key="site.footer2.privacy">Privacy</a></p>
                        {parent_line('footer-harbor__legal', 'site.footer2')}
                        <div class="footer-harbor__wordmark" aria-hidden="true">{WORD}</div>
                    </div>'''

# Tether's footer (the library, style variant: footer "tether"): the site's line large on the left, the pages and the
# legal links in two columns, the year and the rights below, the social links on the right
FOOTER_TETHER = f'''                    <div class="footer-tether">
                        <p class="footer-tether__tagline" data-i18n="footer.tagline" data-qs-key="site.footer3.tagline">One technical core. Two commercial engines.</p>
                        <nav class="footer-tether__nav" aria-label="Footer links" data-i18n-aria="aria.footerNav">
                            <div class="footer-tether__col">
                                <p class="footer-tether__label" data-i18n="footer.pages" data-qs-key="site.footer3.pages">Pages</p>
                                <ul>
                                    <li><a href="index.html" data-i18n="nav.home" data-qs-key="site.footer3.home">Home</a></li>
                                    <li><a href="platform.html" data-i18n="nav.platform" data-qs-key="site.footer3.platform">Platform</a></li>
                                    <li><a href="company.html" data-i18n="nav.company" data-qs-key="site.footer3.company">Company</a></li>
                                </ul>
                            </div>
                            <div class="footer-tether__col">
                                <p class="footer-tether__label" data-i18n="footer.legal" data-qs-key="site.footer3.legal">Legal</p>
                                <ul>
                                    <li><a href="impressum.html" data-i18n="footer.impressum" data-qs-key="site.footer3.impressum">Legal notice</a></li>
                                    <li><a href="datenschutz.html" data-i18n="footer.privacy" data-qs-key="site.footer3.privacy">Privacy</a></li>
                                </ul>
                            </div>
                        </nav>
                        <p class="footer-tether__legal"><span>© <span data-current-year>2026</span> KALQ AI.</span> <span data-i18n="footer.rights" data-qs-key="site.footer3.rights">All rights reserved.</span></p>
                        {parent_line('footer-tether__legal', 'site.footer3')}
                    </div>'''

# (Signal's "Message and wordmark" footer was removed in Q-Site 1.5; the engine strips its markup, so none is built)

FOOTER = '''
                <!-- Footer (classic): certil.com's, with Kalq's pages, entity and email, and the KALQ watermark -->
                <footer>
                    <div id="container">
                        <div class="footer_header">
                            {CONTACTS}
                            <nav class="footer_nav" aria-label="Footer links" data-i18n-aria="aria.footerNav">
                                <ul>
                                    <li><a href="index.html" data-i18n="nav.home" data-qs-key="site.footer.home">Home</a></li>
                                    <li><a href="platform.html" data-i18n="nav.platform" data-qs-key="site.footer.platform">Platform</a></li>
                                    <li><a href="company.html" data-i18n="nav.company" data-qs-key="site.footer.company">Company</a></li>
                                </ul>
                            </nav>
                        </div>
                        <div class="footer_bottom">
                            <p>
                                <span>© 2026 KALQ AI</span>
                                <span aria-hidden="true">·</span>
                                <a href="impressum.html" class="underLine_Link">Legal notice</a>
                                <span aria-hidden="true">·</span>
                                <a href="datenschutz.html" class="underLine_Link">Privacy</a>
                                {PARENT}
                            </p>
                        </div>
                        <div class="kalq-watermark" aria-hidden="true"><svg viewBox="{WM_VB}" fill="currentColor" focusable="false">{WM_PATHS}</svg></div>
                    </div>
'''.replace("{CONTACTS}", contacts_row("footer_facts", "site.footer")).replace("{PARENT}", parent_inline("site.footer")).replace("{WM_VB}", wm_vb).replace("{WM_PATHS}", wm_paths) + FOOTER_HARBOR + '''
''' + FOOTER_TETHER + '''

                </footer>
'''


# The bottom bar, "dontpanic" (js/dontpanic.js, css/components/_dontpanic.scss): notice or consent, as set in the design panel
# (site.cookie.* blocks; the server writes them in, api/page.js). The link to the Datenschutz sits beside the sentence, so an
# edited sentence (plain text) keeps it. Both modes' texts, in both languages, are in the
# HTML; the stylesheet shows the current mode's in the page's language. Outside the page container: a page change
# does not touch it.
DONTPANIC = '''    <!-- dontpanic bar: tell (shown once) or ask (until Accept or Deny); js/dontpanic.js -->
    <div class="dontpanic-bar" data-mode="tell" role="status" aria-live="polite" hidden>
        <svg class="dontpanic-bar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 0 9.4 10.9 3 3 0 0 1-3.6-3.4 3 3 0 0 1-3.4-3.6A3 3 0 0 1 12 2.5zM6.9 9.4a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0z M8.1 15.4a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0z M13.5 14.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z M15.5 17.6a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0-1.8 0z M11.6 6.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0-1.4 0z"/><circle cx="19.4" cy="4.4" r="0.9" fill="#fff"/><circle cx="21.7" cy="7.4" r="0.6" fill="#fff"/><circle cx="16.9" cy="2.4" r="0.55" fill="#fff"/></svg>
        <p class="dontpanic-bar__text" data-for="tell"><span lang="de">Kein Tracking, nur technisch notwendige Cookies.</span><span lang="en">No tracking, only essential cookies.</span></p>
        <a class="dontpanic-bar__link" href="datenschutz.html"><span lang="de">Datenschutz</span><span lang="en">Privacy notice</span></a>
        <p class="dontpanic-bar__text" data-for="ask"><span lang="de">Diese Seite möchte zusätzlich optionale Cookies verwenden. Sie entscheiden.</span><span lang="en">This site would like to use optional cookies as well. You decide.</span></p>
        <div class="dontpanic-bar__actions">
            <button type="button" class="dontpanic-bar__accept"><span lang="de">Akzeptieren</span><span lang="en">Accept</span></button>
            <button type="button" class="dontpanic-bar__deny"><span lang="de">Ablehnen</span><span lang="en">Deny</span></button>
        </div>
        <span class="dontpanic-bar__line" aria-hidden="true"></span>
    </div>
'''

TAIL = '''            </div>
        </div>
    </div>

''' + DONTPANIC + '''
    <!---------- SCRIPTS ---------->
    <!-- BARBA -->
    <script src="https://unpkg.com/@barba/core"></script>
    <!-- JQUERY -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <!-- GSAP -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/smooth-scrollbar/8.7.2/smooth-scrollbar.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
    <!-- CUSTOM -->
    <script src="js/main.js" type="module" defer></script>
    <!-- COLLABORATION: presence, cursors, toolbar -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
    <script src="js/collab.js" type="module"></script>
    <script src="js/dontpanic.js" type="module"></script>
    <!-- KALQ: its own additions on top of Q-Site (js/kalq-site.js) -->
    <script src="js/kalq-site.js" type="module"></script>
</body>

</html>
'''

# Placeholder images from the template. TODO: replace with Kalq imagery.
IMGS = [
    "https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=2070&auto=format&fit=crop",
    "https://plus.unsplash.com/premium_photo-1661914978519-52a11fe159a7?q=80&w=1935&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579412690850-bd41cd0af397?q=80&w=1965&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1641862039942-5815d8f74938?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1476365518243-f738bf58443d?q=80&w=1887&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1526413232644-8a40f03cc03b?q=80&w=1887&auto=format&fit=crop",
]

SLUGS = ["should-cost", "supplier-fit", "rfq-award", "machine-intelligence", "manufacturing-cost", "price-quote"]

MODULES = [
    ("Should Cost", "Buyer", "What the part should cost, built bottom up.",
     "Cost from geometry, material, process route and machine economics, so negotiations start from a number you can explain."),
    ("Supplier Fit", "Buyer", "Which suppliers can actually make it.",
     "Matching on real capabilities, machine parks and performance, not on catalogue categories."),
    ("RFQ &amp; Award", "Buyer", "Source, compare and award in one flow.",
     "Structured requests, comparable quotes and a documented decision, followed by realized savings."),
    ("Machine Intelligence", "Supplier", "Your machine park as a capability and cost graph.",
     "Capability, performance, economics, operations and evidence per machine, kept current as you work."),
    ("Manufacturing Cost", "Supplier", "What it costs you to make it, on your machines.",
     "Routing and cost on your own shop floor, in minutes instead of hours."),
    ("Price &amp; Quote", "Supplier", "From cost to a quote you can win and still earn on.",
     "Margin logic, pricing and quote output, with every result feeding back into better estimates."),
]

SKIP = ("title.", "meta.", "aria.", "social.marquee")

def to_html(text, fmt):
    """Line blocks: one line per \\n. Paragraph blocks: paragraphs split by a blank line."""
    if fmt == "paragraphs":
        return "".join("<p>" + "<br>".join(escape(l, quote=False) for l in para.split("\n")) + "</p>" for para in text.split("\n\n"))
    return "<br>".join(escape(l, quote=False) for l in text.split("\n"))

def localize(html, page, lang=None):
    """Swap tagged English text for the default language (formatted blocks become HTML)."""
    def fill(m):
        fmt = re.search(r'data-qs-format="(\w+)"', m.group(1))
        value = tr(m.group(3), lang or DEFAULT_LANG)
        return m.group(1) + (to_html(value, fmt.group(1)) if fmt else escape(value, quote=False)) + m.group(5)
    html = re.sub(r'(<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>)(.*?)(</\2>)', fill, html, flags=re.S)
    html = re.sub(r'(aria-label=")[^"]*(" data-i18n-aria="([^"]+)")', lambda m: m.group(1) + escape(tr(m.group(3))) + m.group(2), html)
    html = re.sub(r'(data-i18n-marquee="social.marquee">)[^<]*', lambda m: m.group(1) + "&nbsp;" + " ".join([escape(tr("social.marquee"), quote=False)] * 60) + "&nbsp;", html)
    # the roll-up copies of link labels (CSS ::after, data-label) in the page's language too
    html = re.sub(r'(<span class="site-roll" data-label=")[^"]*("><span data-i18n="([^"]+)")', lambda m: m.group(1) + escape(tr(m.group(3), lang or DEFAULT_LANG)) + m.group(2), html)
    html = re.sub(r"<title>[^<]*</title>", f"<title>{escape(tr('title.' + page), quote=False)}</title>", html)
    html = html.replace(f'content="{DESC}"', f'content="{escape(tr("meta.description"))}"')
    return html.replace('<html lang="en">', f'<html lang="{DEFAULT_LANG}">', 1)

DEFAULT_LANG = "de"  # pages are written in German, js/i18n.js switches at runtime

def tr(key, lang=DEFAULT_LANG):
    return STRINGS[key].get(lang, STRINGS[key]["en"])

def tag(html):
    """Add data-i18n="key" to every element whose whole text equals a key's English string."""
    for key, val in STRINGS.items():
        if key.startswith(SKIP):
            continue
        words = r"\s+".join(re.escape(w) for w in escape(val["en"], quote=False).split())
        pattern = re.compile(r"<(\w+)((?:(?!data-i18n)[^>])*)>(\s*" + words + r"\s*)</\1>")
        html = pattern.sub(lambda m: f'<{m.group(1)}{m.group(2)} data-i18n="{key}">{m.group(3)}</{m.group(1)}>', html)
    return html

# data-qs-key for every translated element: page.section.item. Keys must never change once shipped.
# Header, menu, social and footer are shared on every page ("site.*"), so one edit changes them everywhere.
MODULE_SLUGS = {"shouldCost": "should-cost", "supplierFit": "supplier-fit", "rfq": "rfq-award",
                "machine": "machine-intelligence", "mfgCost": "manufacturing-cost", "quote": "price-quote"}
FIXED_KEYS = {
    "nav.home": "site.menu.home", "nav.company": "site.menu.company", 
    "social.label": "site.social.label",
    "footer.sub": "site.footer.sub",
    "site.construction": "site.construction.text",
    "footer.pilot": "site.footer.pilot", "footer.impressum": "site.footer.impressum", "footer.privacy": "site.footer.privacy",
    "home.about": "home.about.text", "home.count1": "home.about.count1.label", "home.count2": "home.about.count2.label",
    "home.count3": "home.about.count3.label", "home.platformCta": "home.platform.cta", "home.platformText": "home.platform.text", "home.approach": "home.approach.title",
    "platform.header": "platform.header.title", "platform.introTitle": "platform.intro.title", "platform.intro": "platform.intro.text",
    "company.header": "company.header.title", "company.why": "company.why.title", "company.whyText": "company.why.text",
    "company.shared": "company.shared.title",
    "company.prices": "company.prices.title", "company.pricesText": "company.prices.text",
}

def assign_keys(html, page):
    side_count = {"platform.buyer": 0, "platform.supplier": 0}

    def key_for(tag_name, i18n):
        if i18n in FIXED_KEYS:
            return FIXED_KEYS[i18n]
        if i18n == "nav.platform":  # menu link, or the Platform heading on Home
            return "site.menu.platform" if tag_name == "a" else "home.platform.title"
        if i18n.startswith("module."):
            slug = MODULE_SLUGS[i18n.split(".")[1]]
            return f"home.platform.{slug}.title" if page == "home" else f"platform.cards.{slug}.title"
        if i18n in side_count:  # three buyer cards, then three supplier cards
            n = side_count[i18n]
            side_count[i18n] += 1
            return f"platform.cards.{SLUGS[n + (3 if i18n == 'platform.supplier' else 0)]}.side"
        if i18n.startswith("platform.") and i18n.count(".") == 2:
            _, mod, part = i18n.split(".")
            return f"platform.cards.{MODULE_SLUGS[mod]}.{'body' if part == 'text' else part}"
        raise KeyError(f"no data-qs-key rule for {i18n} on {page}")

    def add(m):
        if "data-qs-key" in m.group(0):
            return m.group(0)
        return m.group(0)[:-1] + f' data-qs-key="{key_for(m.group(1), m.group(2))}">'

    html = re.sub(r'<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>', add, html)
    return html.replace('data-i18n-marquee="social.marquee">', 'data-i18n-marquee="social.marquee" data-qs-key="site.social.marquee">')

def section_ids(html):
    """Every top-level section gets a stable id (its first class), the unit the page builder moves, copies and removes"""
    seen = set()
    def add(m):
        sid = re.sub(r"[^a-z0-9]+", "-", m.group(2).split()[0].lower()).strip("-")
        assert sid not in seen, f"two sections called {sid}"
        seen.add(sid)
        return f'{m.group(1)} data-section="{sid}" data-section-builtin'
    return re.sub(r'(<section class="([^"]+)")', add, html)


def write(name, html):
    page = name[:-5] if name != "index.html" else "home"
    html = section_ids(assign_keys(tag(html), page)).replace('data-barba="container">', f'data-barba="container" data-page="{page}">', 1)
    html = localize(html, page)
    open(f"{ROOT}/{name}", "w", encoding="utf-8").write(html)

# ---------------- Home ----------------
rows = "\n".join(f'''                        <div class="elem" data-image="{IMGS[i]}" data-qs-key="home.platform.{SLUGS[i]}.image" data-qs-type="image">
                            <div class="overlay"></div>
                            <div class="title">
                                <p>{i + 1:02d}</p>
                                <h4>{m[0]}</h4>
                            </div>
                        </div>''' for i, m in enumerate(MODULES))

home = head("Kalq | The decision layer for manufactured parts") + f'''                <!-- Hero -->
                <section class="header">
                    <!-- No autoplay or preload here: the 7 MB video would take the bandwidth the page scripts need; js/main.js starts it -->
                    <video class="hero_video" data-qs-key="home.hero.video" data-qs-type="video" muted loop playsinline preload="none" aria-hidden="true">
                        <source src="assets/video-hero-6mb-low.mp4" type="video/mp4">
                    </video>
                    <div class="hero_overlay"></div>
                    <!-- Title and moving bar blend only with each other (not with the video), so both stay pure white or black -->
                    <div class="hero_layer">
                    <div class="hero_content">
                        <!-- The outlined wordmark; with a style variant's own heading font the text version shows instead -->
                        <h1 class="hero_title">{HERO_WORD}<span class="qs-wordmark">KALQ</span></h1>
                        <!-- One block, one animated line per line break -->
                        <p class="hero_slogan" data-i18n="hero.slogan" data-qs-key="home.hero.slogan" data-qs-format="lines">One technical core. Two commercial engines.<br>Better industrial decisions.</p>
                    </div>
                    <div class="block"></div>
                    </div>
                </section>

                <!-- About -->
                <section class="about">
                    <div id="container">
                        <h5>
                            Kalq is the decision layer for manufactured parts. From a STEP file and a drawing, it builds
                            one technical truth about a part. That truth feeds two separate commercial engines: one for
                            the buyers who source the part, one for the suppliers who make it.
                        </h5>
                        <div class="numbering">
                            <div>
                                <h2 data-qs-key="home.about.count1.value">2</h2>
                                <p>Commercial engines</p>
                            </div>
                            <div>
                                <h2 data-qs-key="home.about.count2.value">3</h2>
                                <p>Price truths, never mixed</p>
                            </div>
                            <div>
                                <h2 data-qs-key="home.about.count3.value">8</h2>
                                <p>Platform modules</p>
                            </div>
                        </div>
                        <!-- A picture for the section (the magazine's About spread shows it too); nothing until one is set -->
                        <div class="qs-media-slot about_media" data-qs-key="home.about.media" data-qs-type="image"></div>
                    </div>
                </section>

                <!-- Platform -->
                <section class="expertise">
                    <div id="container">
                        <div class="title_heading">
                            <div class="title_text">
                                <h2>Platform</h2>
                                <p class="title_desc">A part enters as a STEP file and a drawing. Kalq turns it into features, process alternatives and a route on real machines.</p>
                            </div>
                            <a href="platform.html" class="btn">
                                <span>Explore the platform</span>
                            </a>
                        </div>
                    </div>

                    <!-- TODO: replace placeholder hover images -->
                    <div class="expertise_wrapper">
{rows}
                    </div>
                </section>

                <!-- Our approach -->
                <section class="Belief">
                    <div id="container">
                        <h2>Our approach</h2>
                        <div class="borderSeprator"></div>
                        <div>
                            <div class="qs-paras" data-i18n="home.approachText" data-qs-key="home.approach.text" data-qs-format="paragraphs"></div>
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("index.html", home)

# ---------------- Platform ----------------
def card(i, m):
    return f'''                                <div class="card">
                                    <div class="parallax_img">
                                        <img src="{IMGS[i]}" alt="" loading="lazy" width="auto" height="auto" data-qs-key="platform.cards.{SLUGS[i]}.image" data-qs-type="image">
                                    </div>
                                    <p class="tag"><span>{m[0]}</span> <span class="card_side">· {m[1]}</span></p>
                                    <h5>
                                        {m[2]}
                                    </h5>
                                    <p>
                                        {m[3]}
                                    </p>
                                </div>'''

platform = head("Kalq | Platform") + f'''                <!-- Header -->
                <section class="expertise_header">
                    <div class="hero_media" data-qs-key="platform.hero.media" data-qs-type="image"></div>
                    <div id="container">
                        <h2>
                            One technical core. Two commercial engines.
                        </h2>
                        <div class="block"></div>
                    </div>
                </section>

                <!-- Header img. TODO: replace placeholder image -->
                <section class="expertise_header_img">
                    <div class="parallax_img">
                        <img src="{IMGS[3]}" alt="" loading="lazy" width="auto" height="auto" data-qs-key="platform.header.image" data-qs-type="image">
                    </div>
                </section>

                <!-- Platform Container -->
                <section class="expertise_container">
                    <div id="container">
                        <!-- Text -->
                        <div class="txt">
                            <h3>
                                From geometry to a decision you can defend.
                            </h3>
                            <div class="borderSeprator"></div>
                            <div class="para">
                                <h5>
                                    A part enters as a STEP file and a drawing. Kalq turns it into features, process
                                    alternatives and a route on real machines. From there, two engines take over. One
                                    answers the buyer's questions. The other answers the supplier's.
                                </h5>
                            </div>
                        </div>

                        <!-- Cards: left column buyer engine, right column supplier engine. TODO: replace placeholder images -->
                        <div class="expertise_cards_container">
                            <div class="col">
{chr(10).join(card(i, MODULES[i]) for i in range(3))}
                            </div>
                            <div class="col">
{chr(10).join(card(i, MODULES[i]) for i in range(3, 6))}
                            </div>
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("platform.html", platform)

# ---------------- Company ----------------
company = head("Kalq | Company") + '''                <!-- Header -->
                <section class="about_header">
                    <div class="hero_media" data-qs-key="company.hero.media" data-qs-type="image"></div>
                    <div id="container">
                        <h2>
                            One part truth. Two commercial engines. Better industrial decisions.
                        </h2>
                        <div class="block"></div>
                    </div>
                </section>

                <!-- Header img. TODO: replace placeholder image -->
                <section class="about_header_img">
                    <div class="parallax_img">
                        <img src="assets/about/about_header.webp" alt="" loading="lazy" width="auto" height="auto" data-qs-key="company.header.image" data-qs-type="image">
                    </div>
                </section>

                <!-- Why Kalq exists -->
                <section class="about_goals">
                    <div id="container">
                        <h3>Why Kalq exists</h3>
                        <div class="borderSeprator"></div>
                        <h5>
                            Buyers negotiate with an incomplete picture of cost. Suppliers calculate under pressure with
                            knowledge that lives in a few heads. Both lose time, margin and trust on work the other side
                            has already done. Kalq exists to give both sides the same technical footing, while keeping
                            their business apart.
                        </h5>

                        <!-- TODO: replace placeholder images -->
                        <div class="img_wrapper">
                            <div class="parallax_img">
                                <img src="assets/about/goals1.avif" alt="" loading="lazy" width="auto" height="auto" data-qs-key="company.why.image1" data-qs-type="image">
                            </div>
                            <div class="parallax_img">
                                <img src="assets/about/goals2.jpg" alt="" loading="lazy" width="auto" height="auto" data-qs-key="company.why.image2" data-qs-type="image">
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Shared semantics, isolated economics -->
                <section class="about_weDo">
                    <div id="container">
                        <h3>
                            Shared semantics, isolated economics
                        </h3>
                        <div class="borderSeprator"></div>
                        <div class="para">
                            <div>
                                <div class="qs-paras" data-i18n="company.sharedText" data-qs-key="company.shared.text" data-qs-format="paragraphs"></div>
                            </div>
                        </div>

                        <!-- TODO: replace placeholder image -->
                        <div class="parallax_img">
                            <img src="assets/about/weDo.avif" alt="" loading="lazy" width="auto" height="auto" data-qs-key="company.shared.image" data-qs-type="image">
                        </div>
                    </div>
                </section>

                <!-- Three prices, kept apart -->
                <section class="about_awwards">
                    <div id="container">
                        <h3>
                            Three prices, kept apart
                        </h3>
                        <div class="borderSeprator"></div>
                        <div class="para">
                            <div>
                                <h5>
                                    Should Cost is what a part should cost. Quote Cost is what it costs a specific
                                    supplier to make. Market Price is what the market actually pays. Kalq shows all
                                    three side by side and never blends them into one number, because each answers a
                                    different question.
                                </h5>
                            </div>
                        </div>

                        <!-- TODO: replace placeholder image -->
                        <div class="parallax_img">
                            <img src="https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=2070&auto=format&fit=crop" alt="" loading="lazy" width="auto" height="auto" data-qs-key="company.prices.image" data-qs-type="image">
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("company.html", company)

# ---------------- Legal ----------------
impressum = head("Kalq | Legal notice", public=True) + '''                <!-- Impressum: Kloepfel Engineering GmbH, Pempelforterstraße 50, 40211 Düsseldorf (Kloepfel Group), a draft for legal review;
                     managing director(s), register and VAT ID "to be added" from kloepfel-engineering.com's Impressum; contact m.esser@kalq.ai (no phone: it is not on Kloepfel's own site either) -->
                <section class="legal">
                    <div id="container">
                        <h2 data-qs-key="impressum.header.title">Legal notice</h2>
                        <p class="legal_lead" data-qs-key="impressum.header.lead">Information pursuant to § 5 DDG</p>
                        <p class="legal_lead legal_draft" data-i18n="legal.draft" data-qs-key="impressum.draft.note"></p>

                        <div class="legal_block">
                            <h5 data-qs-key="impressum.provider.title">Provider</h5>
                            <p data-i18n="legal.address" data-qs-key="impressum.provider.address" data-qs-format="lines"></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-qs-key="impressum.representative.title">Represented by</h5>
                            <p data-i18n="legal.director" data-qs-key="impressum.representative.name"></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-qs-key="impressum.contact.title">Contact</h5>
                            <p><span data-qs-key="impressum.contact.label">Email:</span> <a href="mailto:m.esser@kalq.ai" data-qs-key="impressum.contact.email">m.esser@kalq.ai</a></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-qs-key="impressum.register.title">Register entry</h5>
                            <p data-i18n="legal.registerText" data-qs-key="impressum.register.text" data-qs-format="lines"></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-qs-key="impressum.vat.title">VAT ID</h5>
                            <p data-i18n="legal.vatText" data-qs-key="impressum.vat.text"></p>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("impressum.html", impressum)

datenschutz = head("Kalq | Privacy policy", public=True) + '''                <!-- Datenschutz: a draft for legal review (i18n/strings.json privacy.*), what the site really uses -->
                <section class="legal">
                    <div id="container">
                        <h2 data-qs-key="datenschutz.header.title">Privacy policy</h2>
                        <p class="legal_lead legal_draft" data-i18n="privacy.draft" data-qs-key="datenschutz.draft.note"></p>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.controller" data-qs-key="datenschutz.controller.title"></h5>
                            <div data-i18n="privacy.controllerText" data-qs-key="datenschutz.controller.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.overview" data-qs-key="datenschutz.overview.title"></h5>
                            <div data-i18n="privacy.overviewText" data-qs-key="datenschutz.overview.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.hosting" data-qs-key="datenschutz.hosting.title"></h5>
                            <div data-i18n="privacy.hostingText" data-qs-key="datenschutz.hosting.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.supabase" data-qs-key="datenschutz.supabase.title"></h5>
                            <div data-i18n="privacy.supabaseText" data-qs-key="datenschutz.supabase.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.login" data-qs-key="datenschutz.login.title"></h5>
                            <div data-i18n="privacy.loginText" data-qs-key="datenschutz.login.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.cookies" data-qs-key="datenschutz.cookies.title"></h5>
                            <div data-i18n="privacy.cookiesText" data-qs-key="datenschutz.cookies.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.chat" data-qs-key="datenschutz.chat.title"></h5>
                            <div data-i18n="privacy.chatText" data-qs-key="datenschutz.chat.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.thirdparty" data-qs-key="datenschutz.thirdparty.title"></h5>
                            <div data-i18n="privacy.thirdpartyText" data-qs-key="datenschutz.thirdparty.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.retention" data-qs-key="datenschutz.retention.title"></h5>
                            <div data-i18n="privacy.retentionText" data-qs-key="datenschutz.retention.text" data-qs-format="paragraphs"></div>
                        </div>
                        <div class="legal_block">
                            <h5 data-i18n="privacy.rights" data-qs-key="datenschutz.rights.title"></h5>
                            <div data-i18n="privacy.rightsText" data-qs-key="datenschutz.rights.text" data-qs-format="paragraphs"></div>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("datenschutz.html", datenschutz)
# ---------------- Gate (Q-Site's login card, see site.config.json "gate") ----------------
# Standalone: only files the middleware lets through without a cookie. Copy lives in the engine's js/gate.js (EN and DE);
# the subline is Kalq's hero slogan. Without a gate video of its own the card shows the home hero's video.
GATE_MARK = MARK.replace('class="site-logo__mark"', 'class="gate_mark"')
GATE_WORD = WORD.replace('aria-hidden="true"', 'role="img" aria-label="KALQ"')
GATE_SUN = '<svg class="gate_sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
GATE_MOON = '<svg class="gate_moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
GATE_SUBLINE = {lang: STRINGS["hero.slogan"][lang].replace("\n", " ") for lang in ("de", "en")}
cells = "\n".join(f'                        <input class="gate_cell" type="text" inputmode="text" maxlength="1" autocomplete="{"one-time-code" if i == 0 else "off"}" autocapitalize="characters" spellcheck="false" aria-label="Code {i + 1}/6">' for i in range(6))
gate_html = f"""<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Kalq</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/assets/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="stylesheet" href="/css/gate.css">
</head>

<body>
    <!-- Q-Site's login card: the home hero's video on top with the mark and KALQ top left, Anmeldung and Kalq's slogan
         bottom left, the sun and moon top right; the code, Google and LinkedIn below -->
    <main class="gate" data-theme="dark">
        <div class="gate_card">
            <div class="gate_media">
                <video class="gate_video" muted loop playsinline autoplay preload="metadata" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1" hidden></video>
                <div class="gate_brand">{GATE_MARK}<span class="gate_word">{GATE_WORD}</span></div>
                <div class="gate_heading">
                    <h1 class="gate_title" data-gate-text="title">Anmeldung</h1>
                    <p class="gate_subline"><span lang="de">{escape(GATE_SUBLINE["de"])}</span><span lang="en">{escape(GATE_SUBLINE["en"])}</span></p>
                </div>
                <button type="button" class="gate_theme" aria-label="Helles Farbschema">{GATE_SUN}{GATE_MOON}</button>
            </div>

            <div class="gate_body">
                <form class="gate_form" novalidate>
                    <p class="gate_label" data-gate-text="label">Zugangscode</p>
                    <div class="gate_cells">
{cells}
                    </div>
                    <p class="gate_message" role="alert" aria-live="polite"></p>
                    <hr class="gate_line">
                    <button type="submit" class="gate_submit" data-gate-text="submit">Anmelden</button>
                </form>

                <div class="gate_or"><span data-gate-text="or">oder</span></div>

                <div class="gate_logins">
                    <button type="button" class="gate_login" data-provider="google">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
                        <span data-gate-text="google">Weiter mit Google</span>
                    </button>
                    <button type="button" class="gate_login" data-provider="linkedin_oidc">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0A66C2" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm1.8 13.1H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>
                        <span data-gate-text="linkedin">Weiter mit LinkedIn</span>
                    </button>
                </div>
            </div>
        </div>
        <p class="gate_footer">
            <a href="/impressum.html" data-gate-text="impressum">Impressum</a>
            <span aria-hidden="true">·</span>
            <a href="/datenschutz.html" data-gate-text="privacy">Datenschutz</a>
        </p>
    </main>

{DONTPANIC}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
    <script src="/js/gate.js" type="module"></script>
    <script src="/js/dontpanic.js" type="module"></script>
</body>

</html>
"""
open(f"{ROOT}/gate.html", "w", encoding="utf-8").write(gate_html)

# Block keys: unique per page, page.* keys only on their own page
for n in ["index.html", "platform.html", "company.html", "impressum.html", "datenschutz.html"]:
    keys = re.findall(r'data-qs-key="([^"]+)"', open(f"{ROOT}/{n}", encoding="utf-8").read())
    dupes = {k for k in keys if keys.count(k) > 1}
    assert not dupes, f"duplicate keys on {n}: {dupes}"
    page = n[:-5] if n != "index.html" else "home"
    foreign = [k for k in keys if k.split(".")[0] not in (page, "site")]
    assert not foreign, f"keys of another page on {n}: {foreign}"

# Every translatable key must appear in some page
pages = "".join(open(f"{ROOT}/{n}", encoding="utf-8").read() for n in ["index.html", "platform.html", "company.html", "impressum.html", "datenschutz.html"])
missing = [k for k in STRINGS if not k.startswith(SKIP) and f'data-i18n="{k}"' not in pages]
assert not missing, f"untagged keys: {missing}"

# Copy used by the public legal pages goes to strings-public.js (served without the gate cookie),
# everything else to strings.js, which stays behind the gate.
legal = "".join(open(f"{ROOT}/{n}", encoding="utf-8").read() for n in ["impressum.html", "datenschutz.html"])
public_keys = {k for k in STRINGS if f'"{k}"' in legal} | {"title.impressum", "title.datenschutz", "meta.description", "aria.menuOpen", "aria.menuClose"}
for name, keys in (("strings-public.js", public_keys), ("strings.js", set(STRINGS) - public_keys)):
    with open(f"{ROOT}/js/{name}", "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_pages.py from i18n/strings.json. Do not edit by hand.\n")
        f.write("export const STRINGS = " + json.dumps({k: STRINGS[k] for k in STRINGS if k in keys}, ensure_ascii=False, indent=4) + ";\n")
print("ok")
