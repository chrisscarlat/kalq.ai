# kalq.ai

Static site built from the Digiverse Studio template (`templates/digiverseStudio`, kept for reference).

## Run

    python3 -m http.server 8000

## Styles

Edit the SCSS in `css/`, then compile:

    npx sass --no-source-map css/main.scss css/main.css

## Pages and translations

The HTML pages are generated. Edit `tools/build_pages.py` (markup) or `i18n/strings.json` (copy), then run:

    python3 tools/build_pages.py

Templates are written in English; the script tags them with `data-i18n`, writes the pages in German (the default language) and writes `js/strings.js` from the JSON. Everything is translated in German and English. FR, ES, IT and PL can be picked in the switcher but show English until their strings are added.

## Brand

- Font: Clash Grotesk (Fontshare), self-hosted in `fonts/`.
- `assets/kalq-mark.svg`: symbol. `assets/kalq-wordmark.svg`: KALQ outlined from Clash Grotesk Medium, the Q tail runs at 45°, parallel to the symbol's diagonal, and ends on the baseline at the O's right edge.
- Header and hero inline the SVGs so they take `currentColor`. The header symbol is drawn as 8 lines; `js/logoAnimation.js` forms K, A, L, Q only by growing and shrinking the rays along their own axes, opens back to the symbol between letters, then turns it in 3D (own perspective projection with depth shading) and loops (off with prefers-reduced-motion).

## Open TODOs

Hover and header images, Impressum data, Datenschutz text, FR/ES/IT/PL translations.
