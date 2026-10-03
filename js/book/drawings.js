// The magazine's drawings. The book in the welcome drawing: one smooth outline of a single weight on white, like an
// assembly manual. The hand is the client's own artwork. All decorative (aria-hidden): what they show is also real
// text or a labelled button.
export const STROKE = 'fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';

// The hint hand (the client's drawing): line art, the index finger to the upper left, its tip in the middle of two
// tap circles, a fading trail behind it for a drag from right to left. Drawn in currentColor: white on the cover's
// video, ink on a page. Mirrored for a drag from left to right (the trail on the other side). Parts carry classes so
// they can move on their own: the hand (.bk-hand__hand), the circles (.bk-hand__ring), the trail (.bk-hand__trail).
export const HAND_BOX = { w: 148, h: 162 };
export const HAND_TIP = { x: 31.4 / 148, y: 31.3 / 162 }; // the circles' centre, where the fingertip touches
let handId = 0;
export function handSvg({ mirror = false, trail = true, rings = true, cls = "" } = {}) {
    const id = `kalq-hand-trail-${handId++}`;
    const parts = (trail ? `<path class="bk-hand__trail" d="M125.45 22.1992L41.4502 14.4492L43.5157 16.8966C46.6141 19.143 48.7486 25.5688 50.401 30.9601C52.0535 36.3514 50.5491 41.855 46.0737 45.4492L125.45 32.9818V22.1992Z" fill="url(#${id})"/>` : "")
        + (rings ? '<path class="bk-hand__ring" d="M44.8361 43.0073C46.9094 40.6078 48.318 37.6794 48.884 34.5155C49.6601 30.1771 48.7968 25.7052 46.4618 21.9674C44.1268 18.2296 40.4865 15.4925 36.2474 14.2873C32.0082 13.082 27.4724 13.4945 23.5202 15.4447C19.568 17.395 16.4812 20.7439 14.8588 24.8416C13.2364 28.9393 13.1941 33.4935 14.7401 37.6207C16.2861 41.7478 19.3101 45.1535 23.2254 47.1768C26.591 48.9161 30.409 49.5273 34.1211 48.9492" stroke="currentColor" stroke-width="7"/>'
            + '<path class="bk-hand__ring is-outer" d="M51.687 48.8654C54.8866 45.1625 57.0602 40.6435 57.9337 35.7608C59.1313 29.066 57.7992 22.1649 54.1959 16.3968C50.5925 10.6287 44.9748 6.4048 38.433 4.54484C31.8911 2.68488 24.8915 3.32146 18.7925 6.33105C12.6935 9.34064 7.93001 14.5086 5.42632 20.8321C2.92264 27.1557 2.85734 34.1838 5.24309 40.5528C7.62884 46.9218 12.2955 52.1774 18.3375 55.2998C23.5314 57.9838 29.4232 58.927 35.1518 58.0349" stroke="currentColor" stroke-opacity="0.4" stroke-width="7"/>' : "")
        + '<path class="bk-hand__hand" d="M141.22 114.329L129.07 104.659C124.75 101.219 125.78 96.6193 125.04 91.0093C123.93 82.6593 110.99 74.2693 103.25 69.5893C98.8502 66.9193 94.7102 64.3093 90.4902 61.4093C86.4502 58.6393 80.5802 56.8493 76.3102 59.1793C71.4701 55.0293 64.3302 47.9593 59.6702 49.9793C56.1302 51.5093 57.3702 55.2093 55.9902 57.9793L50.1502 47.0893L46.2501 40.8893C44.3101 38.8793 43.6001 36.7193 42.3401 34.7393C40.3101 31.5993 36.7401 30.2593 33.2101 32.7293C26.5501 37.3893 29.1101 41.6893 30.6901 49.2493C30.6301 49.2293 30.5701 49.1993 30.5101 49.1693L32.4101 54.7793C36.8201 65.8893 41.3002 77.9793 46.4802 88.8693C47.4702 90.9593 47.7802 92.9293 47.4002 95.4493C43.3802 91.8993 40.2201 88.3093 35.9001 85.5993C30.7801 82.3793 23.6701 83.2393 21.9101 86.7693C21.3801 87.8293 21.2401 90.6293 21.8801 91.6393L29.0301 102.979L40.0101 121.909C48.2501 136.109 72.5702 146.819 88.4202 152.239C92.3102 153.569 94.5302 157.499 95.9902 161.129C97.7102 161.549 99.4002 160.879 100.74 159.679C99.3302 155.689 97.1301 152.029 93.8401 149.359C91.5901 147.529 88.7901 147.129 86.0901 146.119C74.5401 141.769 51.3401 130.959 45.8001 121.549L31.9501 97.9793C30.2101 95.0193 28.5501 92.3393 26.3401 89.4693C30.9801 86.1893 38.5402 93.8193 42.9002 98.4993L52.6701 108.979C54.1201 100.539 53.5201 92.2293 50.1301 84.7093C44.4901 72.1893 39.4501 59.8193 35.2601 46.7693C34.5101 44.4193 33.7501 42.1493 33.6501 39.7293C33.6001 38.3993 36.0501 36.1493 37.3401 36.5593C39.3501 38.8093 40.9501 41.9393 42.4601 44.6093L60.4801 76.4793C62.1101 76.2493 63.4801 75.6593 64.7901 74.9293C65.0501 72.9693 64.1801 71.3793 63.7501 69.5993C62.5801 64.7193 61.3201 60.1193 61.7201 54.7393C64.6902 55.8393 66.7601 57.6693 68.8801 59.5493C72.1701 62.4593 75.3301 65.2893 78.0401 68.7693C78.3701 69.1893 79.1601 69.4193 79.5001 69.3493C79.9301 69.2593 82.5202 66.9793 82.3302 65.8093C82.1902 64.9493 81.4901 64.3393 80.1101 63.7693C81.5001 62.8193 83.2101 63.2993 84.7301 64.0793C88.8901 66.2093 92.4101 68.9193 96.4001 71.3593C103.21 75.5193 109.9 79.5593 115.69 84.9593C118.98 88.0293 120.76 91.3893 120.47 95.9593C120.14 101.079 122.17 105.929 126.13 108.999L130.92 112.709C134.98 115.849 139.07 118.709 142.21 122.839C144.05 122.829 145.7 122.479 147.13 121.519C145.74 118.489 143.68 116.299 141.21 114.339L141.22 114.329Z" fill="currentColor"/>';
    return `<svg class="bk-hand ${cls}" viewBox="0 0 148 162" aria-hidden="true" focusable="false" fill="none">`
        + `<defs><linearGradient id="${id}" x1="39.04" y1="30.33" x2="139.5" y2="30.33" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor"/><stop offset="0.85" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>`
        + (mirror ? `<g transform="translate(148 0) scale(-1 1)">${parts}</g>` : parts) + "</svg>";
}

// The welcome page: an open book, one leaf lifting under the hand, a curved arrow for the turn. The leaf sways a
// little (CSS, none under reduced motion).
export const TURN = `<svg class="kalq-mag-welcome__drawing" viewBox="0 0 260 170" aria-hidden="true" focusable="false" ${STROKE}>`
    + '<path d="M130 38C108 30 74 28 40 34V144C74 138 108 140 130 148Z"/>'
    + '<path d="M130 38C152 30 186 28 220 34V144C186 138 152 140 130 148Z"/>'
    + '<path d="M196 16C170 4 118 3 84 16" fill="none"/><path d="M92 9L83 16.5L94 20" fill="none"/>'
    + '<g class="kalq-mag-welcome__leaf"><path d="M130 38C148 26 170 18 194 20C186 54 182 102 186 132C164 132 146 138 130 148Z"/>'
    + `<g class="kalq-mag-welcome__hand" transform="translate(${186 - 31.4 * 0.5} ${84 - 31.3 * 0.5}) scale(.5)" color="#111" stroke="none">${handSvg({ rings: false }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></g></svg>`;
