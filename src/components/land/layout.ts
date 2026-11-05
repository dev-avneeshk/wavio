// Layout of Lazy Films City (1 unit = 1 m, +x east, +z south, sea in the north).
// Same grid and palette as the House City reel. Plot numbers are fixed forever: plot #1 is on
// Founders' Row facing the central plaza, and the city fills outward ring by ring from there.

export const BX = 56; // block width (x)
export const BZ = 40; // block depth (z)
export const ROAD = 12;
export const PX = BX + ROAD; // block pitch x
export const PZ = BZ + ROAD; // block pitch z
export const PER_ROW = 5;
export const LOTS_PER_BLOCK = PER_ROW * 2;
export const LW = (BX - 4) / PER_ROW; // lot width
export const Y0 = 0.42; // top of a block's lawn
export const FH = 3.0; // floor height

export const WALLS = ["#EFD9A7", "#F3CF79", "#EBA596", "#F2B48C", "#B8D4E6", "#C3E3C6", "#CDB9E2", "#E8C9A8", "#F4EEE2", "#D98D5B", "#A8C8A0", "#E6A9B8", "#9FC3DC"] as const;
export const ROOFS = ["#C8443A", "#E2633D", "#3F5A7C", "#4D70A6", "#2F7B5C", "#7A4B34", "#5E4C8E", "#2D8C88", "#D9822B", "#B23A48", "#3B6E3F"] as const;
export const DOORS = ["#2E5F5C", "#8B2E2E", "#3B4A6B", "#6B4A2E", "#2F4F3A"] as const;
export const TRIM = "#F7F3EA";
export const GLASS = "#A9C3D3";
export const LAWN = "#86C95A";
export const WALK = "#E4DBCA";
export const ASPHALT = "#5C6068";
export const GRASS = "#93CD66";

export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const blockC = (i: number, j: number): [number, number] => [i * PX, j * PZ];
export const ringOf = (i: number, j: number) => Math.max(Math.abs(i), Math.abs(j));
export const isPlaza = (i: number, j: number) => i === 0 && j === 0;
export const isPark = (i: number, j: number) =>
  ringOf(i, j) >= 2 && ((mod(i, 4) === 2 && mod(j, 3) === 1) || (mod(i, 5) === 0 && mod(j, 4) === 3));

export type Row = "S" | "N";
export type Lot = {
  i: number;
  j: number;
  row: Row;
  k: number;
  x: number; // house centre
  z: number;
  rot: number; // 0: front faces +z (south street), PI: faces -z
  ring: number;
};

export const lotAt = (i: number, j: number, row: Row, k: number): Lot => {
  const [cx, cz] = blockC(i, j);
  return {
    i,
    j,
    row,
    k,
    x: cx + (k - (PER_ROW - 1) / 2) * LW,
    z: row === "S" ? cz + 8 : cz - 8,
    rot: row === "S" ? 0 : Math.PI,
    ring: ringOf(i, j),
  };
};

export const lotKey = (l: Pick<Lot, "i" | "j" | "row" | "k">) => `${l.i},${l.j},${l.row},${l.k}`;

// Residential blocks of one ring, clockwise from north.
const ringBlocks = (r: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) {
      if (ringOf(i, j) !== r || isPlaza(i, j) || isPark(i, j)) continue;
      out.push([i, j]);
    }
  const angle = ([i, j]: [number, number]) => mod(Math.atan2(i, -j), Math.PI * 2);
  return out.sort((a, b) => angle(a) - angle(b));
};

// A block's lots, nearest to the city centre first.
const lotsCache = new Map<string, Lot[]>();
const blockLots = (i: number, j: number): Lot[] => {
  const key = `${i},${j}`;
  const hit = lotsCache.get(key);
  if (hit) return hit;
  const lots: Lot[] = [];
  for (const row of ["S", "N"] as Row[]) for (let k = 0; k < PER_ROW; k++) lots.push(lotAt(i, j, row, k));
  const d = (l: Lot) => Math.round(Math.hypot(l.x, l.z) * 100);
  lots.sort((a, b) => d(a) - d(b) || (a.row === b.row ? 0 : a.row === "S" ? -1 : 1) || a.k - b.k);
  lotsCache.set(key, lots);
  return lots;
};

const blockOrder: [number, number][] = [];
let builtRing = 0;
const ensureBlocks = (count: number) => {
  while (blockOrder.length < count) {
    builtRing += 1;
    blockOrder.push(...ringBlocks(builtRing));
  }
};

// Plot numbers start at 1.
export const lotForPlot = (n: number): Lot => {
  const p = Math.max(0, Math.floor(n) - 1);
  const b = Math.floor(p / LOTS_PER_BLOCK);
  ensureBlocks(b + 1);
  const [i, j] = blockOrder[b];
  return blockLots(i, j)[p % LOTS_PER_BLOCK];
};

export const MAX_RING = 45;

// How many rings of blocks to draw: the next free plot's ring plus one ring of empty land (at least 3).
export const ringsToDraw = (taken: number) => Math.min(MAX_RING, Math.max(3, lotForPlot(taken + 1).ring + 1));

export const cityHalf = (rings: number) => ({
  x: rings * PX + BX / 2 + ROAD,
  z: rings * PZ + BZ / 2 + ROAD,
});
