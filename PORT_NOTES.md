# Port notes

What to carry from kalq.ai to certil.com, unit by unit. Each section lists the files, the dependencies on Kalq
internals, and what certil.com will need to change.

---

## 1. Cookie bar

A black pill at the bottom centre with a one-colour white cookie (crumbs and chocolate chips), one line of white
text and a thin white line on the right that runs out over 5 seconds. Two modes, each with its own text in each
language, both editable:

- **Notice** (no data collected, the default): no buttons. When the line has run out, the pill folds into its
  cookie and the cookie shrinks away. Shown once per visitor.
- **Consent** (data collected): Accept and Deny on the left, after the cookie. The line runs out but the bar stays
  until one is chosen. Nothing non-essential runs before Accept. The choice is kept; Accept reloads the page.

### Files

| File | What it is |
| --- | --- |
| `js/cookieBar.js` | The unit. `applyCookieSettings(doc, get)` writes the stored mode and texts into a document (shared by server and browser, no browser globals at the top level); the browser part shows the bar, handles Accept and Deny, runs consented content, and `previewCookieBar()` for the editor. Starts on its own when loaded. |
| `css/components/_cookie-bar.scss` | The one style block. |
| Markup in `tools/build_pages.py` (`COOKIE`) | In the shared page shell and on the gate, outside the page container. Built into `index.html`, `platform.html`, `company.html`, `impressum.html`, `datenschutz.html`, `gate.html`. |

Touched to wire it in:

| File | Change |
| --- | --- |
| `lib/render-page.js` | Calls `applyCookieSettings` on every rendered page; `renderGate` does it for the gate. |
| `api/page.js` | The gate page gets the stored settings (`latest_content("site")`). |
| `css/components/_components.scss`, `css/gate.scss` | Import the style block (the gate has its own stylesheet). |
| `css/main.css`, `css/gate.css` | Compiled. |
| `middleware.js` | `js/cookieBar.js` is public: the gate and the legal pages load it without the gate cookie. |

### Markup

```html
<div class="kalq-cookie" data-mode="notice" role="status" aria-live="polite" hidden>
    <svg class="kalq-cookie__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">…white cookie…</svg>
    <p class="kalq-cookie__text" data-for="notice"><span lang="de">…</span><span lang="en">…</span></p>
    <p class="kalq-cookie__text" data-for="consent"><span lang="de">…</span><span lang="en">…</span></p>
    <div class="kalq-cookie__actions">
        <button type="button" class="kalq-cookie__accept"><span lang="de">Akzeptieren</span><span lang="en">Accept</span></button>
        <button type="button" class="kalq-cookie__deny"><span lang="de">Ablehnen</span><span lang="en">Deny</span></button>
    </div>
    <span class="kalq-cookie__line" aria-hidden="true"></span>
</div>
<script src="js/cookieBar.js" type="module"></script>
```

Every text is in the HTML. The style block shows the current mode's sentence in the page's language
(`html[lang]`) and hides the rest. Reading order: the sentence, then the buttons. Visually the buttons sit on the
left, through CSS `order`.

### Stored settings

Site blocks (page `site`), saved like any edited text, append-only with versions:

| Key | Content |
| --- | --- |
| `site.cookie.mode` | `notice` or `consent` (the same in `de` and `en`). Missing means `notice`. |
| `site.cookie.notice` | The notice text, per language. Missing keeps the HTML's default. |
| `site.cookie.consent` | The consent text, per language. Missing keeps the HTML's default. |

In the visitor's browser (localStorage): `kalq-cookie-notice = "seen"` (notice shown) and
`kalq-cookie-consent = "granted" | "denied"` (the choice).

### Consent: what waits for Accept

Non-essential content goes into the page in a form that does nothing on its own:

```html
<script type="text/plain" data-consent src="…"></script>   <!-- or with inline code -->
<template data-consent>…markup…</template>
```

After Accept, and on every later page load, `js/cookieBar.js` turns these into a running script or into the markup.
`window.kalqConsent = { mode, granted, choice }` tells other scripts. Kalq has no non-essential content today, so
nothing is marked yet.

### Dependencies on Kalq internals

- The server render (`lib/render-page.js`) and its content rows (`latest_content`): certil.com calls
  `applyCookieSettings(document, get)` with its own store, where `get(key)` returns `{ de, en }` or null.
- The editor's save (the design panel, below) writes the blocks through Kalq's Supabase tables (`blocks`,
  `revisions`) with the editor's session.
- One Kalq-specific rule in the style block: `body:has(.kalq-toolbar) .kalq-cookie` lifts the bar above Kalq's
  editor and guest toolbar. certil.com drops it or points it at its own bottom bar.
- `z-index: 90`, above Kalq's magazine (70) and hinge strip (71).

### What certil.com will need to change

1. The storage keys (`kalq-cookie-notice`, `kalq-cookie-consent`) and the block keys (`site.cookie.*`), if it
   uses its own names.
2. The class prefix `kalq-cookie`.
3. The toolbar rule and the `z-index`, against its own layout.
4. Mark its non-essential scripts (analytics, embeds) with `type="text/plain" data-consent`, and switch the mode to
   consent.
5. The default texts in the markup (they ship as Kalq's defaults).

### Behaviour summary

- **Notice:** appears with a short rise, the line runs out, then it folds into the cookie and goes. Not shown again.
- **Consent:** appears and stays until a choice is made; the line runs out and stays empty.
  - **Accept:** stores `granted`, reloads, then runs the marked content.
  - **Deny:** stores `denied` and folds away. Asked again only if the stored choice is cleared.
- **Reduced motion:** a fade in and out; the line stays still; no fold.
- **Accessibility:**
  - In notice mode the bar is a polite status; in consent mode it is a labelled region with its two buttons.
  - The sentence is announced once as the bar appears. Focus is never moved or trapped.
  - The buttons work by keyboard. The rest of the pill lets clicks through.
- **Runtime styles only:** while folding, the script sets the pill's size and position on the element. The markup
  has no `style` attribute.

---

## 2. Design panel in tabs

The design panel (Styles, admins only) keeps its controls in tabs. Each tab has a small title saying what it
controls:

| Tab | Controls |
| --- | --- |
| Bilder / Images | Fill all, the liquid reveal, and the page map of every image slot (beside the tab) |
| Logos | The variant's logo, and what sits in the middle of the hero |
| Menü / Menu | The main menu's style |
| Navigation | The footer (classic or with contact and links; wordmark, gradient) |
| Benachrichtigungen / Notifications | The cookie bar: mode, both texts in both languages, preview, its own save |
| Farben und Schrift / Colours and fonts | The variant's colours and fonts |

The variant's letter, name and switches stay above the tabs; Versions and the actions (Preview, Save, …) below.
The Notifications tab is site-wide, the same in every variant, and is saved on its own ("Hinweis speichern").

### Files

| File | Change |
| --- | --- |
| `js/styles.js` | The tabs (`role="tablist"`, arrow keys, Home, End), the tab titles, the sections split by tab (`revealSection`, `menuSection`, `footerSection`), and `cookieSection` and `saveCookieBlocks` for the cookie bar. |
| `css/collab.scss`, `css/collab.css` | The tab styles; the page map only beside Images (`.kalq-styles__content.is-single` for the other tabs). |

### Dependencies on Kalq internals

The whole panel is Kalq's: style variants (`/api/variants`), the editor's Supabase session (`collab.sb`), the content
store (`js/content.js`: `storedEntry`, `setLocalContent`) and the editor's broadcast (`collab.broadcast`).

### What certil.com will need to change

certil.com ports the tab pattern and the Notifications tab into its own editor. The tab markup and keyboard handling
in `renderPanel` are self-contained. `cookieSection` needs certil.com's content store and save function in place
of Kalq's.
