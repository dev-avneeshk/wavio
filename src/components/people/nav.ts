// Where people go and how they get there. People walk on the pavements around the blocks and cross
// the roads at the zebra crossings: every block has a pavement line 0.8 m in from each edge, and those
// lines run on across the roads, so the town is a grid of walkable lines. A trip goes out of the
// front gate, along the pavement, round at most two corners, and in to where it's going. All in
// world coordinates; nothing here is random, so every screen works out the same route.
import { rot } from "../land/geo";
import {
  BX,
  BZ,
  PX,
  PZ,
  TOWN_RINGS,
  Y0,
  hashStr,
  isCivic,
  isPark,
  isPlaza,
  lotForPlot,
  townCenter,
  type Lot,
} from "../land/layout";
import { BOARD, YARD, houseSpec } from "../land/spec";

export type Pt = { x: number; z: number };

// Pavement lines, from a block's centre.
export const SIDE = { x: BX / 2 - 0.8, z: BZ / 2 - 0.8 };
// A front gate's pavement line, in lot coordinates (front = +z).
const GATE_Z = BZ / 2 - 0.8 - 8;

const R = TOWN_RINGS;

// ---------- paths ----------

export class Path {
  readonly pts: Pt[];
  readonly cum: number[];
  readonly len: number;

  constructor(pts: Pt[]) {
    // Drop repeated points so every segment has a direction.
    const clean: Pt[] = [];
    for (const p of pts) {
      const q = clean[clean.length - 1];
      if (!q || Math.hypot(p.x - q.x, p.z - q.z) > 0.02) clean.push(p);
    }
    if (!clean.length) clean.push(pts[0] ?? { x: 0, z: 0 });
    this.pts = clean;
    this.cum = [0];
    for (let i = 1; i < clean.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(clean[i].x - clean[i - 1].x, clean[i].z - clean[i - 1].z));
    }
    this.len = this.cum[this.cum.length - 1];
  }

  get start() {
    return this.pts[0];
  }

  get end() {
    return this.pts[this.pts.length - 1];
  }

  // The point s metres along, and the way it faces there.
  at(s: number, out: { x: number; z: number; ry: number }) {
    const p = this.pts;
    if (p.length === 1 || s <= 0) {
      out.x = p[0].x;
      out.z = p[0].z;
      out.ry = p.length > 1 ? Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z) : out.ry;
      return out;
    }
    if (s >= this.len) {
      const a = p[p.length - 2];
      const b = p[p.length - 1];
      out.x = b.x;
      out.z = b.z;
      out.ry = Math.atan2(b.x - a.x, b.z - a.z);
      return out;
    }
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = p[lo];
    const b = p[hi];
    const f = (s - this.cum[lo]) / Math.max(1e-6, this.cum[hi] - this.cum[lo]);
    out.x = a.x + (b.x - a.x) * f;
    out.z = a.z + (b.z - a.z) * f;
    out.ry = Math.atan2(b.x - a.x, b.z - a.z);
    return out;
  }
}

export const join = (...parts: Pt[][]) => parts.flat();

// ---------- the town's pavement grid ----------

const xLineCache = new Map<number, number[]>();
// Every north-south pavement line of a town, west to east.
const xLines = (town: number) => {
  let v = xLineCache.get(town);
  if (!v) {
    const [ox] = townCenter(town);
    v = [];
    for (let i = -R; i <= R; i++) v.push(ox + i * PX - SIDE.x, ox + i * PX + SIDE.x);
    xLineCache.set(town, v);
  }
  return v;
};

// From one point on an east-west pavement line to another: along the line, or round two corners.
// seed picks between equally short routes, so people don't all use the same street.
export const route = (town: number, a: Pt, b: Pt, seed: number): Pt[] => {
  if (Math.abs(a.z - b.z) < 0.3) return [a, b];
  const lines = xLines(town);
  const lo = Math.min(a.x, b.x);
  const hi = Math.max(a.x, b.x);
  const between = lines.filter((x) => x >= lo && x <= hi);
  let X: number;
  if (between.length) X = between[seed % between.length];
  else {
    const mid = (a.x + b.x) / 2;
    X = lines.reduce((best, x) => (Math.abs(x - mid) < Math.abs(best - mid) ? x : best), lines[0]);
  }
  return [a, { x: X, z: a.z }, { x: X, z: b.z }, b];
};

// The east-west pavement line nearest to a point inside block (i, j).
const nearestZLine = (cz: number, z: number) => (z >= cz ? cz + SIDE.z : cz - SIDE.z);

// ---------- homes ----------

export type Home = {
  plot: number;
  town: number;
  lot: Lot;
  w: number;
  d: number;
  du: number; // the front door and garden path, across the lot (lot coordinates)
  yard: number;
  gate: Pt; // where the garden path meets the pavement
  idle: Pt[]; // places to stand about in the front garden
  // Lot coordinates (front = +z) to world.
  at: (lx: number, lz: number) => Pt;
  // The way someone faces when they look out to the street, or back at the house.
  out: number;
  in: number;
  // Footprint of the house, for bumping into it.
  box: { x: number; z: number; hx: number; hz: number };
};

const homeCache = new Map<number, Home>();

export const homeOf = (plot: number): Home => {
  const hit = homeCache.get(plot);
  if (hit) return hit;
  const lot = lotForPlot(plot);
  const spec = houseSpec(plot, lot, lot.x, lot.z);
  const { w, d } = spec;
  const du = w > 9.6 ? -w * 0.2 : -w * 0.16;
  const yard = YARD(d);
  const at = (lx: number, lz: number): Pt => {
    const [ox, oz] = rot(lx, lz, lot.rot);
    return { x: lot.x + ox, z: lot.z + oz };
  };
  const front = d / 2;
  const home: Home = {
    plot,
    town: lot.town,
    lot,
    w,
    d,
    du,
    yard,
    gate: at(du, GATE_Z),
    idle: [
      at(du + 0.75, front + 1.5),
      at(du - 0.6, front + yard * 0.5),
      at(du + 0.55, front + yard - 1.0),
      at(du - 1.9, front + 2.3),
      at(du + 0.2, GATE_Z - 0.2),
    ],
    at,
    out: lot.rot,
    in: lot.rot + Math.PI,
    box: { x: lot.x, z: lot.z, hx: w / 2 + 0.35, hz: d / 2 + 0.35 },
  };
  if (homeCache.size > 4000) homeCache.clear();
  homeCache.set(plot, home);
  return home;
};

// Out of the garden onto the pavement, from a spot in the front garden.
export const toGate = (h: Home, from: Pt): Pt[] => {
  const [lx] = rot(from.x - h.lot.x, from.z - h.lot.z, -h.lot.rot);
  const onPath = h.at(h.du, h.d / 2 + Math.min(h.yard - 0.6, Math.max(1.0, localZ(h, from))));
  return Math.abs(lx - h.du) < 0.4 ? [from, h.gate] : [from, onPath, h.gate];
};

const localZ = (h: Home, p: Pt) => rot(p.x - h.lot.x, p.z - h.lot.z, -h.lot.rot)[1] - h.d / 2;

// Spots at a home, for the things people do there (lot coordinates turned into the world).
export const homeSpot = (h: Home, what: "sweepA" | "sweepB" | "water" | "mailbox" | "build" | "rest" | "meetIn" | "meetOut") => {
  const f = h.d / 2;
  switch (what) {
    case "sweepA":
      return h.at(h.du, f + 1.3);
    case "sweepB":
      return h.at(h.du, f + h.yard - 1.1);
    case "water":
      return h.at(h.du - 2.0, f + h.yard - 1.4);
    case "mailbox":
      return h.at(BOARD.x, GATE_Z - 0.35);
    case "build":
      return h.at(h.du + 1.0, f + h.yard - 0.9);
    case "rest":
      return h.at(h.du - 0.95, f + 1.25);
    case "meetIn":
      return h.at(h.du, GATE_Z - 0.55);
    case "meetOut":
      return h.at(h.du, GATE_Z + 0.55);
  }
};

// The mailbox sits at the name board, a few steps along the pavement from the gate.
export const mailboxApproach = (h: Home): Pt[] => [h.gate, h.at(BOARD.x, GATE_Z), homeSpot(h, "mailbox")];

// Once round the block the house is on, starting and ending at its gate.
export const blockLoop = (h: Home): Pt[] => {
  const { cx, cz } = h.lot;
  const s = h.lot.row === "S" ? 1 : -1;
  const z0 = cz + s * SIDE.z;
  const z1 = cz - s * SIDE.z;
  const e = cx + SIDE.x;
  const w = cx - SIDE.x;
  // South row goes east first, north row west first: always anticlockwise seen from above.
  return s > 0
    ? [h.gate, { x: e, z: z0 }, { x: e, z: z1 }, { x: w, z: z1 }, { x: w, z: z0 }, h.gate]
    : [h.gate, { x: w, z: z0 }, { x: w, z: z1 }, { x: e, z: z1 }, { x: e, z: z0 }, h.gate];
};

// ---------- the plaza's Job Centre (town coordinates, plaza at 0,0) ----------

export const KIOSK = { x: 14.8, z: 12.0, hx: 2.4, hz: 1.5, h: 3.2 };
const QUEUE_Z = [15.4, 17.0];

// Place k in the queue for jobs: one line along the front of the kiosk, then a second line back,
// then a crowd waiting around. Returns the spot and the way to face.
export const queueSpot = (town: number, k: number, seed: number): { p: Pt; ry: number } => {
  const [ox, oz] = townCenter(town);
  if (k === 0) return { p: { x: ox + KIOSK.x, z: oz + QUEUE_Z[0] }, ry: Math.PI };
  if (k <= 10) return { p: { x: ox + KIOSK.x - 0.95 * k, z: oz + QUEUE_Z[0] }, ry: Math.PI / 2 };
  if (k <= 21) return { p: { x: ox + KIOSK.x - 9.5 + 0.95 * (k - 11), z: oz + QUEUE_Z[1] }, ry: -Math.PI / 2 };
  const h = hashStr(`crowd:${seed}`);
  const x = -10 + (h % 1000) / 1000 * 13;
  const z = 15.2 + ((h >>> 10) % 1000) / 1000 * 3.4;
  return { p: { x: ox + x, z: oz + z }, ry: Math.atan2(KIOSK.x - x, KIOSK.z - z) };
};

// The pavement point to walk in from, for a spot in the plaza.
export const plazaEntry = (town: number, p: Pt): Pt => {
  const [, oz] = townCenter(town);
  return { x: p.x, z: oz + SIDE.z };
};

// ---------- work (town coordinates, plaza at 0,0) ----------

// The City Hospital, in the plaza's fourth corner (opposite the Job Market); its door faces the
// fountain (+z). The ambulance is parked by its east side.
export const HOSPITAL = { x: -14.8, z: -12.6, hx: 3.6, hz: 2.6, h: 5.6 };
export const AMBULANCE = { x: -7.4, z: -12.6, hx: 0.85, hz: 1.75 };
const HOSPITAL_LANE_X = -9.6; // the way in from the north pavement, between hospital and ambulance

// On shift at the hospital: a spot along its front, the way to face, and the way in from the
// north pavement line (it never cuts through the building).
const SHIFT_X = [-2.8, -2.0, -0.2, 0.6, 2.2, 3.0]; // along the front, clear of the canopy posts
export const hospitalShift = (town: number, seed: number): { p: Pt; ry: number; path: Pt[] } => {
  const [ox, oz] = townCenter(town);
  const front = oz + HOSPITAL.z + HOSPITAL.hz;
  const k = seed % (SHIFT_X.length * 2);
  const p = { x: ox + HOSPITAL.x + SHIFT_X[k % SHIFT_X.length], z: front + (k < SHIFT_X.length ? 2.4 : 3.3) };
  const entry = { x: ox + HOSPITAL_LANE_X, z: oz - SIDE.z };
  const walk = front + 0.6; // under the canopy, above the flower bed
  return { p, ry: (((seed >>> 3) % 3) - 1) * 0.5, path: [entry, { x: entry.x, z: walk }, { x: p.x, z: walk }, p] };
};

// Odd jobs: the south side of the plaza, between the fountain's benches and the street.
export const oddJobSpot = (town: number, seed: number): { p: Pt; ry: number } => {
  const [ox, oz] = townCenter(town);
  return { p: { x: ox - 4.5 + (seed % 10), z: oz + 11.4 + ((seed >>> 4) % 2) * 1.4 }, ry: 0 };
};

// ---------- the civic quarter: six more workplaces (town coordinates, plaza at 0,0) ----------

// Two workplaces to each civic block (layout.ts CIVIC), one in each half, door towards the plaza's
// side of the block. Everything about a workplace is in its own frame: x across, +z out of the
// front door towards the street; its front wall is at z = WORK_FRONT and its building is hx by hz
// (centred at z = WORK_FRONT - hz) and h tall. props: the things in its yard that people bump into
// (cars, a fire engine, a slide...). spots: where people stand on shift, across the front.
export type WorkKind = "police" | "fire" | "engineer" | "bank" | "school" | "film";
export const WORK_KINDS: readonly WorkKind[] = ["police", "fire", "engineer", "bank", "school", "film"];
export type Prop = { x: number; z: number; hx: number; hz: number; h: number };
type WorkSpec = { i: number; j: number; side: -1 | 1; hx: number; hz: number; h: number; props: Prop[]; spots: number[] };
export const WORK_FRONT = 1;
const HALF_BLOCK = BX / 4;
const SPOTS = [-4.4, -2.9, -1.4, 1.4, 2.9, 4.4];
const SPOT_Z = [WORK_FRONT + 2.6, WORK_FRONT + 3.8];

export const WORK: Record<WorkKind, WorkSpec> = {
  police: {
    i: -2,
    j: -2,
    side: -1,
    hx: 7.5,
    hz: 5.5,
    h: 6.2,
    props: [
      { x: -9.6, z: 8.2, hx: 0.95, hz: 2.1, h: 1.7 },
      { x: 9.6, z: 8.2, hx: 0.95, hz: 2.1, h: 1.7 },
    ],
    spots: SPOTS,
  },
  fire: {
    i: -2,
    j: -2,
    side: 1,
    hx: 8.5,
    hz: 6,
    h: 6.8,
    props: [
      { x: -4.3, z: 6.1, hx: 1.3, hz: 3.4, h: 3.0 },
      { x: 9.6, z: 9.6, hx: 0.3, hz: 0.3, h: 0.9 },
    ],
    spots: [-1.2, 0.4, 2.0, 3.6, 5.2, 6.6],
  },
  engineer: {
    i: 2,
    j: -2,
    side: -1,
    hx: 7,
    hz: 6,
    h: 11.6,
    props: [
      { x: -9.4, z: 9.0, hx: 1.7, hz: 0.6, h: 3.8 },
      { x: 9.4, z: 9.0, hx: 0.9, hz: 0.7, h: 3.3 },
    ],
    spots: SPOTS,
  },
  bank: {
    i: 2,
    j: -2,
    side: 1,
    hx: 7.5,
    hz: 5.5,
    h: 6.6,
    props: [
      { x: -9.6, z: 8.4, hx: 1.05, hz: 2.3, h: 2.2 },
      { x: 9.8, z: 6.0, hx: 0.8, hz: 0.7, h: 2.4 },
    ],
    spots: SPOTS,
  },
  school: {
    i: 2,
    j: 1,
    side: -1,
    hx: 9,
    hz: 5,
    h: 6.4,
    props: [
      { x: -9.6, z: 10.4, hx: 0.75, hz: 2.4, h: 2.6 },
      { x: 9.2, z: 10.8, hx: 1.9, hz: 0.8, h: 2.5 },
      { x: -7.0, z: 4.6, hx: 0.25, hz: 0.25, h: 8.5 },
    ],
    spots: SPOTS,
  },
  film: {
    i: 2,
    j: 1,
    side: 1,
    hx: 9.5,
    hz: 7,
    h: 6.6,
    props: [
      { x: -9.8, z: 9.2, hx: 1.4, hz: 0.5, h: 3.4 },
      { x: 7.0, z: 7.6, hx: 0.6, hz: 0.6, h: 2.0 },
      { x: 10.4, z: 11.2, hx: 0.55, hz: 0.55, h: 3.8 },
    ],
    spots: SPOTS,
  },
};

// A workplace's frame in the world: its origin, which way its front faces, and frame -> world.
export const workFrame = (kind: WorkKind, town: number) => {
  const w = WORK[kind];
  const [ox, oz] = townCenter(town);
  const x = ox + w.i * PX + w.side * HALF_BLOCK;
  const z = oz + w.j * PZ;
  const a = w.j < 0 ? 0 : Math.PI;
  const at = (lx: number, lz: number): Pt => {
    const [rx, rz] = rot(lx, lz, a);
    return { x: x + rx, z: z + rz };
  };
  return { x, z, a, at };
};

// The buildings (world boxes, top = roof sign) of a town's workplaces.
export const workBuildings = (town: number) =>
  WORK_KINDS.map((kind) => {
    const w = WORK[kind];
    const c = workFrame(kind, town).at(0, WORK_FRONT - w.hz);
    return { kind, x: c.x, z: c.z, hx: w.hx, hz: w.hz, top: 0.6 + w.h + 2.4 };
  });

// On shift at a workplace: a spot across its front, the way to face (out to the street, more or
// less) and the way in from the pavement in front of the block.
export const workShift = (kind: WorkKind, town: number, seed: number): { p: Pt; ry: number; path: Pt[] } => {
  const w = WORK[kind];
  const f = workFrame(kind, town);
  const k = seed % (w.spots.length * 2);
  const lx = w.spots[k % w.spots.length];
  const p = f.at(lx, SPOT_Z[k < w.spots.length ? 0 : 1]);
  return { p, ry: f.a + (((seed >>> 3) % 3) - 1) * 0.5, path: [f.at(lx, SIDE.z), p] };
};

// Labour: the building site next door (the house one along, in the same town).
export const siteFor = (plot: number, seed: number) => {
  const local = (plot - 1) % 1000;
  if (local === 0) return plot + 1;
  if (local === 999) return plot - 1;
  return seed % 2 ? plot + 1 : plot - 1;
};

// ---------- parks ----------

type Bench = { x: number; z: number; ry: number; cz: number };
const benchCache = new Map<number, { i: number; j: number; benches: Bench[] }[]>();

// Every park in a town with its four benches (the same places build.ts puts them).
const parksOf = (town: number) => {
  let v = benchCache.get(town);
  if (v) return v;
  const [ox, oz] = townCenter(town);
  v = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      if (isPlaza(i, j) || !isPark(i, j) || isCivic(i, j)) continue;
      const cx = ox + i * PX;
      const cz = oz + j * PZ;
      v.push({
        i,
        j,
        benches: [0.4, 2.0, 3.6, 5.2].map((a) => ({ x: cx + Math.cos(a) * 16.5, z: cz + Math.sin(a) * 10.5, ry: -a - Math.PI / 2, cz })),
      });
    }
  benchCache.set(town, v);
  return v;
};

// A seat on a bench in the park nearest a home, and the pavement point to walk in from.
export const parkSeat = (h: Home, seed: number): { p: Pt; ry: number; entry: Pt } | null => {
  const parks = parksOf(h.town);
  if (!parks.length) return null;
  let best = parks[0];
  let bd = Infinity;
  for (const pk of parks) {
    const dd = Math.abs(pk.i - h.lot.i) + Math.abs(pk.j - h.lot.j);
    if (dd < bd) {
      bd = dd;
      best = pk;
    }
  }
  const b = best.benches[seed % 4];
  const side = (seed >>> 2) % 2 ? 0.5 : -0.5;
  const [sx, sz] = rot(side, 0.12, b.ry);
  const p = { x: b.x + sx, z: b.z + sz };
  return { p, ry: b.ry, entry: { x: p.x, z: nearestZLine(b.cz, b.z) } };
};

// ---------- the ground ----------

// Height of the ground under someone's feet: lawns, pavements and roads are at different levels.
export const groundY = (town: number, x: number, z: number) => {
  const [ox, oz] = townCenter(town);
  const i = Math.round((x - ox) / PX);
  const j = Math.round((z - oz) / PZ);
  if (Math.abs(i) > R || Math.abs(j) > R) return 0.1;
  const bx = Math.abs(x - ox - i * PX);
  const bz = Math.abs(z - oz - j * PZ);
  if (bx > BX / 2 || bz > BZ / 2) return 0.1;
  return bx <= BX / 2 - 1.6 && bz <= BZ / 2 - 1.6 ? Y0 : 0.3;
};

// Things a player can't walk through in a town (besides houses): the plaza's fountain, towers,
// lawns and the Job Centre, and the park ponds. Boxes (hx, hz), circles (r) or ellipses (rx, rz),
// world coordinates.
export type Obstacle =
  | { x: number; z: number; hx: number; hz: number }
  | { x: number; z: number; r: number }
  | { x: number; z: number; rx: number; rz: number };

const obstacleCache = new Map<number, Obstacle[]>();
export const obstaclesOf = (town: number): Obstacle[] => {
  let v = obstacleCache.get(town);
  if (v) return v;
  const [ox, oz] = townCenter(town);
  v = [
    { x: ox, z: oz, r: 4.7 },
    { x: ox - 14.8, z: oz + 12.5, hx: 3.4, hz: 3.4 },
    { x: ox + 14.8, z: oz - 12.5, r: 3.4 },
    { x: ox + KIOSK.x, z: oz + KIOSK.z, hx: KIOSK.hx + 0.2, hz: KIOSK.hz + 0.2 },
    { x: ox + HOSPITAL.x, z: oz + HOSPITAL.z, hx: HOSPITAL.hx + 0.2, hz: HOSPITAL.hz + 0.2 },
    { x: ox + AMBULANCE.x, z: oz + AMBULANCE.z, hx: AMBULANCE.hx + 0.15, hz: AMBULANCE.hz + 0.15 },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) v.push({ x: ox + sx * 23, z: oz + sz * 13.5, hx: 4.1, hz: 4.1 });
  for (const pk of parksOf(town)) v.push({ x: ox + pk.i * PX, z: oz + pk.j * PZ, hx: 7.2, hz: 4.6 });
  for (const b of workBuildings(town)) v.push({ x: b.x, z: b.z, hx: b.hx + 0.2, hz: b.hz + 0.2 });
  for (const kind of WORK_KINDS) {
    const f = workFrame(kind, town);
    for (const p of WORK[kind].props) {
      const c = f.at(p.x, p.z);
      v.push({ x: c.x, z: c.z, hx: p.hx + 0.15, hz: p.hz + 0.15 });
    }
  }
  obstacleCache.set(town, v);
  return v;
};

// Tall things in a town's plaza that can come between the play camera and your person (houses are
// checked separately): boxes with a top height, world coordinates.
export const tallThings = (town: number) => {
  const [ox, oz] = townCenter(town);
  return [
    { x: ox + KIOSK.x, z: oz + KIOSK.z, hx: KIOSK.hx + 0.25, hz: KIOSK.hz + 0.25, top: 0.6 + KIOSK.h + 2.0 },
    { x: ox + HOSPITAL.x, z: oz + HOSPITAL.z, hx: HOSPITAL.hx + 0.25, hz: HOSPITAL.hz + 0.25, top: 0.6 + HOSPITAL.h + 1.6 },
    { x: ox - 14.8, z: oz + 12.5, hx: 3.0, hz: 3.0, top: 36 },
    { x: ox + 14.8, z: oz - 12.5, hx: 2.6, hz: 2.6, top: 30 },
    ...workBuildings(town).map((b) => ({ x: b.x, z: b.z, hx: b.hx + 0.25, hz: b.hz + 0.25, top: b.top })),
  ];
};

// The walkable area of a town (a little past its outer pavements).
export const townBounds = (town: number) => {
  const [ox, oz] = townCenter(town);
  const hx = R * PX + BX / 2 + 10;
  const hz = R * PZ + BZ / 2 + 10;
  return { minX: ox - hx, maxX: ox + hx, minZ: oz - hz, maxZ: oz + hz };
};
