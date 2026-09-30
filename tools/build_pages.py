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

LANGS = [("en", "E", "ENGLISH", "English"), ("de", "D", "DEUTSCH", "Deutsch"), ("fr", "F", "FRANÇAIS", "Français"),
         ("es", "S", "ESPAÑOL", "Español"), ("it", "I", "ITALIANO", "Italiano"), ("pl", "P", "POLSKI", "Polski")]
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
    <meta name="description" content="{DESC}">
    <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="./assets/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">
    <link rel="preload" href="./fonts/ClashGrotesk-Light.woff2" as="font" type="font/woff2" crossorigin>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- CSS -->
    <link rel="stylesheet" href="css/main.css">
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
                                <h2>Prove it on</h2>
                                <h2>real parts</h2>
                            </div>
                            <p class="footer_sub">
                                We are starting with CNC turned parts in Germany. If you buy or make them, apply for the
                                pilot.
                            </p>
                            <div class="footer_btns_wrapper">
                                <a href="mailto:office@kalq.ai" class="btn">
                                    <span>office@kalq.ai</span>
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

def localize(html, page):
    """Swap tagged English text for the default language."""
    html = re.sub(r'(<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>)(.*?)(</\2>)',
                  lambda m: m.group(1) + escape(tr(m.group(3)), quote=False) + m.group(5), html, flags=re.S)
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

def write(name, html):
    page = name[:-5] if name != "index.html" else "home"
    html = tag(html).replace('data-barba="container">', f'data-barba="container" data-page="{page}">', 1)
    html = localize(html, page)
    open(f"{ROOT}/{name}", "w", encoding="utf-8").write(html)

# ---------------- Home ----------------
rows = "\n".join(f'''                        <div class="elem" data-image="{IMGS[i]}">
                            <div class="overlay"></div>
                            <div class="title">
                                <p>{i + 1:02d}</p>
                                <h4>{m[0]}</h4>
                            </div>
                        </div>''' for i, m in enumerate(MODULES))

home = head("Kalq | The decision layer for manufactured parts") + f'''                <!-- Hero -->
                <section class="header">
                    <video class="hero_video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
                        <source src="assets/video-hero-6mb-low.mp4" type="video/mp4">
                    </video>
                    <div class="hero_overlay"></div>
                    <div class="hero_content">
                        <h1 class="hero_title">{HERO_WORD}</h1>
                        <p class="hero_slogan">
                            <span>One technical core.</span> <br class="mobile_br"><span>Two commercial engines.</span><br>
                            <span>Better industrial decisions.</span>
                        </p>
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
                                <h2>2</h2>
                                <p>Commercial engines</p>
                            </div>
                            <div>
                                <h2>3</h2>
                                <p>Price truths, never mixed</p>
                            </div>
                            <div>
                                <h2>8</h2>
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
                            <h5>
                                Every manufactured part is priced twice. The buyer estimates what it should cost. The
                                supplier works out what it will cost to make. Both start from the same drawing, and both
                                rebuild the same technical understanding from scratch, by hand, under time pressure.
                            </h5>
                            <h5>
                                Kalq does that work once. It reads the geometry, derives features and process routes, and
                                matches them to real machines and their economics. Buyers and suppliers share the
                                technical truth. Their commercial data stays sealed from each other. Compared, never
                                mixed.
                            </h5>
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("index.html", home)

# ---------------- Platform ----------------
def card(i, m):
    return f'''                                <div class="card">
                                    <div class="parallax_img">
                                        <img src="{IMGS[i]}" alt="" loading="lazy" width="auto" height="auto">
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
                        <img src="{IMGS[3]}" alt="" loading="lazy" width="auto" height="auto">
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
                        <img src="assets/about/about_header.webp" alt="" loading="lazy" width="auto" height="auto">
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
                                <img src="assets/about/goals1.avif" alt="" loading="lazy" width="auto" height="auto">
                            </div>
                            <div class="parallax_img">
                                <img src="assets/about/goals2.jpg" alt="" loading="lazy" width="auto" height="auto">
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
                                <h5>
                                    Buyers and suppliers use the same understanding of a part. Nothing else crosses over.
                                    Each tenant's prices, margins and machine data stay in their own space, used only for
                                    the purpose they were given for.
                                </h5>
                                <h5>
                                    Data is hosted in the EU. Every automated result can be reviewed and overruled by a
                                    person. And Kalq stays neutral: it does not sell parts, and it does not take a side in
                                    the deal.
                                </h5>
                            </div>
                        </div>

                        <!-- TODO: replace placeholder image -->
                        <div class="parallax_img">
                            <img src="assets/about/weDo.avif" alt="" loading="lazy" width="auto" height="auto">
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
                            <img src="https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=2070&auto=format&fit=crop" alt="" loading="lazy" width="auto" height="auto">
                        </div>
                    </div>
                </section>
''' + SOCIAL + FOOTER + TAIL
write("company.html", company)

# ---------------- Legal ----------------
impressum = head("Kalq | Legal notice") + '''                <!-- Impressum. TODO: fill in company data -->
                <section class="legal">
                    <div id="container">
                        <h2>Legal notice</h2>
                        <p class="legal_lead">Information pursuant to § 5 DDG</p>

                        <div class="legal_block">
                            <h5>Provider</h5>
                            <p>
                                <span>[TODO: Company name]</span><br>
                                <span>[TODO: Street and number]</span><br>
                                <span>[TODO: Postcode and city]</span><br>
                                <span>[TODO: Country]</span>
                            </p>
                        </div>

                        <div class="legal_block">
                            <h5>Represented by</h5>
                            <p>[TODO: Managing director]</p>
                        </div>

                        <div class="legal_block">
                            <h5>Contact</h5>
                            <p><span>Email:</span> <a href="mailto:office@kalq.ai">office@kalq.ai</a></p>
                        </div>

                        <div class="legal_block">
                            <h5>Register entry</h5>
                            <p>
                                <span>Register court: [TODO]</span><br>
                                <span>Register number: [TODO]</span>
                            </p>
                        </div>

                        <div class="legal_block">
                            <h5>VAT ID</h5>
                            <p>VAT identification number pursuant to § 27a of the German VAT Act: [TODO]</p>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("impressum.html", impressum)

datenschutz = head("Kalq | Privacy policy") + '''                <!-- Datenschutz. TODO: insert privacy policy -->
                <section class="legal">
                    <div id="container">
                        <h2>Privacy policy</h2>
                        <div class="legal_block">
                            <p>[TODO: insert privacy policy]</p>
                        </div>
                    </div>
                </section>
''' + FOOTER + TAIL
write("datenschutz.html", datenschutz)
# Every translatable key must appear in some page
pages = "".join(open(f"{ROOT}/{n}", encoding="utf-8").read() for n in ["index.html", "platform.html", "company.html", "impressum.html", "datenschutz.html"])
missing = [k for k in STRINGS if not k.startswith(SKIP) and f'data-i18n="{k}"' not in pages]
assert not missing, f"untagged keys: {missing}"

with open(f"{ROOT}/js/strings.js", "w", encoding="utf-8") as f:
    f.write("// Generated by tools/build_pages.py from i18n/strings.json. Do not edit by hand.\n")
    f.write("export const STRINGS = " + json.dumps(STRINGS, ensure_ascii=False, indent=4) + ";\n")
print("ok")
