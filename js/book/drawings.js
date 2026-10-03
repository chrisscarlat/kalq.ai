// The magazine's drawings, in the manner of an assembly manual: one smooth outline of a single weight, white fill,
// simple shapes, no shading or crease marks. All decorative (aria-hidden): what they show is also real text or a
// labelled button. The stroke keeps its weight at any size.
const STROKE = 'fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';

// A pointing hand: the index finger up (its tip at 20,3 of 48×60), the other fingers folded into one rounded form,
// the thumb laid along them, a plain cuff at the wrist
export const HAND_PATHS = '<path d="M24 52.5V58h15v-5.5"/>'
    + '<path d="M16 32V7.5a4 4 0 0 1 8 0V22c1.2-2.6 7.6-2.6 8 1.2c1.4-2.4 7-2.2 7 1.8c1.6-1.8 6-1.2 6 2.4V38c0 8.6-5.4 14.5-14 14.5h-2.5c-5.2 0-8.6-2.6-11.4-6.6L7.6 37.4a3.4 3.4 0 0 1 5.4-4.1z"/>';
export const HAND_TIP = { x: 20 / 48, y: 3 / 60 };
export const HAND = `<svg viewBox="0 0 48 60" aria-hidden="true" focusable="false" ${STROKE}>${HAND_PATHS}</svg>`;

// The welcome page: an open book, one leaf lifting under the hand, a curved arrow for the turn. The leaf sways a
// little (CSS, none under reduced motion).
export const TURN = `<svg class="kalq-mag-welcome__drawing" viewBox="0 0 260 170" aria-hidden="true" focusable="false" ${STROKE}>`
    + '<path d="M130 38C108 30 74 28 40 34V144C74 138 108 140 130 148Z"/>'
    + '<path d="M130 38C152 30 186 28 220 34V144C186 138 152 140 130 148Z"/>'
    + '<path d="M196 16C170 4 118 3 84 16" fill="none"/><path d="M92 9L83 16.5L94 20" fill="none"/>'
    + '<g class="kalq-mag-welcome__leaf"><path d="M130 38C148 26 170 18 194 20C186 54 182 102 186 132C164 132 146 138 130 148Z"/>'
    + `<g transform="translate(171 78) rotate(-28) scale(.8)">${HAND_PATHS}</g></g></svg>`;
