// Guest animals and the shared colour palette. Picks are deterministic from a hash or uid.

export const PALETTE = ["#FF5A5F", "#FFB400", "#00A699", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316"];

export const ANIMALS = [
    ["Otter", "🦦"], ["Fox", "🦊"], ["Owl", "🦉"], ["Lynx", "🐈"], ["Heron", "🐦"],
    ["Badger", "🦡"], ["Beaver", "🦫"], ["Hedgehog", "🦔"], ["Falcon", "🦅"], ["Wolf", "🐺"],
    ["Bison", "🦬"], ["Elk", "🦌"], ["Hare", "🐇"], ["Raven", "🐦‍⬛"], ["Crane", "🦢"],
    ["Seal", "🦭"], ["Walrus", "🦭"], ["Puffin", "🐧"], ["Penguin", "🐧"], ["Koala", "🐨"],
    ["Panda", "🐼"], ["Tiger", "🐅"], ["Leopard", "🐆"], ["Cheetah", "🐆"], ["Zebra", "🦓"],
    ["Giraffe", "🦒"], ["Camel", "🐫"], ["Llama", "🦙"], ["Alpaca", "🦙"], ["Moose", "🫎"],
    ["Squirrel", "🐿️"], ["Chipmunk", "🐿️"], ["Dolphin", "🐬"], ["Whale", "🐋"], ["Octopus", "🐙"],
    ["Turtle", "🐢"], ["Frog", "🐸"], ["Gecko", "🦎"], ["Flamingo", "🦩"], ["Peacock", "🦚"],
];

// hex string (e.g. a sha256) to a stable animal and colour
// Anything that is not a hex hash (should not happen) is hashed first, so this never fails.
const fnv = (text, seed) => {
    let h = seed;
    for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h;
};

export function identityFromHash(hex) {
    const isHex = /^[0-9a-f]{16}/i.test(hex);
    const a = isHex ? parseInt(hex.slice(0, 8), 16) : fnv(hex, 2166136261);
    const c = isHex ? parseInt(hex.slice(8, 16), 16) : fnv(hex, 33554467);
    const [animal, emoji] = ANIMALS[a % ANIMALS.length];
    return { animal, emoji, color: PALETTE[c % PALETTE.length] };
}

export function colorFromUid(uid) {
    let h = 0;
    for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
}
