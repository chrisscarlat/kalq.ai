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

The design panel (Styles, admins only) keeps its controls in tabs: real tabs, words on one rule with the selected one
underlined, in one row (a narrow window scrolls them). Each tab has a small title saying what it controls; each
section heading inside is in small capitals with a hairline running to the end of the column. Like the rest of the
editor, the panel is always in English, whatever the page language. Each tab:

| Tab | Controls |
| --- | --- |
| Images | Fill all, the liquid reveal, and the page map of every image slot (beside the tab) |
| Logos | The variant's logo, and what sits in the middle of the hero |
| Menu | The main menu's style, with a wireframe preview beside the tab |
| Navigation | The footer (classic or with contact and links; wordmark, gradient), with a wireframe preview |
| Notifications | The cookie bar: mode, both texts in both languages, preview, its own save; a wireframe preview |
| Colours & fonts | The style editor: every style as a card (a click switches to it), "+ New variant", the selected style's letter, name, Published and Default; then its colours and fonts |

The head names the style being edited ("Editing: …"); a click opens Colours & fonts, where styles are added, switched
and edited. The other tabs edit the selected style. Versions and the actions (Preview, Save, …) stay below the tabs.
The Notifications tab is site-wide, the same in every variant, and is saved on its own ("Save notice").

### Wireframe previews

Beside Menu, Navigation and Notifications: a browser drawn in white lines with the page inside as a wireframe
(white bars for text, pills for buttons), redrawn on every choice. Menu shows the selected style's header with its
own buttons (the four dots that turn to a diamond, the panels icon, the two lines) and opens in a loop as on the
site: the dropdown card, the three panels wiping down, the mega panel, the full-screen sheet. Navigation shows the
end of a page with the footer (classic, or contact and links with the wordmark and the moving gradient).
Notifications shows the cookie pill: in notice mode the line runs out and it folds into its cookie; in consent mode
Accept and Deny on its left. Under reduced motion: the open state, still. The frame is `role="img"` with a label
naming what is shown.

### Files

| File | Change |
| --- | --- |
| `js/styles.js` | The tabs (`role="tablist"`, arrow keys, Home, End), the tab titles, the sections split by tab (`revealSection`, `menuSection`, `footerSection`), `cookieSection` and `saveCookieBlocks` for the cookie bar, and `drawPreview` for the right side. |
| `js/stylePreview.js` | The wireframe previews: `menuPreview(style, label)`, `footerPreview({ style, wordmark, gradient }, label)`, `cookiePreview(mode, label)`. Plain DOM, no Kalq internals; it clones the page's wordmark and cookie icon when they are there. |
| `css/collab.scss`, `css/collab.css` | The tab styles, the section headings, the previews (`.kalq-wire`); the right side only beside Images, Menu, Navigation and Notifications (`.kalq-styles__content.is-single` for the other tabs). |

### Dependencies on Kalq internals

The whole panel is Kalq's: style variants (`/api/variants`), the editor's Supabase session (`collab.sb`), the content
store (`js/content.js`: `storedEntry`, `setLocalContent`) and the editor's broadcast (`collab.broadcast`).

### What certil.com will need to change

certil.com ports the tab pattern and the Notifications tab into its own editor. The tab markup and keyboard handling
in `renderPanel` are self-contained. `cookieSection` needs certil.com's content store and save function in place
of Kalq's. `js/stylePreview.js` ports as it is; its drawings follow Kalq's six menu styles and two footers, so
certil.com redraws any style it does not have. The editor language is one constant (`EDITOR_LANG` in
`js/i18n.js`).

---

## 3. Scroll story (media.scroll-steps)

A scroll story: a pinned visual (a video scrubbed by the scroll, or an image), a thin progress bar, and an ordered
list of steps where the active one opens. One unit for the port to certil.com.

### Module id

`media.scroll-steps` (registry category `media`). One version: `pinned`.

### GSAP

GSAP **3.12.5** with ScrollTrigger 3.12.5, the version certil.com has vendored. The module adds no library: it uses
the page's global `gsap` and `ScrollTrigger`. Kalq loads them from cdnjs (`gsap/3.12.5/gsap.min.js`,
`gsap/3.12.5/ScrollTrigger.min.js`); certil.com loads its vendored copies. Without them the module stays static.

### Files

Created (the module itself):

| File | What it is |
| --- | --- |
| `js/modules/scrollSteps.js` | The registry entry (`SCROLL_STEPS`), its category, the template (`render`, shared by server and browser), the book unit, and the behaviour (`setupScrollSteps`). |
| `css/components/_scroll-steps.scss` | The one style block, including the two-screen mixin `scroll-steps-two-screens`. |

Kalq's pattern has no separate template file: a module's markup is its `render(ctx)` function in the same file.

Touched (one line or one small block each, so the module is wired in):

| File | Change |
| --- | --- |
| `js/modules/registry.js` | Imports `SCROLL_STEPS` and its category; `Object.assign(MODULES, SCROLL_STEPS)`. |
| `js/moduleBehaviour.js` | Imports and calls `setupScrollSteps` for `.kalq-ss[data-scroll-steps]`. |
| `css/components/_components.scss` | `@import "scroll-steps"`. |
| `css/utilities/_dual.scss` | `@include scroll-steps-two-screens` (two-screen devices and the picker's two-screen preview). |
| `js/sections.js` | Generic item actions (`data-items-action`: add, up, down, remove, visibility) for any module with `itemsEditor`; each one undo step. |
| `js/edit.js` | Opt-in upload hint and size warning for a media slot (`data-kalq-upload-hint`, `data-kalq-upload-warn`). |
| `middleware.js` | `js/modules/scrollSteps.js` is public, like the registry that imports it (the legal pages load the registry). |
| `css/main.css` | Compiled. |

### What the editor sets

Section heading (h2, required), intro line, steps (2 to 8, default 4; each: label, heading, one or two sentences,
start time in the video in seconds), the visual (MP4 video or an image; optional WebM of the same video; poster
image; one-sentence description), closing line, button text and link, visibility (public / private space only).

### Dependencies on Kalq internals

- **Render helpers** from `js/modules/kit.js`: `L, append, el, mediaEl, mediaOf, plain, section, slotEl, hrefOf,
  textOf, editorField` (and through it `renderBlock` from `js/blocks.js`). certil.com needs equivalents or a copy.
- **Render context** `ctx = { doc, page, id, entry, def, store, lang, editor }`; content keys are
  `<page>.<sectionId>.<slot>`, text per language, media as `{ media: url }`.
- **Section entry options**: the steps live in `entry.opts.items` (`[{ id }]`, in order) and the visibility in
  `entry.opts.visibility`. Each step's words are blocks `label_<id>`, `heading_<id>`, `text_<id>`, `time_<id>`.
- **Editor**: placeholders (`kalq-ph`, styled in `css/collab.scss`), media replace buttons (`js/edit.js`
  `replaceButtons`), the item actions in `js/sections.js`, the go-live check `def.missing` (used by
  `missingRequired` in the registry), `def.initialOpts` (used by `insertModule`).
- **Base styles**: `.kalq-m` / `.kalq-m-inner` (container queries, padding) from `css/components/_modules.scss`;
  `.kalq-sr` (visually hidden) from `css/components/_library.scss`; colour tokens `--kalq-bg`, `--kalq-text`,
  `--kalq-accent`; two-screen variables `--seg-l`, `--seg-r`, `--seg-hinge`.
- **Scrolling**: Kalq scrolls through smooth-scrollbar (`window.Scrollbar`, `.scrollbar-container`) with a
  ScrollTrigger scroller proxy. The module uses `pinType: "transform"` and `Scrollbar.scrollTo` when it finds it;
  otherwise `pinType: "fixed"` and `window.scrollTo`. certil.com without smooth-scrollbar takes the second path.
- **Book mode**: `magazine.unit` returns a unit for Kalq's magazine layout `A` (`js/book/layouts.js`).
- **Own storage**: `OWN_STORAGE` in `scrollSteps.js` accepts site paths and Kalq's Supabase bucket
  (`https://<project>.supabase.co/storage/v1/object/public/site-media/...`).

### What certil.com will need to change

1. `OWN_STORAGE` in `js/modules/scrollSteps.js`: certil.com's own storage rule.
2. **Visibility**: Kalq has no private space, so the setting is stored (`opts.visibility`) but not enforced here.
   certil.com must hide the section from the public page when it is `"private"`.
3. The render helpers and base styles listed above, or certil.com's equivalents. Class names use the `kalq-ss`
   prefix (`kalq-m` for the module base); rename if certil.com uses its own prefix.
4. The colour tokens `--kalq-bg`, `--kalq-text`, `--kalq-accent`, or certil.com's tokens.
5. The editor wiring (item actions, upload hint and size warning, placeholders) in certil.com's editor.
6. The script calls `setupScrollSteps(section)` for each `.kalq-ss[data-scroll-steps]` after the page's content is
   in place, and again after a page transition.
7. **Inline styles at runtime only**: the markup has no `style` attribute and no inline script. While pinned,
   ScrollTrigger sets the pin's position and the script sets the progress bar's `transform`.
8. The upload hint and the 8 MB warning text live in the module's `UI` words. The editor shows them in English (`EDITOR_LANG`).

### Behaviour summary

- **Wide screens (768px and up), motion allowed, GSAP present:** the section pins for `steps × 0.8` viewport
  heights. The scroll position sets the active step (`aria-current="step"`, open), fills the progress bar and
  scrubs the video through each step's start time. The video never plays on its own; it seeks one frame at a time.
- **Reduced motion, no JavaScript, under 768px:** not pinned, not scrubbed. The poster once (the video is not
  loaded), then every step open.
- **Book mode:** every step open, the poster instead of the video.
- **Reading order in the HTML:** h2, intro, the `<ol>` (each item an h3 with the label and heading, then a `<p>`),
  closing line, button, then the visual with its description as visually hidden text.

---

## 4. Gate logos

The gate (the first password screen) cycles the logos of the published styles, one per second. Every style's logo
sits in one fixed 120×120 square, the same size and place in every style and at every width, fitted inside it
whatever its shape, and clipped to it: it never runs over the wordmark and the code fields below. A logo without a
viewBox gets one from its own width and height, so it scales instead of being cut. The built-in mark's animation
keeps its drawing inside its square (`js/logoAnimation.js`), like the header mark.

### Files

| File | Change |
| --- | --- |
| `css/gate.scss`, `css/gate.css` | `.gate_logo__stack` the fixed square; `.gate_logo__layer` clips, its `svg` fills the square; `.gate_mark` clips. |
| `js/gate.js` | A viewBox for a logo that has none. |

### What certil.com will need to change

Nothing beyond its own gate markup and class names; the rule is the square and the fitted, clipped SVG.
