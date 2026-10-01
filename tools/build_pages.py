# Generates the HTML pages and js/strings.js. Run from anywhere: python3 tools/build_pages.py
# Translations live in i18n/strings.json; English text in the pages is tagged with data-i18n automatically.
import os, re, json
from html import escape
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRINGS = {k: v for k, v in json.load(open(f"{ROOT}/i18n/strings.json", encoding="utf-8")).items() if not k.startswith("_")}
wm = open(f"{ROOT}/assets/kalq-wordmark.svg").read().strip()
wm_paths = re.search(r'aria-label="KALQ">(.*)</svg>', wm).group(1)
wm_vb = re.search(r'viewBox="([^"]+)"', wm).group(1)

MARK = '<svg class="site-logo__mark" viewBox="0 0 174 174" fill="none" stroke="currentColor" stroke-width="7.38" aria-hidden="true"><line data-ray="e" x1="101.81" y1="86.99" x2="173.98" y2="86.99"/><line data-ray="w" x1="72.16" y1="87.01" x2="0" y2="87.01"/><line data-ray="s" x1="87.01" y1="101.84" x2="87.01" y2="174"/><line data-ray="n" x1="87.01" y1="72.16" x2="87.01" y2="0"/><line data-ray="se" x1="84.26" y1="84.26" x2="135.29" y2="135.29"/><line data-ray="ne" x1="99.04" y1="75.62" x2="132.83" y2="41.82"/><line data-ray="sw" x1="74.64" y1="99.7" x2="40.85" y2="133.49"/><line data-ray="nw" x1="74.62" y1="74.31" x2="40.83" y2="40.51"/></svg>'
WORD = f'<svg viewBox="{wm_vb}" fill="currentColor" aria-hidden="true">{wm_paths}</svg>'
HERO_WORD = f'<svg viewBox="{wm_vb}" fill="currentColor" role="img" aria-label="KALQ">{wm_paths}</svg>'

DESC = "Kalq turns a part's geometry into one technical truth and two separate commercial engines, for buyers and suppliers of manufactured parts."

LANGS = [("en", "E", "ENGLISH", "English"), ("de", "D", "DEUTSCH", "Deutsch")]
lang_items = "\n".join(
    f'''                <button type="button" class="lang__item" data-lang="{c}" lang="{c}" aria-label="{n}" aria-pressed="false">
                    <span class="lang__inner"><span class="lang__short"><span>{s}</span></span><span class="lang__full"><span>{f}</span></span></span>
                </button>''' for c, s, f, n in LANGS)

def head(title):
    return f'''<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <!-- Pages are German; hide translatable text until js/i18n.js has applied another stored language -->
    <script>try {{ var l = localStorage.getItem("kalq-lang"); if (l && l !== "de") document.documentElement.classList.add("i18n-pending"); }} catch (e) {{ }}</script>
    <!-- Style variant: start in the last applied look (colours, fonts) before the first paint; js/variants.js takes over -->
    <script>try {{ document.documentElement.dataset.mode = localStorage.getItem("kalq-mode") === "dark" ? "dark" : "light"; var v = JSON.parse(localStorage.getItem("kalq-variant-look") || "null"); if (v && v.look && (v.mode || "light") === document.documentElement.dataset.mode) for (var k in v.look) if (/^--kalq-[a-z-]+$/.test(k)) document.documentElement.style.setProperty(k, String(v.look[k]).replace(/[;{{}}<>]/g, "")); }} catch (e) {{ }}</script>
    <!-- Edited content: keyed blocks stay hidden until js/content.js applied it (1.5 s max, 3 s if scripts fail) -->
    <script>document.documentElement.classList.add("kalq-loading"); setTimeout(function () {{ document.documentElement.classList.remove("kalq-loading"); }}, 3000);</script>
    <meta name="description" content="{DESC}">
    <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="./assets/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">
    <link rel="preload" href="./fonts/ClashGrotesk-Light.woff2" as="font" type="font/woff2" crossorigin>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- CSS -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/collab.css">
</head>

<body data-barba="wrapper">
    <!-- Progress Bar -->
    <div class="progressBar"></div>

    <!-- Loader -->
    <div class="loader"></div>

    <!-- Header (outside the Barba container, persists across transitions) -->
    <header class="site-header">
        <a href="index.html" class="site-logo" aria-label="Kalq home" data-i18n-aria="aria.home">
            {MARK}
            <span class="site-logo__word"><span>{WORD}</span></span>
        </a>
        <div class="site-header__right">
            <!-- Light and dark: a sun that morphs into a thin crescent moon (js/variants.js) -->
            <button type="button" class="mode-toggle" aria-pressed="false" aria-label="Dunkles Design">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <mask id="kalq-moon-bite"><rect width="24" height="24" fill="#fff"/><circle class="mode-toggle__bite" cx="24" cy="2" r="7.4" fill="#000"/></mask>
                    <circle class="mode-toggle__core" cx="12" cy="12" r="4.4" fill="currentColor" mask="url(#kalq-moon-bite)"/>
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
            </button>
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

FOOTER = '''
                <!-- Footer -->
                <footer>
                    <div id="container">
                        <div class="footer_header">
                            <div class="footer_heading">
                                <h2 data-i18n="footer.heading" data-kalq-key="site.footer.heading" data-kalq-format="lines">Prove it on<br>real parts</h2>
                            </div>
                            <p class="footer_sub">
                                We are starting with CNC turned parts in Germany. If you buy or make them, apply for the
                                pilot.
                            </p>
                            <div class="footer_btns_wrapper">
                                <a href="mailto:office@kalq.ai" class="btn">
                                    <span data-kalq-key="site.footer.email">office@kalq.ai</span>
                                </a>
                                <a href="mailto:office@kalq.ai?subject=Kalq%20pilot" class="btn">
                                    <span>Apply for the pilot</span>
                                </a>
                            </div>
                        </div>
                        <div class="footer_bottom">
                            <p>
                                <span>© 2026 Kalq</span>
                                <span aria-hidden="true">·</span>
                                <a href="impressum.html" class="underLine_Link">Legal notice</a>
                                <span aria-hidden="true">·</span>
                                <a href="datenschutz.html" class="underLine_Link">Privacy</a>
                            </p>
                        </div>
                    </div>
                </footer>
'''

TAIL = '''            </div>
        </div>
    </div>

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
        fmt = re.search(r'data-kalq-format="(\w+)"', m.group(1))
        value = tr(m.group(3), lang or DEFAULT_LANG)
        return m.group(1) + (to_html(value, fmt.group(1)) if fmt else escape(value, quote=False)) + m.group(5)
    html = re.sub(r'(<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>)(.*?)(</\2>)', fill, html, flags=re.S)
    html = re.sub(r'(aria-label=")[^"]*(" data-i18n-aria="([^"]+)")', lambda m: m.group(1) + escape(tr(m.group(3))) + m.group(2), html)
    html = re.sub(r'(data-i18n-marquee="social.marquee">)[^<]*', lambda m: m.group(1) + "&nbsp;" + " ".join([escape(tr("social.marquee"), quote=False)] * 60) + "&nbsp;", html)
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

# data-kalq-key for every translated element: page.section.item. Keys must never change once shipped.
# Header, menu, social and footer are shared on every page ("site.*"), so one edit changes them everywhere.
MODULE_SLUGS = {"shouldCost": "should-cost", "supplierFit": "supplier-fit", "rfq": "rfq-award",
                "machine": "machine-intelligence", "mfgCost": "manufacturing-cost", "quote": "price-quote"}
FIXED_KEYS = {
    "nav.home": "site.menu.home", "nav.company": "site.menu.company",
    "social.label": "site.social.label",
    "footer.sub": "site.footer.sub",
    "footer.pilot": "site.footer.pilot", "footer.impressum": "site.footer.impressum", "footer.privacy": "site.footer.privacy",
    "home.about": "home.about.text", "home.count1": "home.about.count1.label", "home.count2": "home.about.count2.label",
    "home.count3": "home.about.count3.label", "home.platformCta": "home.platform.cta", "home.approach": "home.approach.title",
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
        raise KeyError(f"no data-kalq-key rule for {i18n} on {page}")

    def add(m):
        if "data-kalq-key" in m.group(0):
            return m.group(0)
        return m.group(0)[:-1] + f' data-kalq-key="{key_for(m.group(1), m.group(2))}">'

    html = re.sub(r'<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>', add, html)
    return html.replace('data-i18n-marquee="social.marquee">', 'data-i18n-marquee="social.marquee" data-kalq-key="site.social.marquee">')

def write(name, html):
    page = name[:-5] if name != "index.html" else "home"
    html = assign_keys(tag(html), page).replace('data-barba="container">', f'data-barba="container" data-page="{page}">', 1)
    html = localize(html, page)
    open(f"{ROOT}/{name}", "w", encoding="utf-8").write(html)

# ---------------- Home ----------------
rows = "\n".join(f'''                        <div class="elem" data-image="{IMGS[i]}" data-kalq-key="home.platform.{SLUGS[i]}.image" data-kalq-type="image">
                            <div class="overlay"></div>
                            <div class="title">
                                <p>{i + 1:02d}</p>
                                <h4>{m[0]}</h4>
                            </div>
                        </div>''' for i, m in enumerate(MODULES))

home = head("Kalq | The decision layer for manufactured parts") + f'''                <!-- Hero -->
                <section class="header">
                    <video class="hero_video" data-kalq-key="home.hero.video" data-kalq-type="video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
                        <source src="assets/video-hero-6mb-low.mp4" type="video/mp4">
                    </video>
                    <div class="hero_overlay"></div>
                    <div class="hero_content">
                        <h1 class="hero_title">{HERO_WORD}</h1>
                        <!-- One block, one animated line per line break -->
                        <p class="hero_slogan" data-i18n="hero.slogan" data-kalq-key="home.hero.slogan" data-kalq-format="lines">One technical core. Two commercial engines.<br>Better industrial decisions.</p>
                    </div>
                    <div class="block"></div>
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
                                <h2 data-kalq-key="home.about.count1.value">2</h2>
                                <p>Commercial engines</p>
                            </div>
                            <div>
                                <h2 data-kalq-key="home.about.count2.value">3</h2>
                                <p>Price truths, never mixed</p>
                            </div>
                            <div>
                                <h2 data-kalq-key="home.about.count3.value">8</h2>
                                <p>Platform modules</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Platform -->
                <section class="expertise">
                    <div id="container">
                        <div class="title_heading">
                            <h2>Platform</h2>
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
                            <div class="kalq-paras" data-i18n="home.approachText" data-kalq-key="home.approach.text" data-kalq-format="paragraphs"></div>
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("index.html", home)

# ---------------- Platform ----------------
def card(i, m):
    return f'''                                <div class="card">
                                    <div class="parallax_img">
                                        <img src="{IMGS[i]}" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="platform.cards.{SLUGS[i]}.image" data-kalq-type="image">
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
                    <div class="hero_media" data-kalq-key="platform.hero.media" data-kalq-type="image"></div>
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
                        <img src="{IMGS[3]}" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="platform.header.image" data-kalq-type="image">
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
                    <div class="hero_media" data-kalq-key="company.hero.media" data-kalq-type="image"></div>
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
                        <img src="assets/about/about_header.webp" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="company.header.image" data-kalq-type="image">
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
                                <img src="assets/about/goals1.avif" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="company.why.image1" data-kalq-type="image">
                            </div>
                            <div class="parallax_img">
                                <img src="assets/about/goals2.jpg" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="company.why.image2" data-kalq-type="image">
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
                                <div class="kalq-paras" data-i18n="company.sharedText" data-kalq-key="company.shared.text" data-kalq-format="paragraphs"></div>
                            </div>
                        </div>

                        <!-- TODO: replace placeholder image -->
                        <div class="parallax_img">
                            <img src="assets/about/weDo.avif" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="company.shared.image" data-kalq-type="image">
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
                            <img src="https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=2070&auto=format&fit=crop" alt="" loading="lazy" width="auto" height="auto" data-kalq-key="company.prices.image" data-kalq-type="image">
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("company.html", company)

# ---------------- Legal ----------------
impressum = head("Kalq | Legal notice") + '''                <!-- Impressum. TODO: fill in company data -->
                <section class="legal">
                    <div id="container">
                        <h2 data-kalq-key="impressum.header.title">Legal notice</h2>
                        <p class="legal_lead" data-kalq-key="impressum.header.lead">Information pursuant to § 5 DDG</p>

                        <div class="legal_block">
                            <h5 data-kalq-key="impressum.provider.title">Provider</h5>
                            <p data-i18n="legal.address" data-kalq-key="impressum.provider.address" data-kalq-format="lines"></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-kalq-key="impressum.representative.title">Represented by</h5>
                            <p data-kalq-key="impressum.representative.name">[TODO: Managing director]</p>
                        </div>

                        <div class="legal_block">
                            <h5 data-kalq-key="impressum.contact.title">Contact</h5>
                            <p><span data-kalq-key="impressum.contact.label">Email:</span> <a href="mailto:office@kalq.ai" data-kalq-key="impressum.contact.email">office@kalq.ai</a></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-kalq-key="impressum.register.title">Register entry</h5>
                            <p data-i18n="legal.registerText" data-kalq-key="impressum.register.text" data-kalq-format="lines"></p>
                        </div>

                        <div class="legal_block">
                            <h5 data-kalq-key="impressum.vat.title">VAT ID</h5>
                            <p data-kalq-key="impressum.vat.text">VAT identification number pursuant to § 27a of the German VAT Act: [TODO]</p>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("impressum.html", impressum)

datenschutz = head("Kalq | Privacy policy") + '''                <!-- Datenschutz. TODO: insert privacy policy -->
                <section class="legal">
                    <div id="container">
                        <h2 data-kalq-key="datenschutz.header.title">Privacy policy</h2>
                        <div class="legal_block">
                            <p data-kalq-key="datenschutz.body.text">[TODO: insert privacy policy]</p>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("datenschutz.html", datenschutz)
# ---------------- Gate (temporary, see middleware.js) ----------------
# Standalone: only files the middleware lets through without a cookie. Copy lives in js/gate.js (EN and DE).
GATE_MARK = MARK.replace('class="site-logo__mark"', 'class="gate_mark"')
cells = "\n".join(f'                    <input class="gate_cell" type="text" inputmode="text" maxlength="1" autocomplete="{"one-time-code" if i == 0 else "off"}" autocapitalize="characters" spellcheck="false" aria-label="Code {i + 1}/6">' for i in range(6))
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
    <main class="gate">
        <div class="gate_card">
            <div class="gate_logo">
                <!-- One layer per published style variant, crossfading every second (js/gate.js) -->
                <div class="gate_logo__stack"><div class="gate_logo__layer is-active" data-variant="default">{GATE_MARK}</div></div>
                <span class="gate_word">{WORD}</span>
            </div>

            <form class="gate_form" novalidate>
                <p class="gate_label" data-gate-text="label">Zugangscode</p>
                <div class="gate_cells">
{cells}
                </div>
                <p class="gate_message" role="alert" aria-live="polite"></p>
            </form>

            <div class="gate_or"><span data-gate-text="or">oder</span></div>

            <div class="gate_logins">
                <button type="button" class="gate_login" data-provider="google">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.42-1.66 4.17-5.35 4.17-3.22 0-5.85-2.67-5.85-5.95S8.78 6.35 12 6.35c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.78 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"/></svg>
                    <span data-gate-text="google">Weiter mit Google</span>
                </button>
                <button type="button" class="gate_login" data-provider="linkedin_oidc">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/></svg>
                    <span data-gate-text="linkedin">Weiter mit LinkedIn</span>
                </button>
            </div>
        </div>
        <p class="gate_footer">
            <a href="/impressum.html" data-gate-text="impressum">Impressum</a>
            <span aria-hidden="true">·</span>
            <a href="/datenschutz.html" data-gate-text="privacy">Datenschutz</a>
        </p>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
    <script src="/js/gate.js" type="module"></script>
</body>

</html>
"""
open(f"{ROOT}/gate.html", "w", encoding="utf-8").write(gate_html)

# Block keys: unique per page, page.* keys only on their own page
for n in ["index.html", "platform.html", "company.html", "impressum.html", "datenschutz.html"]:
    keys = re.findall(r'data-kalq-key="([^"]+)"', open(f"{ROOT}/{n}", encoding="utf-8").read())
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
