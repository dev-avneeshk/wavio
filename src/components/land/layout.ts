// Layout of the world (1 unit = 1 m, +x east, +z south, the sea in the north).
//
// A town is the city from the House City reel: a central plaza and 5 rings of blocks around it,
// with 1,000 plots. Inside a town, plot 1 is on Founders' Row facing the plaza and the town fills
// outward ring by ring. Towns sit on a grid along the coast and spread inland: Town 1 in the
// middle, then east, west, and so on in half-rings, forever. All numbers here are fixed, so a
// house never moves.
import { TOWN_SIZE, firstPlotOf, plotInTown, townOf } from "@/lib/world";

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

export const TOWN_RINGS = 5;
export const BLOCKS_PER_TOWN = TOWN_SIZE / LOTS_PER_BLOCK;
export const TOWN_HALF = {
  x: TOWN_RINGS * PX + BX / 2 + ROAD,
  z: TOWN_RINGS * PZ + BZ / 2 + ROAD,
};
// Distance between town centres; the gap between towns is farmland with a highway.
export const TOWN_PITCH = { x: 1000, z: 800 };
// Roads that line up with a town's own streets, so highways run straight into them.
export const HIGHWAY_OFF = { x: PX / 2, z: PZ / 2 };
export const SEA_Z = -(TOWN_HALF.z + 190);

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

// ---------- the world grid of towns ----------

// Ring r of the half-square grid around Town 1 (cells with max(|gx|, gz) = r and gz >= 0) holds
// 4r + 1 towns. Inside a ring: the coastal towns first, then inland, east before west.
export const lastTownOfRing = (r: number) => (2 * r + 1) * (r + 1);

export const townRing = (t: number) => {
  let r = 0;
  while (lastTownOfRing(r) < t) r++;
  return r;
};

export const townCell = (t: number): [number, number] => {
  const r = townRing(t);
  if (r === 0) return [0, 0];
  const k = t - lastTownOfRing(r - 1) - 1;
  if (k < 2 * r) return [k % 2 === 0 ? r : -r, Math.floor(k / 2)];
  const q = k - 2 * r;
  return [q === 0 ? 0 : q % 2 === 1 ? (q + 1) / 2 : -q / 2, r];
};

// The town on a grid cell (0 if the cell is in the sea).
export const townAtCell = (gx: number, gz: number) => {
  if (gz < 0) return 0;
  const r = Math.max(Math.abs(gx), gz);
  if (r === 0) return 1;
  const base = lastTownOfRing(r - 1);
  const k = gz < r ? gz * 2 + (gx > 0 ? 0 : 1) : 2 * r + (gx === 0 ? 0 : gx > 0 ? 2 * gx - 1 : -2 * gx);
  return base + k + 1;
};

export const townCenter = (t: number): [number, number] => {
  const [gx, gz] = townCell(t);
  return [gx * TOWN_PITCH.x, gz * TOWN_PITCH.z];
};

// The town whose grid cell holds the point (x, z).
export const townAtPoint = (x: number, z: number) =>
  townAtCell(Math.round(x / TOWN_PITCH.x), Math.max(0, Math.round(z / TOWN_PITCH.z)));

// ---------- blocks inside a town (local coordinates, plaza at 0,0) ----------

export const blockC = (i: number, j: number): [number, number] => [i * PX, j * PZ];
export const ringOf = (i: number, j: number) => Math.max(Math.abs(i), Math.abs(j));
export const isPlaza = (i: number, j: number) => i === 0 && j === 0;
const isGridPark = (i: number, j: number) =>
  ringOf(i, j) >= 2 && ((mod(i, 4) === 2 && mod(j, 3) === 1) || (mod(i, 5) === 0 && mod(j, 4) === 3));

// Residential blocks of one ring, clockwise from north.
const ringBlocks = (r: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) {
      if (ringOf(i, j) !== r || isPlaza(i, j) || isGridPark(i, j)) continue;
      out.push([i, j]);
    }
  const angle = ([i, j]: [number, number]) => mod(Math.atan2(i, -j), Math.PI * 2);
  return out.sort((a, b) => angle(a) - angle(b));
};

const blockOrder: [number, number][] = [];
for (let r = 1; r <= TOWN_RINGS; r++) blockOrder.push(...ringBlocks(r));
// The first 100 blocks hold the town's 1,000 plots; the few left over in the last ring are parks.
const extraParks = new Set(blockOrder.slice(BLOCKS_PER_TOWN).map(([i, j]) => `${i},${j}`));

export const isPark = (i: number, j: number) => isGridPark(i, j) || extraParks.has(`${i},${j}`);

export type Row = "S" | "N";
export type Lot = {
  town: number;
  plot: number; // house number (global)
  i: number; // block, relative to the town's plaza
  j: number;
  row: Row;
  k: number;
  x: number; // house centre, world coordinates
  z: number;
  cx: number; // block centre, world coordinates
  cz: number;
  rot: number; // 0: front faces +z (south street), PI: faces -z
  ring: number;
};

type LocalLot = Omit<Lot, "town" | "plot" | "x" | "z" | "cx" | "cz"> & { lx: number; lz: number };

const localLot = (i: number, j: number, row: Row, k: number): LocalLot => {
  const [cx, cz] = blockC(i, j);
  return {
    i,
    j,
    row,
    k,
    lx: cx + (k - (PER_ROW - 1) / 2) * LW,
    lz: row === "S" ? cz + 8 : cz - 8,
    rot: row === "S" ? 0 : Math.PI,
    ring: ringOf(i, j),
  };
};

export const lotKey = (l: Pick<Lot, "i" | "j" | "row" | "k">) => `${l.i},${l.j},${l.row},${l.k}`;

// Plot order inside a town: block by block, and within a block the lots nearest the plaza first.
const townLots: LocalLot[] = [];
const plotByKey = new Map<string, number>();
for (const [i, j] of blockOrder.slice(0, BLOCKS_PER_TOWN)) {
  const lots: LocalLot[] = [];
  for (const row of ["S", "N"] as Row[]) for (let k = 0; k < PER_ROW; k++) lots.push(localLot(i, j, row, k));
  const d = (l: LocalLot) => Math.round(Math.hypot(l.lx, l.lz) * 100);
  lots.sort((a, b) => d(a) - d(b) || (a.row === b.row ? 0 : a.row === "S" ? -1 : 1) || a.k - b.k);
  for (const l of lots) {
    townLots.push(l);
    plotByKey.set(lotKey(l), townLots.length);
  }
}

const place = (l: LocalLot, town: number, local: number): Lot => {
  const [ox, oz] = townCenter(town);
  const [bx, bz] = blockC(l.i, l.j);
  return {
    town,
    plot: firstPlotOf(town) + local - 1,
    i: l.i,
    j: l.j,
    row: l.row,
    k: l.k,
    x: ox + l.lx,
    z: oz + l.lz,
    cx: ox + bx,
    cz: oz + bz,
    rot: l.rot,
    ring: l.ring,
  };
};

// House numbers start at 1.
export const lotForPlot = (plot: number): Lot => {
  const p = Math.max(1, Math.floor(plot));
  return place(townLots[plotInTown(p) - 1], townOf(p), plotInTown(p));
};

// The lot at block (i, j), row, k of a town (every residential block has 10).
export const lotAt = (town: number, i: number, j: number, row: Row, k: number): Lot => {
  const l = localLot(i, j, row, k);
  return place(l, town, plotByKey.get(lotKey(l)) ?? 0);
};
