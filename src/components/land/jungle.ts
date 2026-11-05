// The jungle around the towns. Every town is ringed by jungle (the old farmland between towns),
// cut by the highways. On each town's east side the street at z = -130 runs out of town onto a
// jungle trail with lanterns, through a gate, to a clearing with a waterhole where the animals
// (src/components/wild/animals.ts) live. The canopy everywhere is instanced (cheap); the trail,
// the clearing's trees, the banyan, bamboo, the watchtower and the undergrowth are only built for
// the town drawn in detail. Nothing here is random at run time, so every screen has the same jungle.
import * as THREE from "three";
import { site } from "@/lib/site";
import type { Extent } from "./country";
import { Builder, C, T, roofTpl, type Tpl } from "./geo";
import { TOWN_HALF, TOWN_PITCH, hashStr, pick, rng, townCenter } from "./layout";
import { townBounds, type Obstacle } from "../people/nav";

// Town coordinates (relative to the town's plaza).
export const JUNGLE = {
  trailZ: -130, // the street between block rows -3 and -2 runs on into the jungle
  gateX: TOWN_HALF.x + 6, // the gate just outside town
  cx: TOWN_HALF.x + 125, // the clearing
  cz: -130,
  r: 40, // grass of the clearing
  walkR: 35, // how far from the waterhole you can walk
  pond: { rx: 12, rz: 8 }, // the waterhole, in the middle of the clearing
  half: 2.5, // half the walkable width of the trail
  rock: { a: -2.3, r: 26, top: 1.0 }, // the tiger's rock (angle, distance from the waterhole, height of its top)
  banyan: { a: 0.15, r: 47 },
  machan: { a: -1.25, r: 39 }, // the watchtower
};

export type JungleSpot = {
  town: number;
  cx: number; // clearing centre, world
  cz: number;
  tz: number; // trail line, world
  x0: number; // where the trail starts (town edge), world
  gateX: number;
};

export const jungleOf = (town: number): JungleSpot => {
  const [ox, oz] = townCenter(town);
  const b = townBounds(town);
  return { town, cx: ox + JUNGLE.cx, cz: oz + JUNGLE.cz, tz: oz + JUNGLE.trailZ, x0: b.maxX - 1, gateX: ox + JUNGLE.gateX };
};

// The waterhole's radius in direction a (an ellipse).
export const pondR = (a: number) => {
  const { rx, rz } = JUNGLE.pond;
  return 1 / Math.sqrt((Math.cos(a) / rx) ** 2 + (Math.sin(a) / rz) ** 2);
};

// A point around the waterhole (angle a, distance r), world.
export const aroundPond = (j: JungleSpot, a: number, r: number): [number, number] => [j.cx + Math.cos(a) * r, j.cz + Math.sin(a) * r];

// ---------- where you can walk ----------

// Keeps a point inside town, on the trail or in the clearing (whichever is nearest).
export const walkClamp = (town: number, x: number, z: number): [number, number] => {
  const b = townBounds(town);
  const j = jungleOf(town);
  const clamp = (v: number, a: number, c: number) => Math.min(c, Math.max(a, v));
  if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return [x, z];
  const tx = clamp(x, j.x0, j.cx);
  const tz = clamp(z, j.tz - JUNGLE.half, j.tz + JUNGLE.half);
  if (tx === x && tz === z) return [x, z];
  const dx = x - j.cx;
  const dz = z - j.cz;
  const dd = Math.hypot(dx, dz);
  if (dd <= JUNGLE.walkR) return [x, z];
  const cands: [number, number][] = [
    [clamp(x, b.minX, b.maxX), clamp(z, b.minZ, b.maxZ)],
    [tx, tz],
    [j.cx + (dx / Math.max(1e-6, dd)) * JUNGLE.walkR, j.cz + (dz / Math.max(1e-6, dd)) * JUNGLE.walkR],
  ];
  let best = cands[0];
  let bd = Infinity;
  for (const c of cands) {
    const d = (c[0] - x) ** 2 + (c[1] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
};

// "town", "trail" or "clearing": where a point is.
export type Zone = "town" | "trail" | "clearing";
export const zoneAt = (town: number, x: number, z: number): Zone => {
  const b = townBounds(town);
  if (x <= b.maxX + 0.5) return "town";
  const j = jungleOf(town);
  return Math.hypot(x - j.cx, z - j.cz) < JUNGLE.r ? "clearing" : "trail";
};

// Things a player bumps into in the jungle (world coordinates).
export const jungleObstacles = (town: number): Obstacle[] => {
  const j = jungleOf(town);
  const [rx, rz] = aroundPond(j, JUNGLE.rock.a, JUNGLE.rock.r);
  const log = logSpot(j);
  return [
    { x: j.cx, z: j.cz, rx: JUNGLE.pond.rx + 0.5, rz: JUNGLE.pond.rz + 0.5 },
    { x: rx, z: rz, r: 2.5 },
    { x: log.x, z: log.z, hx: 3.6, hz: 0.7 },
    { x: j.gateX, z: j.tz - 3.6, r: 0.45 },
    { x: j.gateX, z: j.tz + 3.6, r: 0.45 },
  ];
};

const logSpot = (j: JungleSpot) => {
  const [x, z] = aroundPond(j, 2.15, 27);
  return { x, z };
};

// ---------- the canopy (every town, instanced) ----------

const LEAF = ["#2F6B2A", "#3B7D32", "#2C5E27", "#4A8A3A", "#356F2E", "#41843A", "#27552A", "#4F8F33"];
const SAL = ["#2E6B3A", "#285F35", "#367A3F"];
const BARK = "#5B3A22";
export const FLOOR = "#4F7F37";
const CLEARING = "#7FAE4E";
const MUD = "#9C8158";
export const POND = "#4E9DBF";
const TRAIL = "#A88457";

type InstLike = { add: (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, col: THREE.Color) => void };
export type CanopySink = { crowns: InstLike; pines: InstLike; trunks: InstLike };

// The jungle's outline: the drawn towns plus a band around them, but not the coast.
export const jungleRect = (ext: Extent) => ({
  x0: ext.minX - 260,
  x1: ext.maxX + 260,
  z0: -TOWN_HALF.z - 24,
  z1: ext.maxZ + 260,
});

// Spacing of the canopy trees: denser on computers; spread out when the world gets big, so the
// number of trees stays about the same.
export const canopyGap = (ext: Extent, lowPower: boolean) => {
  const r = jungleRect(ext);
  const towns = (ext.maxGx - ext.minGx + 1) * (ext.maxGz + 1);
  const area = Math.max(1, (r.x1 - r.x0) * (r.z1 - r.z0) - towns * (2 * TOWN_HALF.x) * (2 * TOWN_HALF.z));
  const cap = lowPower ? 7000 : 17000;
  return Math.max(lowPower ? 15 : 11, Math.sqrt(area / cap));
};

const inGrid = (ext: Extent, gx: number, gz: number) => gz >= 0 && gz <= ext.maxGz && gx >= ext.minGx && gx <= ext.maxGx;

// Open ground (no canopy trees): towns and their verges, highways, each town's trail and clearing.
const openGround = (ext: Extent, x: number, z: number) => {
  const gx = Math.round(x / TOWN_PITCH.x);
  const gz = Math.round(z / TOWN_PITCH.z);
  const lx = x - gx * TOWN_PITCH.x;
  const lz = z - gz * TOWN_PITCH.z;
  if (inGrid(ext, gx, gz) && Math.abs(lx) < TOWN_HALF.x + 14 && Math.abs(lz) < TOWN_HALF.z + 14) return true;
  // Highways run along x = gx * 1000 + 34 and z = gz * 800 + 26.
  const hx = x - (Math.round((x - 34) / TOWN_PITCH.x) * TOWN_PITCH.x + 34);
  const hz = z - (Math.round((z - 26) / TOWN_PITCH.z) * TOWN_PITCH.z + 26);
  if (Math.abs(hx) < 17 || (Math.abs(hz) < 17 && z > -TOWN_HALF.z)) return true;
  // The trail and clearing of the town to the west (the jungle east of a town is its own).
  const wx = Math.round((x - JUNGLE.cx) / TOWN_PITCH.x);
  if (inGrid(ext, wx, gz)) {
    const tx = x - wx * TOWN_PITCH.x;
    const tz = z - gz * TOWN_PITCH.z;
    if (tx > TOWN_HALF.x - 4 && tx < JUNGLE.cx && Math.abs(tz - JUNGLE.trailZ) < 7.5) return true;
    if (Math.hypot(tx - JUNGLE.cx, tz - JUNGLE.cz) < JUNGLE.r + 4) return true;
  }
  return false;
};

export type CanopyTree = { x: number; z: number; h: number; s: number; sal: boolean; seed: number };

// The canopy tree in grid cell (i, k), if there is one.
export const canopyTree = (ext: Extent, gap: number, i: number, k: number): CanopyTree | null => {
  const seed = hashStr(`jg:${i},${k}`);
  const r = rng(seed);
  if (r() < 0.1) return null;
  const x = (i + 0.12 + r() * 0.76) * gap;
  const z = (k + 0.12 + r() * 0.76) * gap;
  const rect = jungleRect(ext);
  if (x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1) return null;
  if (openGround(ext, x, z)) return null;
  return { x, z, h: 6 + r() * 6, s: 0.85 + r() * 0.5, sal: r() < 0.18, seed };
};

// Adds one canopy tree to instanced lists (the same shapes for far and near).
const addCanopyTree = (sink: CanopySink, t: CanopyTree, gap: number) => {
  const r = rng(t.seed ^ 0x5bd1e995);
  const k = gap / 11; // trees grow a little when they're spread out, so the canopy stays closed
  if (t.sal) {
    sink.trunks.add(t.x, 1.4 * t.s, t.z, 0.32 * t.s, 2.8 * t.s, 0.32 * t.s, 0, C(BARK));
    const col = C(pick(r, SAL));
    sink.pines.add(t.x, (2.4 + t.h * 0.45) * t.s, t.z, 2.6 * t.s * k, t.h * 0.75 * t.s, 2.6 * t.s * k, r() * 6, col);
    sink.pines.add(t.x, (2.4 + t.h * 0.85) * t.s, t.z, 1.7 * t.s * k, t.h * 0.5 * t.s, 1.7 * t.s * k, r() * 6, col);
    return;
  }
  const h = t.h * t.s;
  sink.trunks.add(t.x, h / 2, t.z, 0.42 * t.s, h, 0.42 * t.s, 0, C(BARK));
  const w = (3.5 + r() * 2) * t.s * k;
  sink.crowns.add(t.x, h + 1.2 * t.s, t.z, w, (2.4 + r() * 1.2) * t.s, w * (0.85 + r() * 0.3), r() * 6, C(pick(r, LEAF)));
  const a = r() * Math.PI * 2;
  const o = w * 0.55;
  sink.crowns.add(t.x + Math.cos(a) * o, h - 0.2 * t.s, t.z + Math.sin(a) * o, w * 0.7, 2 * t.s, w * 0.7, r() * 6, C(pick(r, LEAF)));
};

// The whole canopy, plus the jungle floor, trails, clearings and waterholes of every drawn town.
export const buildCanopy = (b: Builder, sink: CanopySink, ext: Extent, maxTown: number, lowPower: boolean) => {
  const rect = jungleRect(ext);
  const gap = canopyGap(ext, lowPower);
  b.add(T.box, (rect.x0 + rect.x1) / 2, 0.035, (rect.z0 + rect.z1) / 2, rect.x1 - rect.x0, 0.06, rect.z1 - rect.z0, 0, C(FLOOR));
  // Darker and lighter patches on the floor, so it isn't one flat green from above.
  const pr = rng(9090);
  for (let n = 0; n < 420; n++) {
    const x = rect.x0 + pr() * (rect.x1 - rect.x0);
    const z = rect.z0 + pr() * (rect.z1 - rect.z0);
    if (openGround(ext, x, z)) continue;
    const s = 14 + pr() * 30;
    b.add(T.disc, x, 0.072, z, s, 0.004, s * (0.6 + pr() * 0.5), pr() * 3, C(pr() < 0.5 ? "#456F30" : "#5A8A3E"));
  }
  for (let t = 1; t <= maxTown; t++) {
    const j = jungleOf(t);
    const end = j.cx - JUNGLE.r + 2;
    b.add(T.box, (j.x0 - 2 + end) / 2, 0.079, j.tz, end - j.x0 + 2, 0.018, 5.4, 0, C(TRAIL));
    b.add(T.disc, j.cx, 0.088, j.cz, JUNGLE.r, 0.012, JUNGLE.r, 0, C(CLEARING));
    b.add(T.disc, j.cx, 0.098, j.cz, JUNGLE.pond.rx + 2.4, 0.012, JUNGLE.pond.rz + 2.4, 0, C(MUD));
    b.add(T.disc, j.cx, 0.106, j.cz, JUNGLE.pond.rx, 0.012, JUNGLE.pond.rz, 0, C(POND));
  }
  const i0 = Math.floor(rect.x0 / gap);
  const i1 = Math.ceil(rect.x1 / gap);
  const k0 = Math.floor(rect.z0 / gap);
  const k1 = Math.ceil(rect.z1 / gap);
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) {
      const t = canopyTree(ext, gap, i, k);
      if (t) addCanopyTree(sink, t, gap);
    }
};

// Is a point in the jungle's outline (so the farmland leaves it alone)?
export const inJungle = (ext: Extent, x: number, z: number, pad = 0) => {
  const r = jungleRect(ext);
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
};

// ---------- the jungle next to the town drawn in detail ----------

export type Blocker = { x: number; z: number; hx: number; hz: number; top: number };

export type JungleBuild = {
  geo: THREE.BufferGeometry;
  lamps: number[]; // lantern positions (x, y, z), for their glow at night
  blockers: Blocker[]; // tall things the play camera keeps in front of
  flies: Float32Array; // firefly spots (x, y, z)
  sign: { x: number; y: number; z: number };
  spot: JungleSpot;
};

type B = Pick<Builder, "add" | "addE">;

const leafy = (b: B, x: number, y: number, z: number, sx: number, sy: number, sz: number, r: () => number, cols = LEAF, tpl: Tpl = T.ico) =>
  b.add(tpl, x, y, z, sx, sy, sz, r() * 6, C(pick(r, cols)));

const FERN = ["#4F9A3C", "#5DAA45", "#3E8A34", "#6BB24C", "#47933A"];

const addFern = (b: B, x: number, z: number, s: number, r: () => number) => {
  const col = C(pick(r, FERN));
  for (let n = 0; n < 5; n++) {
    const a = (n / 5) * Math.PI * 2 + r();
    b.addE(T.box, x + Math.cos(a) * 0.45 * s, 0.35 * s, z + Math.sin(a) * 0.45 * s, 0.22 * s, 0.05 * s, 1.1 * s, 0.55, -a + Math.PI / 2, 0, col);
  }
};

const addBush = (b: B, x: number, z: number, s: number, r: () => number) => {
  leafy(b, x, 0.55 * s, z, 1.3 * s, 0.9 * s, 1.2 * s, r, FERN);
  if (r() < 0.5) leafy(b, x + 0.7 * s, 0.4 * s, z + 0.3 * s, 0.8 * s, 0.6 * s, 0.8 * s, r, FERN);
  if (r() < 0.25) b.add(T.ico, x + 0.2 * s, 1.0 * s, z - 0.3 * s, 0.14, 0.14, 0.14, 0, C(pick(r, ["#E8505B", "#F7C548", "#FF8A3D", "#F28AB2"])));
};

// A big jungle tree with buttress roots and a vine or two.
const addBigTree = (b: B, x: number, z: number, s: number, r: () => number, blockers: Blocker[]) => {
  const h = (11 + r() * 5) * s;
  b.add(T.disc8, x, h / 2, z, 0.7 * s, h, 0.7 * s, 0, C(BARK));
  for (let n = 0; n < 4; n++) {
    const a = (n / 4) * Math.PI * 2 + r();
    b.addE(T.box, x + Math.cos(a) * 0.9 * s, 0.9 * s, z + Math.sin(a) * 0.9 * s, 0.18 * s, 1.9 * s, 1.5 * s, 0, Math.PI / 2 - a, 0, C("#6A4428"));
  }
  const w = (5 + r() * 2) * s;
  leafy(b, x, h + 1.5 * s, z, w, 3.2 * s, w, r);
  for (let n = 0; n < 3; n++) {
    const a = r() * Math.PI * 2;
    leafy(b, x + Math.cos(a) * w * 0.6, h - 0.4 * s + r() * s, z + Math.sin(a) * w * 0.6, w * 0.62, 2.4 * s, w * 0.62, r);
  }
  for (let n = 0; n < 3; n++) {
    const a = r() * Math.PI * 2;
    const rr = w * (0.4 + r() * 0.5);
    const len = 4 + r() * 5;
    b.add(T.box, x + Math.cos(a) * rr, h - len / 2, z + Math.sin(a) * rr, 0.06, len, 0.06, 0, C("#4C6B2A"));
  }
  blockers.push({ x, z, hx: 1.1 * s, hz: 1.1 * s, top: h + 3 * s });
};

const addPalm = (b: B, x: number, z: number, s: number, r: () => number) => {
  const lean = (r() - 0.5) * 0.3;
  let y = 0;
  let px = x;
  for (let n = 0; n < 4; n++) {
    b.addE(T.disc8, px - Math.sin(lean) * 1.1 * s, y + 1.1 * s, z, 0.24 * s, 2.2 * s, 0.24 * s, 0, 0, lean, C(n % 2 ? "#8A6A45" : "#7A5C3A"));
    y += 2.15 * s;
    px -= Math.sin(lean) * 2.15 * s;
  }
  for (let n = 0; n < 8; n++) {
    const a = (n / 8) * Math.PI * 2 + r() * 0.3;
    b.addE(T.box, px + Math.cos(a) * 1.4 * s, y - 0.1 * s, z + Math.sin(a) * 1.4 * s, 0.6 * s, 0.06 * s, 3.0 * s, 0.45, -a + Math.PI / 2, 0, C(pick(r, ["#5E9E3A", "#4E8E34", "#6AAA44"])));
  }
  b.add(T.ico, px, y, z, 0.45 * s, 0.4 * s, 0.45 * s, 0, C("#6E5A30"));
};

const addBamboo = (b: B, x: number, z: number, r: () => number, blockers: Blocker[]) => {
  for (let n = 0; n < 11; n++) {
    const a = r() * Math.PI * 2;
    const d = r() * 1.6;
    const h = 7 + r() * 4;
    const bx = x + Math.cos(a) * d;
    const bz = z + Math.sin(a) * d;
    b.add(T.disc8, bx, h / 2, bz, 0.1, h, 0.1, 0, C(pick(r, ["#7FA83A", "#6E9A34", "#8DB548"])));
    for (let k = 1; k < 4; k++) b.add(T.disc8, bx, (h * k) / 4, bz, 0.12, 0.08, 0.12, 0, C("#5E8530"));
    leafy(b, bx, h, bz, 1.1, 0.8, 1.1, r, ["#6AAA44", "#5E9E3A", "#7FB84C"]);
  }
  blockers.push({ x, z, hx: 2.2, hz: 2.2, top: 11 });
};

// The banyan: a wide crown on a thick trunk, branches the monkeys sit on and roots hanging down.
export const BANYAN_PERCHES: [number, number, number][] = [
  [-3.6, 7.6, 1.2],
  [3.4, 7.9, -1.6],
  [0.8, 8.2, 3.8],
];

const addBanyan = (b: B, x: number, z: number, r: () => number, blockers: Blocker[]) => {
  b.add(T.disc8, x, 4.5, z, 1.5, 9, 1.5, 0, C("#6F5A44"));
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    b.addE(T.box, x + Math.cos(a) * 1.4, 1.0, z + Math.sin(a) * 1.4, 0.35, 2.2, 1.8, 0, Math.PI / 2 - a, 0, C("#7A644C"));
  }
  for (const [px, py, pz] of BANYAN_PERCHES) {
    const len = Math.hypot(px, pz);
    b.addE(T.box, x + px / 2, py - 0.3, z + pz / 2, 0.45, 0.45, len + 0.6, 0, Math.atan2(px, pz), 0, C("#6F5A44"));
  }
  for (let n = 0; n < 14; n++) {
    const a = r() * Math.PI * 2;
    const d = 2.5 + r() * 6;
    const top = 7.5 + r() * 1.5;
    b.add(T.disc8, x + Math.cos(a) * d, top / 2, z + Math.sin(a) * d, 0.09, top, 0.09, 0, C("#7D6A52"));
  }
  leafy(b, x, 11, z, 9, 3.6, 8, r);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + 0.3;
    leafy(b, x + Math.cos(a) * 6, 9.8 + r(), z + Math.sin(a) * 5.5, 5, 2.8, 5, r);
  }
  blockers.push({ x, z, hx: 2.2, hz: 2.2, top: 14 });
};

// A watchtower on stilts at the edge of the clearing.
const addMachan = (b: B, x: number, z: number, ry: number) => {
  const wood = C("#7A5232");
  const at = (lx: number, lz: number): [number, number] => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  for (const [lx, lz] of [
    [-1.5, -1.5],
    [1.5, -1.5],
    [-1.5, 1.5],
    [1.5, 1.5],
  ] as [number, number][]) {
    const [px, pz] = at(lx, lz);
    b.add(T.disc8, px, 3.0, pz, 0.14, 6.0, 0.14, 0, wood);
  }
  let [px, pz] = at(0, 0);
  b.add(T.box, px, 4.6, pz, 3.6, 0.2, 3.6, ry, C("#9A6A43"));
  for (const [lx, lz, w, d] of [
    [0, -1.75, 3.6, 0.1],
    [0, 1.75, 3.6, 0.1],
    [-1.75, 0, 0.1, 3.6],
  ] as [number, number, number, number][]) {
    [px, pz] = at(lx, lz);
    b.add(T.box, px, 5.25, pz, w, 0.08, d, ry, wood);
  }
  [px, pz] = at(0, 0);
  b.add(roofTpl(0), px, 6.0, pz, 4.4, 1.6, 4.4, ry, C("#C9A25E"));
  // Ladder on the open side.
  for (const s of [-0.35, 0.35]) {
    [px, pz] = at(2.3, s);
    b.addE(T.box, px, 2.3, pz, 0.08, 4.9, 0.08, 0, ry, 0.22, wood);
  }
  for (let k = 0; k < 8; k++) {
    const y = 0.4 + k * 0.55;
    [px, pz] = at(2.3 - Math.tan(0.22) * (y - 2.3), 0);
    b.add(T.box, px, y, pz, 0.06, 0.06, 0.8, ry, wood);
  }
};

// The gate at the start of the trail: two posts, a thatched beam, two lanterns, and the sign.
const addGate = (b: B, x: number, z: number, lamps: number[]) => {
  const wood = C("#6B4426");
  for (const s of [-1, 1]) {
    b.add(T.disc8, x, 2.7, z + s * 3.6, 0.28, 5.4, 0.28, 0, wood);
    b.add(T.box, x, 4.15, z + s * 3.0, 0.32, 0.42, 0.32, 0, C("#FFF3C4"));
    b.add(T.box, x, 4.42, z + s * 3.0, 0.42, 0.08, 0.42, 0, C("#2E2A26"));
    b.add(T.box, x, 4.65, z + s * 3.0, 0.03, 0.4, 0.03, 0, C("#2E2A26"));
    lamps.push(x, 4.15, z + s * 3.0);
  }
  b.add(T.box, x, 5.0, z, 0.45, 0.45, 8.4, 0, wood);
  b.add(roofTpl(0.5), x, 5.2, z, 9.2, 1.1, 1.9, Math.PI / 2, C("#C9A25E"));
  // Sign frame (the writing is a separate textured mesh).
  b.add(T.box, x, 3.55, z, 0.16, 1.5, 4.9, 0, C("#3E2A1A"));
  for (const s of [-1, 1]) b.add(T.box, x, 4.45, z + s * 1.6, 0.06, 0.45, 0.06, 0, C("#2E2A26"));
};

const addLanternPost = (b: B, x: number, z: number, lamps: number[]) => {
  b.add(T.disc8, x, 1.1, z, 0.09, 2.2, 0.09, 0, C("#5A3A22"));
  b.add(T.box, x, 2.3, z, 0.26, 0.32, 0.26, 0, C("#FFF3C4"));
  b.add(T.box, x, 2.5, z, 0.34, 0.07, 0.34, 0, C("#2E2A26"));
  lamps.push(x, 2.3, z);
};

export const buildJungle = (town: number, lowPower: boolean, ext: Extent, gap: number): JungleBuild => {
  const j = jungleOf(town);
  const b = new Builder();
  const r = rng(hashStr(`jungle:${town}`));
  const lamps: number[] = [];
  const blockers: Blocker[] = [];
  const flies: number[] = [];
  const thin = lowPower ? 0.55 : 1;

  addGate(b, j.gateX, j.tz, lamps);
  blockers.push({ x: j.gateX, z: j.tz, hx: 0.6, hz: 4.2, top: 6.5 });

  // The trail: lanterns, stones and roots along it, ferns and big trees either side.
  const trailEnd = j.cx - JUNGLE.r + 2;
  let side = 1;
  for (let x = j.gateX + 14; x < trailEnd - 4; x += 15) {
    addLanternPost(b, x, j.tz + side * 3.3, lamps);
    side = -side;
  }
  for (let x = j.x0 + 2; x < trailEnd; x += 1.6 + r() * 2.4) {
    const s = r() < 0.5 ? -1 : 1;
    b.add(T.ico, x, 0.1, j.tz + s * (2.4 + r() * 0.5), 0.25 + r() * 0.2, 0.14, 0.22 + r() * 0.2, r() * 6, C(pick(r, ["#8C8A84", "#9E9A90", "#7A766E"])));
    if (r() < 0.12) b.addE(T.box, x, 0.1, j.tz, 0.16, 0.08, 5.2, 0, 0.3 * (r() - 0.5), 0, C("#6A4428"));
  }
  for (let x = j.gateX + 4; x < trailEnd; x += 2.2 / thin) {
    for (const s of [-1, 1]) {
      const d = 3.4 + r() * 9;
      const zz = j.tz + s * d;
      if (r() < 0.55) addFern(b, x + r() * 2, zz, 0.9 + r() * 0.6, r);
      else addBush(b, x + r() * 2, zz, 0.8 + r() * 0.7, r);
    }
  }
  for (let x = j.gateX + 9; x < trailEnd - 6; x += 10 + r() * 6) {
    for (const s of [-1, 1]) {
      if (r() < 0.25) continue;
      const zz = j.tz + s * (7.5 + r() * 6);
      if (r() < 0.2) addPalm(b, x, zz, 0.9 + r() * 0.3, r);
      else addBigTree(b, x, zz, 0.75 + r() * 0.4, r, blockers);
    }
  }

  // The clearing: a ring of big trees, the banyan, bamboo, palms; grass tufts, flowers, rocks, a
  // fallen log, the watchtower, and reeds and lotuses in the waterhole.
  for (let n = 0; n < 22; n++) {
    const a = (n / 22) * Math.PI * 2 + (r() - 0.5) * 0.2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.22) continue; // the trail's way in
    if (Math.abs(a - JUNGLE.banyan.a) < 0.35 || Math.abs(a - Math.PI * 2 - JUNGLE.banyan.a) < 0.35) continue;
    const d = JUNGLE.r + 5 + r() * 9;
    const [x, z] = aroundPond(j, a, d);
    const k = r();
    if (k < 0.18) addBamboo(b, x, z, r, blockers);
    else if (k < 0.32) addPalm(b, x, z, 1 + r() * 0.3, r);
    else addBigTree(b, x, z, 0.8 + r() * 0.45, r, blockers);
  }
  for (let n = 0; n < Math.round(110 * thin); n++) {
    const a = r() * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.12) continue;
    const [x, z] = aroundPond(j, a, JUNGLE.r - 2 + r() * 14);
    if (r() < 0.5) addFern(b, x, z, 1 + r() * 0.6, r);
    else addBush(b, x, z, 0.9 + r() * 0.8, r);
  }
  const [bx, bz] = aroundPond(j, JUNGLE.banyan.a, JUNGLE.banyan.r);
  addBanyan(b, bx, bz, r, blockers);
  const [mx, mz] = aroundPond(j, JUNGLE.machan.a, JUNGLE.machan.r);
  addMachan(b, mx, mz, -JUNGLE.machan.a + Math.PI / 2);
  blockers.push({ x: mx, z: mz, hx: 2.3, hz: 2.3, top: 7 });

  for (let n = 0; n < Math.round(90 * thin); n++) {
    const a = r() * Math.PI * 2;
    const d = pondR(a) + 3 + r() * (JUNGLE.r - pondR(a) - 5);
    const [x, z] = aroundPond(j, a, d);
    const col = C(pick(r, ["#8DBF55", "#9CC95E", "#7DB04A", "#A8C96A"]));
    for (let k = 0; k < 3; k++) b.addE(T.cone, x + (r() - 0.5) * 0.4, 0.3, z + (r() - 0.5) * 0.4, 0.09, 0.6 + r() * 0.3, 0.09, (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5, col);
    if (r() < 0.3) b.add(T.ico, x + 0.3, 0.18, z, 0.09, 0.09, 0.09, 0, C(pick(r, ["#F7C548", "#FFFFFF", "#E8505B", "#B565D9"])));
  }
  const [rx, rz] = aroundPond(j, JUNGLE.rock.a, JUNGLE.rock.r);
  b.add(T.ico1, rx, 0.15, rz, 2.6, 1.05, 2.0, 0.4, C("#8C8A84"));
  b.add(T.ico, rx + 1.6, 0.3, rz + 1.2, 0.9, 0.6, 0.8, 1, C("#7A766E"));
  b.add(T.ico, rx - 1.9, 0.25, rz - 0.6, 0.7, 0.45, 0.6, 2, C("#9E9A90"));
  const log = logSpot(j);
  b.addE(T.disc8, log.x, 0.5, log.z, 0.5, 6.6, 0.5, 0, 0, Math.PI / 2, C("#7A5232"));
  b.addE(T.disc8, log.x + 3.32, 0.5, log.z, 0.42, 0.05, 0.42, 0, 0, Math.PI / 2, C("#C9A26A"));
  for (let k = 0; k < 3; k++) addFern(b, log.x - 2 + k * 2, log.z + 0.9, 0.6, r);

  for (let n = 0; n < 34; n++) {
    const a = r() * Math.PI * 2;
    const d = pondR(a) + 0.4 + r() * 1.6;
    const [x, z] = aroundPond(j, a, d);
    for (let k = 0; k < 4; k++) b.addE(T.box, x + (r() - 0.5) * 0.5, 0.65, z + (r() - 0.5) * 0.5, 0.05, 1.2 + r() * 0.6, 0.05, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, C(pick(r, ["#6E8F3A", "#7E9E42", "#5E7F34"])));
  }
  for (let n = 0; n < 26; n++) {
    const a = r() * Math.PI * 2;
    const d = r() * (pondR(a) - 1.5);
    const [x, z] = aroundPond(j, a, d);
    const s = 0.5 + r() * 0.4;
    b.add(T.disc, x, 0.118, z, s, 0.01, s, 0, C(pick(r, ["#3F8A3A", "#4E9A40", "#367F33"])));
    if (r() < 0.45) {
      b.add(T.ico, x, 0.24, z, 0.2, 0.16, 0.2, r() * 6, C(pick(r, ["#F48FB1", "#F7A8C4", "#FFFFFF"])));
      b.add(T.ico, x, 0.31, z, 0.07, 0.06, 0.07, 0, C("#F7C548"));
    }
  }

  // Fireflies: along the trail and round the clearing.
  for (let n = 0; n < (lowPower ? 70 : 150); n++) {
    if (r() < 0.45) {
      flies.push(j.gateX + 6 + r() * (trailEnd - j.gateX - 6), 0.6 + r() * 2.6, j.tz + (r() < 0.5 ? -1 : 1) * (2.5 + r() * 8));
    } else {
      const [x, z] = aroundPond(j, r() * Math.PI * 2, 14 + r() * 32);
      flies.push(x, 0.5 + r() * 2.8, z);
    }
  }

  // Canopy trees right by the trail and the clearing, so the play camera stays in front of them too.
  const i0 = Math.floor((j.x0 - 4) / gap);
  const i1 = Math.ceil((j.cx + JUNGLE.r + 30) / gap);
  const k0 = Math.floor((j.cz - JUNGLE.r - 30) / gap);
  const k1 = Math.ceil((j.cz + JUNGLE.r + 30) / gap);
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) {
      const t = canopyTree(ext, gap, i, k);
      if (!t) continue;
      const nearTrail = t.x < j.cx && Math.abs(t.z - j.tz) < 26;
      const nearClearing = Math.hypot(t.x - j.cx, t.z - j.cz) < JUNGLE.r + 28;
      if (!nearTrail && !nearClearing) continue;
      const w = t.sal ? 2.6 * t.s : 4.5 * t.s;
      blockers.push({ x: t.x, z: t.z, hx: w * 0.7, hz: w * 0.7, top: (t.sal ? 2.4 + t.h * 1.1 : t.h + 2.5) * t.s });
    }

  return {
    geo: b.geometry(),
    lamps,
    blockers,
    flies: new Float32Array(flies),
    sign: { x: j.gateX - 0.1, y: 3.55, z: j.tz },
    spot: j,
  };
};

// The writing on the gate's sign, both faces (town side and jungle side).
export const gateSignTex = (town: number, font: string, side: "town" | "jungle") => {
  const cv = document.createElement("canvas");
  cv.width = 768;
  cv.height = 232;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#6B4426";
  g.fillRect(0, 0, 768, 232);
  g.strokeStyle = "#3E2A1A";
  g.lineWidth = 14;
  g.strokeRect(7, 7, 754, 218);
  g.fillStyle = "#FFF3D6";
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (side === "town") {
    g.font = `900 92px ${font}`;
    g.fillText("JUNGLE TRAIL", 384, 92, 720);
    g.font = `800 38px ${font}`;
    g.fillStyle = "#F7C631";
    g.fillText("TIGERS · ELEPHANTS · DEER · MONKEYS · PEACOCKS", 384, 172, 720);
  } else {
    g.font = `900 92px ${font}`;
    g.fillText(`TO ${site.townName(town).toUpperCase()}`, 384, 92, 720);
    g.font = `800 38px ${font}`;
    g.fillStyle = "#F7C631";
    g.fillText("STAY ON THE TRAIL AFTER DARK", 384, 172, 720);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

