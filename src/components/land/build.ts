// Builds one town in full detail as a few merged meshes: roads, the central plaza, parks, empty
// pegged plots, and a construction site for every house on the waitlist. A house's look and how far
// along it is come from its house number, so it never changes. Shapes are ported from the reel.
import * as THREE from "three";
import { Builder, C, T, roofTpl, rot, type Tpl } from "./geo";
import {
  ASPHALT,
  BX,
  BZ,
  DOORS,
  FH,
  LAWN,
  LW,
  PER_ROW,
  PX,
  PZ,
  ROAD,
  ROOFS,
  TOWN_HALF,
  TOWN_RINGS,
  WALK,
  WALLS,
  Y0,
  hashStr,
  isPark,
  isPlaza,
  lotAt,
  lotForPlot,
  pick,
  ringOf,
  rng,
  townCenter,
  type Lot,
  type Row,
} from "./layout";

const LEAF = ["#5DAE45", "#6CBB4C", "#4F9F3D", "#78C257", "#64B04A"];
const PINE = ["#3E8E4A", "#2F7D45", "#47975A"];
const HEDGE = "#4E9E3E";
const POLE = "#3C4148";

// Building-site colours.
const CONCRETE = "#C9C3B7";
const SLAB = "#B5AFA4";
const TIMBER = "#C99A5B";
const TUBE = "#9AA4AE";
const PLANK = "#B98B55";
const FENCE = "#F08A3C";
const HOLE = "#40454D";
const DIRT = "#C8AD83";
const BRICK = "#B4573F";
const SAND = "#DCC38C";
export const CRANE = "#F2B705";

export type Adder = Pick<Builder, "add" | "addE">;

// Places a sub-model (built around its own origin) at (ox, oy, oz) with uniform scale s.
export const placed = (b: Adder, ox: number, oy: number, oz: number, s: number): Adder => ({
  add: (t: Tpl, x, y, z, sx, sy, sz, ry, col) => b.add(t, ox + x * s, oy + y * s, oz + z * s, sx * s, sy * s, sz * s, ry, col),
  addE: (t: Tpl, x, y, z, sx, sy, sz, ax, ay, az, col) =>
    b.addE(t, ox + x * s, oy + y * s, oz + z * s, sx * s, sy * s, sz * s, ax, ay, az, col),
});

// Same, turned by ry around the vertical axis.
const turned = (b: Adder, ox: number, oy: number, oz: number, ry: number): Adder => ({
  add: (t: Tpl, x, y, z, sx, sy, sz, r, col) => {
    const [dx, dz] = rot(x, z, ry);
    b.add(t, ox + dx, oy + y, oz + dz, sx, sy, sz, r + ry, col);
  },
  addE: (t: Tpl, x, y, z, sx, sy, sz, ax, ay, az, col) => {
    const [dx, dz] = rot(x, z, ry);
    b.addE(t, ox + dx, oy + y, oz + dz, sx, sy, sz, ax, ay + ry, az, col);
  },
});

export const addTree = (b: Adder, x: number, y: number, z: number, s: number, r: () => number) => {
  b.add(T.cyl, x, y + 1.6 * s, z, 0.3 * s, 3.2 * s, 0.3 * s, 0, C("#7A4E2D"));
  b.add(T.ico, x, y + 4.7 * s, z, 2.2 * s, 2.3 * s, 2.2 * s, r() * 6, C(pick(r, LEAF)));
};

const addPine = (b: Adder, x: number, y: number, z: number, s: number, r: () => number) => {
  b.add(T.cyl, x, y + 0.6 * s, z, 0.25 * s, 1.2 * s, 0.25 * s, 0, C("#6E4528"));
  const col = C(pick(r, PINE));
  b.add(T.cone, x, y + 3.2 * s, z, 1.7 * s, 4.4 * s, 1.7 * s, r() * 6, col);
  b.add(T.cone, x, y + 5.2 * s, z, 1.15 * s, 3.0 * s, 1.15 * s, r() * 6, col);
};

const addBush = (b: Adder, x: number, y: number, z: number, s: number, r: () => number) =>
  b.add(T.ico, x, y + 0.7 * s, z, 1.1 * s, 0.9 * s, 1.1 * s, r() * 6, C(pick(r, LEAF)));

const addLamp = (b: Adder, x: number, y: number, z: number) => {
  b.add(T.cyl, x, y + 2.3, z, 0.11, 4.6, 0.11, 0, C(POLE));
  b.add(T.box, x, y + 4.75, z, 0.5, 0.4, 0.5, 0, C("#FFF3C4"));
  b.add(T.box, x, y + 5.0, z, 0.62, 0.1, 0.62, 0, C(POLE));
};

const addBench = (b: Adder, x: number, y: number, z: number, ry: number) => {
  const P = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: string) => {
    const [ox, oz] = rot(lx, lz, ry);
    b.add(T.box, x + ox, y + ly, z + oz, sx, sy, sz, ry, C(col));
  };
  P(0, 0.5, 0, 2.2, 0.14, 0.7, "#9A6A43");
  P(0, 0.85, -0.32, 2.2, 0.5, 0.1, "#9A6A43");
  P(-0.9, 0.24, 0, 0.12, 0.48, 0.6, POLE);
  P(0.9, 0.24, 0, 0.12, 0.48, 0.6, POLE);
};

// ---------- houses being built ----------

type RoofKind = "gable" | "hip" | "flat";
export type Stage = 0 | 1 | 2; // 0: foundations + frame, 1: walls going up, 2: roof going on

export type HouseSpec = {
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  floors: number;
  rh: number;
  roof: RoofKind;
  wall: string;
  roofC: string;
  door: string;
  stage: Stage;
  wallH: number; // how high the walls are so far
  frameTop: number; // top of the frame / the floor being worked on
  detail: boolean;
};

export const YARD = (d: number) => BZ / 2 - 1.6 - 8 - d / 2 - 0.6;

// The same house number always gets the same house at the same stage.
export const houseSpec = (plot: number, lot: Lot, x: number, z: number): HouseSpec => {
  const r = rng(hashStr(`house:${plot}`));
  const ring = lot.ring;
  const floors = ring <= 1 ? pick(r, [2, 2, 3, 2, 3]) : ring <= 3 ? pick(r, [1, 2, 2, 2]) : pick(r, [1, 1, 2, 2]);
  const roof: RoofKind =
    floors === 3
      ? r() < 0.55
        ? "flat"
        : "hip"
      : pick(r, ring <= 3 ? (["gable", "gable", "hip", "flat"] as const) : (["gable", "gable", "hip"] as const));
  const w = Math.max(7.2, LW - 1.5 - r() * 1.3);
  const d = 7.6 + r() * 1.4;
  const rh = roof === "gable" ? 2.5 + r() * 1.1 : roof === "hip" ? 1.8 + r() * 1.3 : 0;
  const wall = pick(r, WALLS);
  const roofC = pick(r, ROOFS);
  const door = pick(r, DOORS);
  const sr = r();
  const stage: Stage = sr < 0.3 ? 0 : sr < 0.72 ? 1 : 2;
  const bodyH = floors * FH;
  const f = stage === 0 ? 0.18 + r() * 0.22 : stage === 1 ? 0.5 + r() * 0.4 : 1;
  const wallH = stage === 2 ? bodyH : Math.min(bodyH, Math.max(1.1, bodyH * f));
  const frameTop = stage === 2 ? bodyH : Math.min(bodyH, (Math.floor(wallH / FH + 1e-6) + 1) * FH);
  return { x, z, rot: lot.rot, w, d, floors, rh, roof, wall, roofC, door, stage, wallH, frameTop, detail: ring <= 2 };
};

// Highest point of a house site (roof ridge, or the scaffold's guard rail).
export const siteTop = (h: HouseSpec) =>
  Y0 + 0.4 + (h.stage === 2 ? h.floors * FH + (h.roof === "flat" ? 0.9 : h.rh + 0.3) : h.frameTop + 1.0);

// Evenly spaced positions from -span/2 to span/2, at most `gap` apart.
const spread = (span: number, gap: number) => {
  const n = Math.max(1, Math.ceil(span / gap));
  return Array.from({ length: n + 1 }, (_, k) => -span / 2 + (k * span) / n);
};

// One house under construction; its front faces local +z. yard = distance from the front wall to the
// lot's front edge.
const addSite = (b: Adder, h: HouseSpec, yard: number, lw: number, r: () => number) => {
  const { x, z, rot: ry, w, d, floors, rh, wallH, frameTop, detail } = h;
  const P = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: string, tpl = T.box, extra = 0) => {
    const [ox, oz] = rot(lx, lz, ry);
    b.add(tpl, x + ox, Y0 + ly, z + oz, sx, sy, sz, ry + extra, C(col));
  };
  const bodyH = floors * FH;
  const tw = 0.3;

  // Bare earth around the house, then the foundation slab.
  P(0, 0.04, 0.7, Math.min(w + 3.4, lw - 0.3), 1, d + 4.6, DIRT, T.quadY);
  P(0, 0.2, 0, w + 0.5, 0.4, d + 0.5, CONCRETE);

  // Walls so far (a hollow shell, so from above you see into the rooms).
  const wy = 0.4 + wallH / 2;
  P(0, wy, d / 2 - tw / 2, w, wallH, tw, h.wall);
  P(0, wy, -d / 2 + tw / 2, w, wallH, tw, h.wall);
  P(-w / 2 + tw / 2, wy, 0, tw, wallH, d - 2 * tw, h.wall);
  P(w / 2 - tw / 2, wy, 0, tw, wallH, d - 2 * tw, h.wall);

  // Floor slabs that are already poured.
  for (let f = 1; f <= floors; f++) {
    const y = f * FH;
    if (y > frameTop + 1e-6 || (f === floors && h.stage < 2)) break;
    P(0, 0.4 + y - 0.1, 0, w - 0.06, 0.2, d - 0.06, SLAB);
  }

  // Timber frame above the walls, up to the floor being built.
  if (frameTop > wallH + 0.05) {
    const ph = frameTop - wallH;
    const py = 0.4 + wallH + ph / 2;
    const xs = detail ? spread(w - 0.24, 2.6) : [-(w - 0.24) / 2, (w - 0.24) / 2];
    const zs = detail ? spread(d - 0.24, 2.8) : [-(d - 0.24) / 2, (d - 0.24) / 2];
    for (const u of xs) {
      P(u, py, d / 2 - 0.12, 0.24, ph, 0.24, TIMBER);
      P(u, py, -d / 2 + 0.12, 0.24, ph, 0.24, TIMBER);
    }
    for (const v of zs.slice(1, -1)) {
      P(-w / 2 + 0.12, py, v, 0.24, ph, 0.24, TIMBER);
      P(w / 2 - 0.12, py, v, 0.24, ph, 0.24, TIMBER);
    }
    const by = 0.4 + frameTop - 0.12;
    P(0, by, d / 2 - 0.12, w, 0.24, 0.24, TIMBER);
    P(0, by, -d / 2 + 0.12, w, 0.24, 0.24, TIMBER);
    P(-w / 2 + 0.12, by, 0, 0.24, 0.24, d, TIMBER);
    P(w / 2 - 0.12, by, 0, 0.24, 0.24, d, TIMBER);
  }

  // Window and door openings in the finished part of the walls.
  const du = w > 9.6 ? -w * 0.2 : -w * 0.16;
  const nF = Math.max(2, Math.floor((w - 1) / 2.5));
  const us = (n: number, span: number) => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * (span / n));
  const hole = (face: "F" | "B" | "L" | "R", u: number, ly: number) => {
    const ext = face === "F" ? 0 : face === "B" ? Math.PI : face === "L" ? -Math.PI / 2 : Math.PI / 2;
    const off = (face === "F" || face === "B" ? d / 2 : w / 2) + 0.03;
    const [lx, lz] = rot(u, off, ext);
    P(lx, ly, lz, 1.15, 1.35, 1, HOLE, T.quadZ, ext);
  };
  for (let f = 0; f < floors; f++) {
    const ly = 0.4 + FH * f + 1.6;
    if (ly + 0.75 > 0.4 + wallH) break;
    for (const u of us(nF, w)) {
      if (!(f === 0 && Math.abs(u - du) < 1.6)) hole("F", u, ly);
      if (detail) hole("B", u, ly);
    }
    hole("L", 0, ly);
    hole("R", 0, ly);
  }
  if (wallH >= 2.4) P(du, 0.4 + 1.12, d / 2 + 0.03, 1.1, 2.2, 1, HOLE, T.quadZ);

  // Roof going on: rafters, a ridge beam, and part of one slope already covered.
  if (h.stage === 2) {
    const top = 0.4 + bodyH;
    if (h.roof === "flat") {
      P(0, top + 0.3, d / 2 - 0.12, w, 0.6, 0.24, h.wall);
      P(0, top + 0.3, -d / 2 + 0.12, w, 0.6, 0.24, h.wall);
      P(-w / 2 + 0.12, top + 0.3, 0, 0.24, 0.6, d, h.wall);
      P(w / 2 - 0.12, top + 0.3, 0, 0.24, 0.6, d, h.wall);
      const cw = w * (0.35 + r() * 0.4);
      P(-w / 2 + cw / 2 + 0.2, 0.4 + bodyH + 0.04, 0, cw, 1, d - 0.5, h.roofC, T.quadY);
    } else {
      const half = d / 2;
      const Ls = Math.hypot(rh, half);
      const a = Math.atan2(rh, half);
      const n = Math.max(3, Math.round(w / (detail ? 1.2 : 2.2)));
      for (let k = 0; k < n; k++) {
        const u = -w / 2 + 0.15 + (k * (w - 0.3)) / (n - 1);
        for (const sgn of [1, -1]) {
          const [ox, oz] = rot(u, (sgn * half) / 2, ry);
          b.addE(T.box, x + ox, Y0 + top + rh / 2, z + oz, 0.16, 0.22, Ls + 0.3, sgn * a, ry, 0, C(TIMBER));
        }
      }
      P(0, top + rh, 0, w + 0.3, 0.24, 0.24, TIMBER);
      if (r() < 0.75) {
        const cw = w * (0.35 + r() * 0.45);
        const sgn = r() < 0.5 ? 1 : -1;
        const lift = 0.19; // half a rafter + half a board, along the slope's normal
        const [ox, oz] = rot(-w / 2 + cw / 2, sgn * (half / 2 + (lift * rh) / Ls), ry);
        b.addE(T.box, x + ox, Y0 + top + rh / 2 + (lift * half) / Ls, z + oz, cw + 0.3, 0.16, Ls + 0.5, sgn * a, ry, 0, C(h.roofC));
      }
    }
  }

  // Scaffolding across the front (and down one side on the bigger houses near the plaza): a plank
  // deck at every floor so far, a guard rail a metre above each deck.
  const sTop = frameTop + 1.0;
  const sH = 0.4 + sTop; // the tubes stand on the ground beside the slab
  const decks: number[] = [];
  for (let y = FH; y <= frameTop + 1e-6; y += FH) decks.push(y);
  const n1 = d / 2 + 0.45;
  const n2 = d / 2 + 1.45;
  for (const u of spread(w + 0.8, 2.4)) {
    P(u, sH / 2, n1, 0.12, sH, 0.12, TUBE);
    P(u, sH / 2, n2, 0.12, sH, 0.12, TUBE);
  }
  P(0, 1.9, n2, w + 0.9, 0.1, 0.1, TUBE);
  for (const y of decks) {
    P(0, 0.4 + y, n2, w + 0.9, 0.1, 0.1, TUBE);
    P(0, 0.4 + y + 1.0, n2, w + 0.9, 0.1, 0.1, TUBE);
    if (detail) P(0, 0.4 + y, n1, w + 0.9, 0.1, 0.1, TUBE);
    P(0, 0.4 + y + 0.09, (n1 + n2) / 2, w + 0.8, 0.08, 1.1, PLANK);
  }
  if (detail) {
    // Always on the house's own right, so neighbours' side scaffolds never face each other.
    const m1 = w / 2 + 0.38;
    const m2 = w / 2 + 0.78;
    for (const v of spread(d, 2.6)) {
      P(m1, sH / 2, v, 0.1, sH, 0.1, TUBE);
      P(m2, sH / 2, v, 0.1, sH, 0.1, TUBE);
    }
    for (const y of decks) {
      P(m2, 0.4 + y, 0, 0.1, 0.1, d + 0.2, TUBE);
      P(m2, 0.4 + y + 1.0, 0, 0.1, 0.1, d + 0.2, TUBE);
      P((m1 + m2) / 2, 0.4 + y + 0.09, 0, 0.5, 0.08, d, PLANK);
    }
    // A diagonal brace on the front.
    const span = w + 0.8;
    const len = Math.hypot(span, sH);
    const [ox, oz] = rot(0, n2 + 0.08, ry);
    b.addE(T.box, x + ox, Y0 + sH / 2, z + oz, len, 0.08, 0.08, 0, ry, Math.atan2(sH, span), C(TUBE));
  }

  // The yard: a pallet of bricks, a sand pile, cones at the gate, and an orange site fence.
  const side = du < 0 ? 1 : -1;
  const yz = d / 2 + Math.min(3.1, yard - 1.6);
  if (yard > 2.6) {
    const bx = side * Math.min(w * 0.28, lw / 2 - 1.4);
    P(bx, 0.08, yz, 1.3, 0.16, 1.0, "#9A6A43");
    P(bx, 0.56, yz, 1.2, 0.8, 0.9, BRICK);
    const sx = side * Math.min(w * 0.28 - 1.9, lw / 2 - 3.2);
    P(sx, 0.45, yz + 0.3, 1.3, 0.9, 1.2, SAND, T.cone, r() * 6);
  }
  const fz = d / 2 + yard - 0.3;
  for (const g of [-1, 1]) P(du + g * 0.95, 0.3, fz - 0.5, 0.26, 0.6, 0.26, FENCE, T.cone);
  const fa = -lw / 2 + 0.4;
  const fb = lw / 2 - 0.4;
  if (du - 0.8 - fa > 0.5) P((fa + du - 0.8) / 2, 0.55, fz, du - 0.8 - fa, 1.0, 0.06, FENCE);
  if (fb - du - 0.8 > 0.5) P((du + 0.8 + fb) / 2, 0.55, fz, fb - du - 0.8, 1.0, 0.06, FENCE);
  if (yard > 1) P(du, 0.04, d / 2 + 0.6 + yard / 2, 1.3, 0.08, yard, "#D6CBB4");

  const tp = (lx: number, lz: number): [number, number] => {
    const [ox, oz] = rot(lx, lz, ry);
    return [x + ox, z + oz];
  };
  if (r() < 0.45) {
    const [tx, tz] = tp((r() - 0.5) * w * 0.7, -d / 2 - 3.2);
    addTree(b, tx, Y0, tz, 0.9 + r() * 0.3, r);
  }
};

// ---------- tower crane (its own origin is the foot of the mast) ----------

export const CRANE_JIB = 15;
export const craneHeight = (floors: number) => 18 + floors * 2;

export const addCraneMast = (b: Adder, height: number) => {
  b.add(T.box, 0, 0.3, 0, 2.4, 0.6, 2.4, 0, C(CONCRETE));
  b.add(T.box, 0, height / 2, 0, 1.0, height, 1.0, 0, C(CRANE));
  for (let y = 2; y < height - 1; y += 2.4) b.add(T.box, 0, y, 0, 1.12, 0.14, 1.12, 0, C("#C99300"));
};

// The turning top, built at the top of the mast, jib along +x.
export const addCraneTop = (b: Adder) => {
  const Y = C(CRANE);
  b.add(T.box, 0, 0.4, 0, 1.5, 0.8, 1.5, 0, Y);
  b.add(T.box, 0.2, 0.2, 1.25, 1.4, 1.4, 1.2, 0, Y);
  b.add(T.box, 0.2, 0.35, 1.87, 1.2, 0.8, 0.05, 0, C("#7FA9C4"));
  b.add(T.box, 0, 2.8, 0, 0.6, 4.0, 0.6, 0, Y);
  b.add(T.box, CRANE_JIB / 2 + 0.4, 1.2, 0, CRANE_JIB, 0.8, 0.8, 0, Y);
  b.add(T.box, -3.6, 1.1, 0, 6.4, 0.5, 0.9, 0, Y);
  b.add(T.box, -5.8, 0.4, 0, 1.6, 1.6, 1.5, 0, C(CONCRETE));
  const tie = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    b.addE(T.box, (x1 + x2) / 2, (y1 + y2) / 2, 0, len, 0.1, 0.1, 0, 0, Math.atan2(y2 - y1, x2 - x1), C("#5A5F66"));
  };
  tie(0, 4.7, CRANE_JIB * 0.7, 1.6);
  tie(0, 4.7, -6.4, 1.35);
};

// The hook gear hangs from a point just under the jib (HOOK_Y in the turning top's coordinates):
// the trolley sits above that point, the cable is 1 m long downwards (scale it in y for the real
// length), and the load is built below its own origin (move it to the cable's end).
export const HOOK_Y = 0.44;
export const addCraneTrolley = (b: Adder) => {
  b.add(T.box, 0, 0.18, 0, 1.0, 0.36, 1.0, 0, C("#5A5F66"));
};
export const addCraneCable = (b: Adder) => {
  b.add(T.box, 0, -0.5, 0, 0.06, 1, 0.06, 0, C("#2F3338"));
};
export const addCraneLoad = (b: Adder) => {
  b.add(T.box, 0, -0.3, 0, 0.5, 0.6, 0.4, 0, C("#3A3F45"));
  b.add(T.box, 0, -0.75, 0, 1.6, 0.14, 1.2, 0, C("#9A6A43"));
  b.add(T.box, 0, -1.25, 0, 1.4, 0.9, 1.0, 0, C(BRICK));
};
export const LOAD_DROP = 1.7; // from the cable's end to the bottom of the load

// Where a lot's crane stands, relative to the house centre (behind the house, on one side).
export const craneSpot = (h: Pick<HouseSpec, "d" | "rot">, side: number): [number, number] =>
  rot(side * (LW / 2 - 1.1), -h.d / 2 - 1.9, h.rot);

const addStaticCrane = (b: Adder, h: HouseSpec, r: () => number) => {
  const [mx, mz] = craneSpot(h, r() < 0.5 ? -1 : 1);
  const H = craneHeight(h.floors);
  addCraneMast(placed(b, h.x + mx, Y0, h.z + mz, 1), H);
  const top = turned(b, h.x + mx, Y0 + H, h.z + mz, r() * Math.PI * 2);
  addCraneTop(top);
  const tx = 5 + r() * 8;
  const cable = 3 + r() * 4;
  addCraneTrolley(placed(top, tx, HOOK_Y, 0, 1));
  top.add(T.box, tx, HOOK_Y - cable / 2, 0, 0.06, cable, 0.06, 0, C("#2F3338"));
  addCraneLoad(placed(top, tx, HOOK_Y - cable, 0, 1));
};

// ---------- town pieces ----------

const blockBase = (b: Adder, cx: number, cz: number, top: string) => {
  b.add(T.box, cx, 0.15, cz, BX, 0.3, BZ, 0, C(WALK));
  b.add(T.box, cx, 0.36, cz, BX - 3.2, 0.12, BZ - 3.2, 0, C(top));
};

const parkBlock = (b: Adder, cx: number, cz: number, seed: string) => {
  blockBase(b, cx, cz, "#8ED061");
  const r = rng(hashStr(`park${seed}`));
  const n = 30;
  for (let s = 0; s < n; s++) {
    const a = (s / n) * Math.PI * 2;
    const a2 = ((s + 1) / n) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * 19;
    const z1 = cz + Math.sin(a) * 12.5;
    const x2 = cx + Math.cos(a2) * 19;
    const z2 = cz + Math.sin(a2) * 12.5;
    const len = Math.hypot(x2 - x1, z2 - z1) + 0.3;
    b.add(T.box, (x1 + x2) / 2, 0.43, (z1 + z2) / 2, len, 0.06, 2.2, Math.atan2(-(z2 - z1), x2 - x1), C("#EADFC4"));
  }
  b.add(T.disc, cx, 0.44, cz, 7.8, 0.12, 5.2, 0, C("#D9D2C2"));
  b.add(T.disc, cx, 0.49, cz, 7.0, 0.12, 4.5, 0, C("#6FC0E6"));
  for (let t = 0; t < 16; t++) {
    const a = r() * Math.PI * 2;
    const rr = r() < 0.5 ? 0.25 + r() * 0.35 : 1.25 + r() * 0.25;
    const x = cx + Math.cos(a) * 19 * rr;
    const z = cz + Math.sin(a) * 12.5 * rr;
    if (Math.abs(x - cx) > BX / 2 - 3 || Math.abs(z - cz) > BZ / 2 - 3) continue;
    if (Math.hypot((x - cx) / 8.5, (z - cz) / 6) < 1) continue;
    if (r() < 0.7) addTree(b, x, Y0, z, 0.9 + r() * 0.4, r);
    else addPine(b, x, Y0, z, 0.9 + r() * 0.3, r);
  }
  for (const a of [0.4, 2.0, 3.6, 5.2]) addBench(b, cx + Math.cos(a) * 16.5, Y0, cz + Math.sin(a) * 10.5, -a - Math.PI / 2);
};

// Clock tower, origin at its base centre.
const addClockTower = (b: Adder) => {
  const CR = "#F0DDB0";
  b.add(T.box, 0, 0.5, 0, 6.4, 1.0, 6.4, 0, C("#D8CDB4"));
  b.add(T.box, 0, 11, 0, 5, 20, 5, 0, C(CR));
  for (const y of [6.5, 13.5, 21]) b.add(T.box, 0, y, 0, 5.5, 0.45, 5.5, 0, C("#E3C68E"));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(T.box, sx * 2.5, 11, sz * 2.5, 0.6, 20, 0.6, 0, C("#E7CF9C"));
  for (let f = 0; f < 4; f++) {
    const ay = (f * Math.PI) / 2;
    for (const y of [9.5, 16.5]) {
      const [ox, oz] = rot(0, 2.52, ay);
      b.add(T.box, ox, y, oz, 1.0, 2.4, 0.1, ay, C("#3C5878"));
      const [ax, az] = rot(0, 2.55, ay);
      b.add(T.box, ax, y - 1.3, az, 1.4, 0.16, 0.2, ay, C("#E3C68E"));
    }
  }
  b.add(T.box, 0, 2.4, 2.53, 1.6, 2.8, 0.12, 0, C("#6B4A2E"));
  b.add(T.box, 0, 23.5, 0, 5.8, 5, 5.8, 0, C("#F3E2B8"));
  b.add(T.box, 0, 26.1, 0, 6.2, 0.4, 6.2, 0, C("#E3C68E"));
  for (let f = 0; f < 4; f++) {
    const ay = (f * Math.PI) / 2;
    const at = (n: number): [number, number] => rot(0, 2.9 + n, ay);
    let [x, z] = at(0.04);
    b.addE(T.disc, x, 23.5, z, 2.25, 0.1, 2.25, Math.PI / 2, ay, 0, C("#C9A24A"));
    [x, z] = at(0.1);
    b.addE(T.disc, x, 23.5, z, 2.0, 0.1, 2.0, Math.PI / 2, ay, 0, C("#FFFDF5"));
    for (const [ang, len, wd] of [
      [0.9, 1.1, 0.2],
      [-0.6, 1.6, 0.13],
    ] as [number, number, number][]) {
      const [hx, hz] = rot(Math.sin(ang) * len * 0.5, 2.9 + 0.17, ay);
      b.addE(T.box, hx, 23.5 + Math.cos(ang) * len * 0.5, hz, wd, len, 0.05, 0, ay, -ang, C("#2A2A2A"));
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(T.box, sx * 2.5, 27.9, sz * 2.5, 0.75, 3.2, 0.75, 0, C(CR));
  b.add(T.cone, 0, 27.6, 0, 1.0, 1.4, 1.0, 0, C("#D8A93A"));
  b.add(T.box, 0, 29.7, 0, 6.4, 0.45, 6.4, 0, C("#E3C68E"));
  b.add(T.box, 0, 29.95, 0, 6.6, 0.5, 6.6, 0, C("#B83C30"));
  b.add(roofTpl(0), 0, 30.1, 0, 6.6, 8.5, 6.6, 0, C("#D2483A"));
  b.add(T.ico1, 0, 39, 0, 0.45, 0.45, 0.45, 0, C("#E2B23C"));
  b.add(T.cyl, 0, 39.9, 0, 0.06, 1.6, 0.06, 0, C("#E2B23C"));
};

// Lighthouse, origin at its base centre.
const addLighthouse = (b: Adder) => {
  b.add(T.disc, 0, 0.5, 0, 3.9, 1.0, 3.9, 0, C("#D8D2C4"));
  let r = 3.1;
  let y = 1;
  for (let s = 0; s < 6; s++) {
    b.add(T.taper, 0, y + 1.7, 0, r, 3.4, r, 0, C(s % 2 ? "#F5F1EA" : "#D9473B"));
    if (s % 2 === 1) b.add(T.box, 0, y + 1.7, r * 0.97, 0.7, 1.1, 0.1, 0, C("#33465E"));
    y += 3.4;
    r *= 0.95;
  }
  b.add(T.disc, 0, y + 0.2, 0, 3.2, 0.4, 3.2, 0, C("#3A3F45"));
  b.add(T.cyl, 0, y + 0.8, 0, 3.0, 0.8, 3.0, 0, C("#3A3F45"));
  b.add(T.disc, 0, y + 1.6, 0, 1.75, 2.4, 1.75, 0, C("#FFE9A0"));
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * Math.PI * 2;
    b.add(T.box, Math.cos(a) * 1.8, y + 1.6, Math.sin(a) * 1.8, 0.16, 2.4, 0.16, 0, C("#3A3F45"));
  }
  b.add(T.cone, 0, y + 3.8, 0, 2.2, 2.0, 2.2, 0, C("#C8402F"));
  b.add(T.ico1, 0, y + 5.0, 0, 0.35, 0.35, 0.35, 0, C("#3A3F45"));
};

const addFlowerBed = (b: Adder, seed: number) => {
  const r = rng(seed);
  b.add(T.box, 0, 0.3, 0, 3.8, 0.6, 2.8, 0, C("#B8735A"));
  b.add(T.box, 0, 0.32, 0, 3.3, 0.62, 2.3, 0, C("#6E4B33"));
  const FL = ["#E8505B", "#F7C548", "#F28AB2", "#FFFFFF", "#B565D9", "#FF8A3D"];
  for (let t = 0; t < 22; t++) {
    const x = (r() - 0.5) * 2.9;
    const z = (r() - 0.5) * 1.9;
    b.add(T.ico, x, 0.85, z, 0.32, 0.3, 0.32, r() * 6, C(r() < 0.35 ? "#4E9E3E" : pick(r, FL)));
  }
};

// The central plaza, built around (0, 0); place it with `placed`.
const plazaBlock = (b: Adder) => {
  blockBase(b, 0, 0, "#E7DDC8");
  for (let gx = 0; gx < 13; gx++)
    for (let gz = 0; gz < 9; gz++) {
      if ((gx + gz) % 2) continue;
      b.add(T.quadY, -24 + gx * 4, 0.45, -16 + gz * 4, 3.9, 1, 3.9, 0, C("#DDD0B6"));
    }
  b.add(T.disc, 0, 0.75, 0, 4.4, 0.7, 4.4, 0, C("#D8D2C4"));
  b.add(T.disc, 0, 1.12, 0, 3.8, 0.06, 3.8, 0, C("#79C6EA"));
  b.add(T.disc8, 0, 1.9, 0, 0.5, 1.6, 0.5, 0, C("#D8D2C4"));
  b.add(T.disc, 0, 2.8, 0, 1.7, 0.36, 1.7, 0, C("#D8D2C4"));
  b.add(T.disc, 0, 3.0, 0, 1.45, 0.06, 1.45, 0, C("#8FD3F0"));
  b.add(T.ico1, 0, 3.35, 0, 0.45, 0.6, 0.45, 0, C("#BFE8F8"));
  const r = rng(77);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const gx = sx * 23;
      const gz = sz * 13.5;
      b.add(T.box, gx, 0.55, gz, 8, 0.3, 8, 0, C(LAWN));
      b.add(T.box, gx, 0.75, gz + sz * -3.8, 8, 0.7, 0.6, 0, C(HEDGE));
      b.add(T.box, gx + sx * -3.7, 0.75, gz, 0.6, 0.7, 8, 0, C(HEDGE));
      addTree(b, gx + sx * 1.5, 0.7, gz + sz * 1.2, 1.0, r);
      addBush(b, gx - sx * 1.8, 0.7, gz - sz * 1.0, 1.0, r);
      addBush(b, gx + sx * 2.8, 0.7, gz - sz * 2.0, 0.8, r);
    }
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    addBench(b, Math.cos(a) * 6.8, Y0, Math.sin(a) * 6.8, -a - Math.PI / 2);
  }
  for (let s = 0; s < 8; s++) {
    const a = (s * Math.PI) / 4 + Math.PI / 8;
    addLamp(b, Math.cos(a) * 11.5, Y0, Math.sin(a) * 9.5);
  }
  for (const [x, z] of [
    [-6, -17],
    [6, -17],
    [-6, 17],
    [6, 17],
    [-26, 0],
    [26, 2],
  ] as [number, number][])
    addTree(b, x, Y0, z, 0.9, r);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLamp(b, sx * (BX / 2 - 0.8), 0.3, sz * (BZ / 2 - 0.8));
  addClockTower(placed(b, -14.8, Y0, 12.5, 0.82));
  addLighthouse(placed(b, 14.8, Y0, -12.5, 1));
  [
    [-8.6, 7.6],
    [8.6, 7.6],
    [-8.6, -7.6],
    [8.6, -7.6],
  ].forEach(([x, z], i) => addFlowerBed(placed(b, x, Y0, z, 1), 31 + i));
};

// Tall things in the plaza (clock tower, lighthouse), relative to the town centre, so the camera
// doesn't hide a plot behind them.
export const LANDMARKS = [
  { x: -14.8, z: 12.5, r: 7, h: 36 },
  { x: 14.8, z: -12.5, r: 7, h: 30 },
];

const PAINT_Y = 0.19; // road paint sits 9 cm above the asphalt so it never z-fights

const roadsAndMarks = (b: Builder, dash: Builder, xw: Builder, xwFar: Builder, ox: number, oz: number) => {
  const rings = TOWN_RINGS;
  b.add(T.box, ox, 0.05, oz, 2 * TOWN_HALF.x, 0.1, 2 * TOWN_HALF.z, 0, C(ASPHALT));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = -rings - 1; i <= rings; i++) xs.push(ox + (i + 0.5) * PX);
  for (let j = -rings - 1; j <= rings; j++) zs.push(oz + (j + 0.5) * PZ);
  const paint = C("#F2F0E6");
  for (const xr of xs)
    for (let s = 0; s + 1 < zs.length; s++)
      for (let zz = zs[s] + ROAD / 2 + 5; zz < zs[s + 1] - ROAD / 2 - 4; zz += 5.6)
        dash.add(T.quadY, xr, PAINT_Y, zz + 1.3, 0.3, 1, 2.6, 0, paint);
  for (const zr of zs)
    for (let s = 0; s + 1 < xs.length; s++)
      for (let xx = xs[s] + ROAD / 2 + 5; xx < xs[s + 1] - ROAD / 2 - 4; xx += 5.6)
        dash.add(T.quadY, xx + 1.3, PAINT_Y, zr, 2.6, 1, 0.3, 0, paint);
  const white = C("#F7F6F0");
  const pad = C("#9EA2A8");
  for (const xr of xs)
    for (const zr of zs) {
      for (let s = 0; s < 6; s++) {
        const o = (s - 2.5) * 1.75;
        xw.add(T.quadY, xr + o, PAINT_Y, zr - ROAD / 2 - 1.9, 0.9, 1, 2.8, 0, white);
        xw.add(T.quadY, xr + o, PAINT_Y, zr + ROAD / 2 + 1.9, 0.9, 1, 2.8, 0, white);
        xw.add(T.quadY, xr - ROAD / 2 - 1.9, PAINT_Y, zr + o, 2.8, 1, 0.9, 0, white);
        xw.add(T.quadY, xr + ROAD / 2 + 1.9, PAINT_Y, zr + o, 2.8, 1, 0.9, 0, white);
      }
      // From high up, thin stripes shimmer; each crossing becomes one soft pad instead.
      xwFar.add(T.quadY, xr, PAINT_Y, zr - ROAD / 2 - 1.9, 10.4, 1, 2.8, 0, pad);
      xwFar.add(T.quadY, xr, PAINT_Y, zr + ROAD / 2 + 1.9, 10.4, 1, 2.8, 0, pad);
      xwFar.add(T.quadY, xr - ROAD / 2 - 1.9, PAINT_Y, zr, 2.8, 1, 10.4, 0, pad);
      xwFar.add(T.quadY, xr + ROAD / 2 + 1.9, PAINT_Y, zr, 2.8, 1, 10.4, 0, pad);
    }
};

// Empty plot: white boundary lines, corner pegs near the centre, the odd tree.
const emptyLot = (b: Builder, lot: Lot, clear: boolean) => {
  const LINE = C("#F1ECDC");
  const PEG = C("#F08A3C");
  const z0 = lot.row === "S" ? lot.cz + 0.5 : lot.cz - BZ / 2 + 1.9;
  const z1 = lot.row === "S" ? lot.cz + BZ / 2 - 1.9 : lot.cz - 0.5;
  const x0 = lot.x - LW / 2 + 0.35;
  const x1 = lot.x + LW / 2 - 0.35;
  const y = 0.47;
  const t = 0.22;
  b.add(T.quadY, (x0 + x1) / 2, y, z0, x1 - x0, 1, t, 0, LINE);
  b.add(T.quadY, (x0 + x1) / 2, y, z1, x1 - x0, 1, t, 0, LINE);
  b.add(T.quadY, x0, y, (z0 + z1) / 2, t, 1, z1 - z0, 0, LINE);
  b.add(T.quadY, x1, y, (z0 + z1) / 2, t, 1, z1 - z0, 0, LINE);
  if (lot.ring <= 3)
    for (const [px, pz] of [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ] as [number, number][]) {
      b.add(T.box, px, Y0 + 0.35, pz, 0.14, 0.7, 0.14, 0, C("#E9E1CC"));
      b.add(T.box, px, Y0 + 0.74, pz, 0.18, 0.12, 0.18, 0, PEG);
    }
  if (clear) return;
  const r = rng(hashStr(`empty:${lot.plot}`));
  if (r() < 0.16) addTree(b, lot.x + (r() - 0.5) * LW * 0.6, Y0, (z0 + z1) / 2 + (r() - 0.5) * 6, 0.9 + r() * 0.35, r);
  else if (r() < 0.08) addBush(b, lot.x + (r() - 0.5) * LW * 0.6, Y0, (z0 + z1) / 2, 0.9, r);
};

export type HouseHit = {
  n: number;
  name: string;
  lot: Lot;
  min: THREE.Vector3;
  max: THREE.Vector3;
  top: number;
};

export type OwnBuild = {
  site: THREE.BufferGeometry; // the house being built, around its own origin
  n: number;
  lot: Lot;
  spec: HouseSpec;
  top: number;
};

export type TownBuild = {
  town: number;
  city: THREE.BufferGeometry;
  dash: THREE.BufferGeometry;
  xw: THREE.BufferGeometry;
  xwFar: THREE.BufferGeometry;
  own: OwnBuild | null;
  houses: HouseHit[];
};

// plots: house number -> Instagram username, for this town. mine / focus are house numbers (focus =
// the plot with the pin, kept clear of trees). lite: fewer pieces per site, for phones.
export const buildTown = (
  town: number,
  plots: ReadonlyMap<number, string>,
  mine: number | null,
  focus: number,
  lite = false,
): TownBuild => {
  const [ox, oz] = townCenter(town);
  const b = new Builder();
  const dash = new Builder();
  const xw = new Builder();
  const xwFar = new Builder();
  roadsAndMarks(b, dash, xw, xwFar, ox, oz);

  const houses: HouseHit[] = [];
  let own: OwnBuild | null = null;
  const R = TOWN_RINGS;

  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const cx = ox + i * PX;
      const cz = oz + j * PZ;
      if (isPlaza(i, j)) {
        plazaBlock(placed(b, ox, 0, oz, 1));
        continue;
      }
      if (isPark(i, j)) {
        parkBlock(b, cx, cz, `${town}:${i},${j}`);
        continue;
      }
      blockBase(b, cx, cz, LAWN);
      for (const row of ["S", "N"] as Row[])
        for (let k = 0; k < PER_ROW; k++) {
          const lot = lotAt(town, i, j, row, k);
          const name = plots.get(lot.plot);
          if (name === undefined) {
            emptyLot(b, lot, lot.plot === focus);
            continue;
          }
          if (lot.plot === mine) {
            // Your house is its own mesh (built around its own origin) so it can be built up in front of you.
            const ob = new Builder();
            const spec = houseSpec(lot.plot, lot, 0, 0);
            addSite(ob, spec, YARD(spec.d), LW, rng(hashStr(`site:${lot.plot}`)));
            own = { site: ob.geometry(), n: lot.plot, lot, spec, top: siteTop(spec) };
            houses.push(hitBox(lot.plot, name, lot, spec));
            continue;
          }
          const spec = houseSpec(lot.plot, lot, lot.x, lot.z);
          if (lite) spec.detail = false;
          const r = rng(hashStr(`site:${lot.plot}`));
          addSite(b, spec, YARD(spec.d), LW, r);
          if (spec.stage === 1 && lot.ring >= 2 && r() < 0.05) addStaticCrane(b, spec, r);
          houses.push(hitBox(lot.plot, name, lot, spec));
        }
      if (ringOf(i, j) <= (lite ? 2 : 4))
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLamp(b, cx + sx * (BX / 2 - 0.8), 0.3, cz + sz * (BZ / 2 - 0.8));
    }

  return {
    town,
    city: b.geometry(),
    dash: dash.geometry(),
    xw: xw.geometry(),
    xwFar: xwFar.geometry(),
    own,
    houses,
  };
};

const hitBox = (n: number, name: string, lot: Lot, h: HouseSpec): HouseHit => {
  const top = siteTop(h);
  const hw = h.w / 2 + 1.6;
  const hd = h.d / 2 + 1.6;
  return {
    n,
    name,
    lot,
    min: new THREE.Vector3(lot.x - hw, Y0, lot.z - hd),
    max: new THREE.Vector3(lot.x + hw, top, lot.z + hd),
    top,
  };
};

// Spec of any house, for the far-away towns and for the pin over a house in another town.
export const specForPlot = (plot: number) => {
  const lot = lotForPlot(plot);
  return { lot, spec: houseSpec(plot, lot, lot.x, lot.z) };
};
