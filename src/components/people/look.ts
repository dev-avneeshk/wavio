// Who lives in each house: a person whose look is one of 2,548,039,680 combinations of body, skin,
// hair, face, accessory, clothes and shoes. The database hands the numbers out (public.char_look in
// supabase/schema.sql), one to one with house numbers, and keeps them unique, so no two people in
// the world look the same. This file turns a number into the person. No three.js here.

// Digits of the look number, lowest first. Changing the order or a count changes everyone's look;
// the product (LOOK_SIZE) must stay equal to the 2548039680 in schema.sql.
const RADIX = [2, 8, 10, 8, 4, 6, 4, 12, 3, 8, 6, 4, 3] as const;
export const LOOK_SIZE = RADIX.reduce((a, b) => a * b, 1);

export const SKIN = ["#F6D7C3", "#EDC3A3", "#E0AC84", "#C98E62", "#A86F45", "#8A5634", "#6B3F24", "#4A2C1A"] as const;
export const HAIR_COLORS = ["#1C1714", "#3B2A1E", "#6A4A2E", "#8E3B22", "#D8B56A", "#B5562A", "#9C9C9C", "#E6E2DA"] as const;
export const TOP_COLORS = [
  "#D94F45",
  "#3E6FB5",
  "#F2C14E",
  "#4E9A5B",
  "#7B5BA6",
  "#F08A3C",
  "#2E2E33",
  "#F4F1EA",
  "#E37FA6",
  "#3FA7A3",
  "#8C5A3C",
  "#9BB7D4",
] as const;
export const BOTTOM_COLORS = ["#2F3E5C", "#1F2226", "#6B6F75", "#C9B48A", "#4A5D3A", "#7A3B2E", "#E8E2D4", "#5C7FA8"] as const;
export const SHOE_COLORS = ["#F4F4F2", "#1F1F22", "#7A4E2D", "#C24038", "#3B5BA5", "#E3B341"] as const;

export const HAIR_STYLES = ["buzz", "short", "sidepart", "curly", "afro", "long", "ponytail", "bun", "bob", "spiky"] as const;
export const ACCESSORIES = ["none", "glasses", "sunglasses", "cap", "beanie", "headphones"] as const;
export const TOPS = ["tee", "shirt", "hoodie", "jacket"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type TopStyle = (typeof TOPS)[number];
export type BottomStyle = "trousers" | "shorts" | "skirt" | "joggers";

export type Look = {
  fem: boolean;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  grey: boolean;
  // Men: 0 clean-shaven, 1 stubble, 2 moustache, 3 beard. Women: 0 none, 1 earrings, 2 lipstick, 3 both.
  detail: number;
  acc: Accessory;
  accColor: string; // caps, beanies and headphones
  top: TopStyle;
  topColor: string;
  bottom: BottomStyle;
  bottomColor: string;
  shoes: string;
  height: number; // metres
  build: 0 | 1 | 2; // slim, average, broad
};

// The same mapping as public.char_look, for a database that doesn't send looks yet.
export const lookForPlot = (plot: number) =>
  Number((BigInt(1234567891) * BigInt(Math.max(1, Math.floor(plot))) + BigInt(987654321)) % BigInt(LOOK_SIZE));

export const decodeLook = (look: number): Look => {
  let n = Number.isFinite(look) && look >= 0 ? Math.floor(look) % LOOK_SIZE : 0;
  const d: number[] = [];
  for (const r of RADIX) {
    d.push(n % r);
    n = Math.floor(n / r);
  }
  const [sex, skin, hair, hairColor, detail, acc, top, topColor, bottom, bottomColor, shoes, height, build] = d;
  const fem = sex === 1;
  const heights = fem ? [1.56, 1.63, 1.7, 1.77] : [1.64, 1.72, 1.8, 1.88];
  return {
    fem,
    skin: SKIN[skin],
    hair: HAIR_STYLES[hair],
    hairColor: HAIR_COLORS[hairColor],
    grey: hairColor >= 6,
    detail,
    acc: ACCESSORIES[acc],
    // Hats and headphones take a colour from the outfit's palette, offset so they don't match the top.
    accColor: TOP_COLORS[(topColor + 5 + acc) % TOP_COLORS.length],
    top: TOPS[top],
    topColor: TOP_COLORS[topColor],
    bottom: fem ? (["trousers", "shorts", "skirt"] as const)[bottom] : (["trousers", "shorts", "joggers"] as const)[bottom],
    bottomColor: BOTTOM_COLORS[bottomColor],
    shoes: SHOE_COLORS[shoes],
    height: heights[height],
    build: build as 0 | 1 | 2,
  };
};

// Personalities. The database picks one per house (public.char_trait); it steers what the person
// does on their own (section 11 of schema.sql).
export const TRAITS: Record<string, { label: string; note: string }> = {
  hardworking: { label: "Hard worker", note: "Always busy: chores, jogging, first in line for jobs." },
  hothead: { label: "Hothead", note: "Quick to pick a fight with the neighbours." },
  sneaky: { label: "Sneaky", note: "Light fingers. Neighbours, watch your coins." },
  friendly: { label: "Friendly", note: "Always stopping for a chat." },
  lazy: { label: "Laid-back", note: "Naps, park benches, more naps." },
  curious: { label: "Curious", note: "Pokes around the neighbourhood." },
};

export const traitLabel = (t: string) => TRAITS[t]?.label ?? "Easy-going";

// What a person looks like, in a few words (for the card).
export const lookWords = (l: Look) => {
  const hair = l.grey ? "grey" : l.hairColor === HAIR_COLORS[4] ? "blonde" : l.hairColor === HAIR_COLORS[5] ? "ginger" : "dark";
  const style: Record<HairStyle, string> = {
    buzz: "buzz cut",
    short: "short hair",
    sidepart: "side parting",
    curly: "curly hair",
    afro: "afro",
    long: "long hair",
    ponytail: "ponytail",
    bun: "hair in a bun",
    bob: "bob",
    spiky: "spiky hair",
  };
  const extra =
    l.acc === "none" ? "" : l.acc === "glasses" ? ", glasses" : l.acc === "sunglasses" ? ", shades" : `, ${l.acc}`;
  return `${hair === "dark" ? "" : `${hair} `}${style[l.hair]}${extra}, ${l.top}`;
};
