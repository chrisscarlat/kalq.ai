# Engine patch 07: Statement that lights up in edit mode

Found in the module audit (2026-10-17), the closest match in Q-Site to the Statement module asked about (its doubled
"))" and "Small portrait (optional)" belonged to certil.com's own statement module, deleted in certil's rebuild on
2026-10-08; nothing in Q-Site 1.2.1 or Kalq renders "))": checked in edit mode, both languages, every module).

In `content.lit` (css/components/_final.scss, css/collab.scss):
- the empty alt text field (`.qs-m-alt-field`) ran across the whole section, far wider than the statement
- the picture's controls (`.qs-media-tools`, top right of the background layer) sat on the header's language switch
  and menu
- while the picture is empty, its caption (`.qs-ph-media::before`, at the foot of the background layer) lay on the
  last figure on a phone

Site fix (kalq.ai `css/_site.scss`): an empty alt field as wide as its label (and in lit at most 34rem); the lit
picture's controls start at 5.5rem; while the picture is empty the section keeps 2.75rem more at its foot.

The same three in the heroes with a background (video, page, glass): their controls sat on the header, the empty
background's caption on the last field; the glass card's alt field was a column of single words beside its button.
Kalq's fix covers every full-bleed background (`.qs-f-hero__media`, `.qs-f-lit__media`) and puts that alt field on its
own line.

Engine fix: the same in css/collab.scss and css/components/_final.scss.
