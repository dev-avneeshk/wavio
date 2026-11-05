// Builds the whole land as a few merged meshes: countryside, roads, the central plaza, parks,
// empty pegged plots, and one house per waitlist entry (its look comes from the Instagram username).
// House and prop shapes are ported from the House City reel.
import * as THREE from "three";
import { Builder, C, T, roofTpl, rot, type Tpl } from "./geo";
import {
  ASPHALT,
  BX,
  BZ,
  DOORS,
  FH,
  GLASS,
  GRASS,
  LAWN,
  LW,
  PER_ROW,
  PX,
  PZ,
  ROAD,
  ROOFS,
  TRIM,
  WALK,
  WALLS,
  Y0,
  blockC,
  cityHalf,
  hashStr,
  isPark,
  isPlaza,
  lotAt,
  lotForPlot,
  lotKey,
  pick,
  ringOf,
  ringsToDraw,
  rng,
  type Lot,
  type Row,
} from "./layout";

const LEAF = ["#5DAE45", "#6CBB4C", "#4F9F3D", "#78C257", "#64B04A"];
const PINE = ["#3E8E4A", "#2F7D45", "#47975A"];
const HEDGE = "#4E9E3E";
const POLE = "#3C4148";

type Adder = Pick<Builder, "add" | "addE">;

// Places a sub-model (built around its own origin) at (ox, oy, oz) with uniform scale s.
const placed = (b: Builder, ox: number, oy: number, oz: number, s: number): Adder => ({
  add: (t: Tpl, x, y, z, sx, sy, sz, ry, col) => b.add(t, ox + x * s, oy + y * s, oz + z * s, sx * s, sy * s, sz * s, ry, col),
  addE: (t: Tpl, x, y, z, sx, sy, sz, ax, ay, az, col) =>
    b.addE(t, ox + x * s, oy + y * s, oz + z * s, sx * s, sy * s, sz * s, ax, ay, az, col),
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

type RoofKind = "gable" | "hip" | "flat";
type HouseSpec = {
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
  chimney: boolean;
  detail: boolean;
  tree: 0 | 1 | 2;
  hedge: boolean;
};

const YARD = (d: number) => BZ / 2 - 1.6 - 8 - d / 2 - 0.6;

// One house; its front faces local +z. yard = distance from the front wall to the lot's front edge.
const addHouse = (b: Adder, h: HouseSpec, yard: number, lw: number, r: () => number) => {
  const { x, z, rot: ry, w, d, floors, rh } = h;
  const P = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: string, tpl = T.box, extra = 0) => {
    const [ox, oz] = rot(lx, lz, ry);
    b.add(tpl, x + ox, Y0 + ly, z + oz, sx, sy, sz, ry + extra, C(col));
  };
  const bodyH = floors * FH;
  const top = 0.4 + bodyH;
  P(0, 0.2, 0, w + 0.5, 0.4, d + 0.5, "#CFC6B5");
  P(0, 0.4 + bodyH / 2, 0, w, bodyH, d, h.wall);
  if (h.detail) {
    for (let f = 1; f < floors; f++) P(0, 0.4 + FH * f, 0, w + 0.16, 0.22, d + 0.16, TRIM);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P((sx * w) / 2, 0.4 + bodyH / 2, (sz * d) / 2, 0.32, bodyH, 0.32, TRIM);
  }
  if (h.roof === "gable") {
    P(0, top, 0, w, rh * 0.97, d, h.wall, roofTpl(0.5));
    P(0, top - 0.12, 0, w + 0.3, 0.26, d + 0.3, TRIM);
    const half = d / 2;
    const Ls = Math.hypot(rh, half);
    const a = Math.atan2(rh, half);
    const len = Ls + 0.8;
    for (const sgn of [1, -1]) {
      const lz = sgn * ((half / Ls) * (len / 2) + (rh / Ls) * 0.16) - sgn * 0.02;
      const ly = top + rh - (rh / Ls) * (len / 2) + (half / Ls) * 0.16;
      const [ox, oz] = rot(0, lz, ry);
      b.addE(T.box, x + ox, Y0 + ly, z + oz, w + 0.9, 0.32, len, sgn * a, ry, 0, C(h.roofC));
    }
    P(0, top + rh + 0.12, 0, w + 0.95, 0.24, 0.5, h.roofC);
  } else if (h.roof === "hip") {
    const rw = w + 0.9;
    const rd = d + 0.9;
    P(0, top - 0.12, 0, w + 0.3, 0.26, d + 0.3, TRIM);
    P(0, top, 0, rw, rh, rd, h.roofC, roofTpl(Math.max(0, 0.5 - (0.5 * rd) / rw)));
  } else {
    P(0, top + 0.12, 0, w + 0.7, 0.36, d + 0.7, TRIM);
    P(0, top + 0.42, 0, w + 0.5, 0.3, d + 0.5, h.roofC);
  }
  if (h.chimney && h.roof !== "flat") {
    P(w * 0.28, top + rh * 0.5 + 0.6, -d * 0.14, 0.9, rh + 1.2, 0.9, "#9C6B52");
    P(w * 0.28, top + rh + 1.25, -d * 0.14, 1.1, 0.22, 1.1, "#7E5644");
  }
  const du = w > 9.6 ? -w * 0.2 : -w * 0.16;
  const nF = Math.max(2, Math.floor((w - 1) / 2.5));
  const nS = Math.max(1, Math.floor((d - 1) / 3.3));
  const us = (n: number, span: number) => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * (span / n));
  const win = (face: "F" | "B" | "L" | "R", u: number, ly: number) => {
    const ext = face === "F" ? 0 : face === "B" ? Math.PI : face === "L" ? -Math.PI / 2 : Math.PI / 2;
    const off = face === "F" || face === "B" ? d / 2 : w / 2;
    const L = (uu: number, nn: number): [number, number] => rot(uu, off + nn, ext);
    if (h.detail) {
      const q = (uu: number, nn: number, yy: number, sx: number, sy: number, sz: number, col: string) => {
        const [lx, lz] = L(uu, nn);
        P(lx, yy, lz, sx, sy, sz, col, T.box, ext);
      };
      q(u, 0.05, ly, 1.5, 1.75, 0.14, TRIM);
      q(u, 0.09, ly, 1.16, 1.4, 0.1, GLASS);
      q(u, 0.14, ly, 0.09, 1.4, 0.04, TRIM);
      q(u, 0.14, ly + 0.1, 1.16, 0.09, 0.04, TRIM);
      q(u, 0.13, ly - 0.93, 1.75, 0.14, 0.3, TRIM);
    } else {
      const [lx, lz] = L(u, 0.03);
      P(lx, ly, lz, 1.4, 1.6, 1, TRIM, T.quadZ, ext);
      const [gx, gz] = L(u, 0.05);
      P(gx, ly, gz, 1.08, 1.28, 1, GLASS, T.quadZ, ext);
    }
  };
  for (let f = 0; f < floors; f++) {
    const ly = 0.4 + FH * f + 1.6;
    for (const u of us(nF, w)) {
      if (!(f === 0 && Math.abs(u - du) < 1.6)) win("F", u, ly);
      if (h.detail || f > 0) win("B", u, ly);
    }
    for (const u of us(h.detail ? nS : 1, d)) {
      win("L", u, ly);
      win("R", u, ly);
    }
  }
  if (h.detail) {
    P(du, 0.4 + 1.27, d / 2 + 0.05, 1.55, 2.55, 0.14, TRIM);
    P(du, 0.4 + 1.17, d / 2 + 0.1, 1.15, 2.3, 0.1, h.door);
    P(du + 0.38, 0.4 + 1.15, d / 2 + 0.17, 0.12, 0.12, 0.06, "#E8C35A");
    const [ox, oz] = rot(du, d / 2 + 0.55, ry);
    b.addE(T.box, x + ox, Y0 + 0.4 + 2.85, z + oz, 2.3, 0.14, 1.15, 0.32, ry, 0, C(h.roofC));
  } else {
    P(du, 0.4 + 1.15, d / 2 + 0.04, 1.1, 2.2, 1, h.door, T.quadZ);
  }
  P(du, 0.15, d / 2 + 0.55, 1.8, 0.3, 0.9, "#D6CFC2");
  if (yard > 1) P(du, 0.03, d / 2 + 0.6 + yard / 2, 1.3, 0.06, yard, WALK);
  if (h.hedge && yard > 2.5) {
    for (const sg of [-1, 1]) {
      const a = sg < 0 ? -lw / 2 + 0.5 : du + 0.95;
      const e = sg < 0 ? du - 0.95 : lw / 2 - 0.5;
      if (e - a > 1) P((a + e) / 2, 0.5, d / 2 + yard - 0.4, e - a, 1.0, 0.85, HEDGE);
    }
  }
  const tp = (lx: number, lz: number): [number, number] => {
    const [ox, oz] = rot(lx, lz, ry);
    return [x + ox, z + oz];
  };
  if (h.tree === 1 && yard > 3) {
    const [tx, tz] = tp(Math.min(w * 0.28, lw / 2 - 1.8), d / 2 + Math.min(3.2, yard * 0.5));
    addTree(b, tx, Y0, tz, 0.95 + r() * 0.2, r);
  } else if (h.tree === 2 && yard > 3) {
    for (const sg of [-1, 1]) {
      const [tx, tz] = tp(sg * Math.min(w * 0.36, lw / 2 - 1.4), d / 2 + Math.min(2.4, yard * 0.4));
      addPine(b, tx, Y0, tz, 0.85 + r() * 0.2, r);
    }
  }
  if (r() < 0.45) {
    const [tx, tz] = tp((r() - 0.5) * w * 0.7, -d / 2 - 3.2);
    addTree(b, tx, Y0, tz, 0.9 + r() * 0.3, r);
  }
};

// The same username always gets the same house.
const houseSpec = (name: string, lot: Lot, x: number, z: number): { h: HouseSpec; r: () => number } => {
  const r = rng(hashStr(`house:${name}`));
  const ring = lot.ring;
  const floors = ring <= 1 ? pick(r, [2, 2, 3, 2, 3]) : ring <= 4 ? pick(r, [1, 2, 2, 2]) : pick(r, [1, 1, 2, 2]);
  const roof: RoofKind =
    floors === 3
      ? r() < 0.55
        ? "flat"
        : "hip"
      : pick(r, ring <= 3 ? (["gable", "gable", "hip", "flat"] as const) : (["gable", "gable", "hip"] as const));
  const h: HouseSpec = {
    x,
    z,
    rot: lot.rot,
    w: Math.max(7.2, LW - 1.5 - r() * 1.3),
    d: 7.6 + r() * 1.4,
    floors,
    rh: roof === "gable" ? 2.5 + r() * 1.1 : roof === "hip" ? 1.8 + r() * 1.3 : 0,
    roof,
    wall: pick(r, WALLS),
    roofC: pick(r, ROOFS),
    door: pick(r, DOORS),
    chimney: r() < 0.3,
    detail: ring <= 2,
    tree: r() < 0.5 ? 1 : r() < 0.35 ? 2 : 0,
    hedge: r() < 0.55,
  };
  return { h, r };
};

const houseTop = (h: HouseSpec) => Y0 + 0.4 + h.floors * FH + (h.roof === "flat" ? 0.6 : h.rh + 0.3);

const blockBase = (b: Builder, i: number, j: number, top: string) => {
  const [cx, cz] = blockC(i, j);
  b.add(T.box, cx, 0.15, cz, BX, 0.3, BZ, 0, C(WALK));
  b.add(T.box, cx, 0.36, cz, BX - 3.2, 0.12, BZ - 3.2, 0, C(top));
};

const parkBlock = (b: Builder, i: number, j: number) => {
  blockBase(b, i, j, "#8ED061");
  const [cx, cz] = blockC(i, j);
  const r = rng(hashStr(`park${i},${j}`));
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

const plazaBlock = (b: Builder) => {
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

const PAINT_Y = 0.19; // road paint sits 9 cm above the asphalt so it never z-fights

const roadsAndMarks = (b: Builder, dash: Builder, xw: Builder, xwFar: Builder, rings: number) => {
  const half = cityHalf(rings);
  b.add(T.box, 0, 0.05, 0, 2 * half.x, 0.1, 2 * half.z, 0, C(ASPHALT));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = -rings - 1; i <= rings; i++) xs.push((i + 0.5) * PX);
  for (let j = -rings - 1; j <= rings; j++) zs.push((j + 0.5) * PZ);
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
      const near = Math.max(Math.abs(xr / PX), Math.abs(zr / PZ)) <= 7;
      if (near) {
        for (let s = 0; s < 6; s++) {
          const o = (s - 2.5) * 1.75;
          xw.add(T.quadY, xr + o, PAINT_Y, zr - ROAD / 2 - 1.9, 0.9, 1, 2.8, 0, white);
          xw.add(T.quadY, xr + o, PAINT_Y, zr + ROAD / 2 + 1.9, 0.9, 1, 2.8, 0, white);
          xw.add(T.quadY, xr - ROAD / 2 - 1.9, PAINT_Y, zr + o, 2.8, 1, 0.9, 0, white);
          xw.add(T.quadY, xr + ROAD / 2 + 1.9, PAINT_Y, zr + o, 2.8, 1, 0.9, 0, white);
        }
      }
      // From high up, thin stripes shimmer; each crossing becomes one soft pad instead.
      xwFar.add(T.quadY, xr, PAINT_Y, zr - ROAD / 2 - 1.9, 10.4, 1, 2.8, 0, pad);
      xwFar.add(T.quadY, xr, PAINT_Y, zr + ROAD / 2 + 1.9, 10.4, 1, 2.8, 0, pad);
      xwFar.add(T.quadY, xr - ROAD / 2 - 1.9, PAINT_Y, zr, 2.8, 1, 10.4, 0, pad);
      xwFar.add(T.quadY, xr + ROAD / 2 + 1.9, PAINT_Y, zr, 2.8, 1, 10.4, 0, pad);
    }
};

const countryside = (b: Builder, rings: number) => {
  const half = cityHalf(rings);
  const ext = Math.max(2400, half.x + 1600, half.z + 1600);
  const seaZ = -(half.z + 190);
  const r = rng(4242);
  b.add(T.box, 0, -0.25, 0, ext * 5, 0.3, ext * 5, 0, C(GRASS));
  const FIELDS = ["#B5DB7E", "#A4D16E", "#E2CF7F", "#D7BE8E", "#C3DF8A", "#9DCB63", "#E8D88F"];
  for (let gx = -ext; gx < ext; gx += 92)
    for (let gz = seaZ + 45; gz < ext; gz += 76) {
      const cx = gx + (r() - 0.5) * 8;
      const cz = gz + (r() - 0.5) * 8;
      if (Math.abs(cx) < half.x + 60 && Math.abs(cz) < half.z + 55) continue;
      b.add(T.box, cx, 0.06, cz, 84 + r() * 4, 0.12, 68 + r() * 4, 0, C(pick(r, FIELDS)));
      if (r() < 0.32) for (let t = 0; t < 6; t++) addTree(b, cx - 40 + t * 16 + r() * 4, 0.1, cz + 36.5, 1.1 + r() * 0.4, r);
      if (r() < 0.1)
        for (let t = 0; t < 12; t++) addPine(b, cx + (r() - 0.5) * 70, 0.1, cz + (r() - 0.5) * 56, 1.4 + r() * 0.8, r);
    }
  b.add(T.box, 0, 0.06, seaZ - 16, ext * 5, 0.12, 32, 0, C("#EADBAA"));
  b.add(T.box, 0, 0.08, seaZ - 32 - ext * 1.25, ext * 5, 0.12, ext * 2.5, 0, C("#3D95CB"));
};

// Empty plot: white boundary lines, corner pegs near the centre, the odd tree.
const emptyLot = (b: Builder, lot: Lot, clear: boolean) => {
  const [, cz] = blockC(lot.i, lot.j);
  const LINE = C("#F1ECDC");
  const PEG = C("#F08A3C");
  const z0 = lot.row === "S" ? cz + 0.5 : cz - BZ / 2 + 1.9;
  const z1 = lot.row === "S" ? cz + BZ / 2 - 1.9 : cz - 0.5;
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
  const r = rng(hashStr(`empty:${lotKey(lot)}`));
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

export type LandBuild = {
  city: THREE.BufferGeometry;
  dash: THREE.BufferGeometry;
  xw: THREE.BufferGeometry;
  xwFar: THREE.BufferGeometry;
  own: { geo: THREE.BufferGeometry; n: number; lot: Lot; top: number } | null;
  houses: HouseHit[];
  next: { n: number; lot: Lot };
  rings: number;
  half: { x: number; z: number };
};

export const buildLand = (names: readonly string[], mine: number | null): LandBuild => {
  const rings = ringsToDraw(names.length);
  const b = new Builder();
  const dash = new Builder();
  const xw = new Builder();
  const xwFar = new Builder();
  countryside(b, rings);
  roadsAndMarks(b, dash, xw, xwFar, rings);

  const taken = new Map<string, number>();
  for (let n = 1; n <= names.length; n++) taken.set(lotKey(lotForPlot(n)), n);
  const nextN = names.length + 1;
  const nextLot = lotForPlot(nextN);
  const nextKey = lotKey(nextLot);

  const houses: HouseHit[] = [];
  let own: LandBuild["own"] = null;

  for (let i = -rings; i <= rings; i++)
    for (let j = -rings; j <= rings; j++) {
      if (isPlaza(i, j)) {
        plazaBlock(b);
        continue;
      }
      if (isPark(i, j)) {
        parkBlock(b, i, j);
        continue;
      }
      blockBase(b, i, j, LAWN);
      for (const row of ["S", "N"] as Row[])
        for (let k = 0; k < PER_ROW; k++) {
          const lot = lotAt(i, j, row, k);
          const n = taken.get(lotKey(lot));
          if (n === undefined) {
            emptyLot(b, lot, lotKey(lot) === nextKey);
            continue;
          }
          const name = names[n - 1];
          if (n === mine) {
            // Your house is its own mesh (built around its own origin) so it can rise out of the ground.
            const ob = new Builder();
            const { h, r } = houseSpec(name, lot, 0, 0);
            addHouse(ob, h, YARD(h.d), LW, r);
            own = { geo: ob.geometry(), n, lot, top: houseTop(h) };
            houses.push(hitBox(n, name, lot, h));
            continue;
          }
          const { h, r } = houseSpec(name, lot, lot.x, lot.z);
          addHouse(b, h, YARD(h.d), LW, r);
          houses.push(hitBox(n, name, lot, h));
        }
      const [cx, cz] = blockC(i, j);
      if (ringOf(i, j) <= 4)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLamp(b, cx + sx * (BX / 2 - 0.8), 0.3, cz + sz * (BZ / 2 - 0.8));
    }

  return {
    city: b.geometry(),
    dash: dash.geometry(),
    xw: xw.geometry(),
    xwFar: xwFar.geometry(),
    own,
    houses,
    next: { n: nextN, lot: nextLot },
    rings,
    half: cityHalf(rings),
  };
};

const hitBox = (n: number, name: string, lot: Lot, h: HouseSpec): HouseHit => {
  const top = houseTop(h);
  const hw = h.w / 2 + 0.5;
  const hd = h.d / 2 + 0.5;
  return {
    n,
    name,
    lot,
    min: new THREE.Vector3(lot.x - hw, Y0, lot.z - hd),
    max: new THREE.Vector3(lot.x + hw, top, lot.z + hd),
    top,
  };
};
