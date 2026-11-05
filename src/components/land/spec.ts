// What each house looks like and how far it's built, plus its value. No three.js here, so the page
// card can use it too. A house's look comes from its house number (so it never changes); how far
// along it is comes from its build times (see src/lib/house.ts).
import { NEIGHBOUR_RADIUS } from "@/lib/house";
import { BZ, DOORS, FH, LW, ROOFS, WALLS, Y0, hashStr, lotForPlot, pick, rng, type Lot } from "./layout";

type RoofKind = "gable" | "hip" | "flat";
// 0: foundations + frame, 1: walls going up, 2: roof going on, 3: finished
export type Stage = 0 | 1 | 2 | 3;

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
  roofCover: number; // share of the roof that's covered (stage 2)
  detail: boolean;
  // Only for finished houses:
  chimney: boolean;
  tree: 0 | 1 | 2;
  hedge: boolean;
};

export const YARD = (d: number) => BZ / 2 - 1.6 - 8 - d / 2 - 0.6;

// The house's name board: where it stands in the front yard (house-local, front = +z) and its size.
export const BOARD = { w: 2.4, h: 1.2, y: 1.55, x: -3.5 };
export const boardZ = (d: number) => d / 2 + YARD(d) - 1.3;

// progress: 0..1 from the build times. Without it (houses in far-away towns, which have no build
// times loaded) the stage is made up from the house number.
export const houseSpec = (plot: number, lot: Lot, x: number, z: number, progress?: number): HouseSpec => {
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
  const fr = r();
  const bodyH = floors * FH;

  let stage: Stage;
  let f: number; // how much of the walls stand (stages 0 and 1)
  let roofCover = 0.35 + fr * 0.45;
  if (progress === undefined) {
    stage = sr < 0.3 ? 0 : sr < 0.72 ? 1 : 2;
    f = stage === 0 ? 0.18 + fr * 0.22 : stage === 1 ? 0.5 + fr * 0.4 : 1;
  } else {
    const p = Math.min(1, Math.max(0, progress));
    stage = p >= 1 ? 3 : p >= 0.7 ? 2 : p >= 0.35 ? 1 : 0;
    f = stage === 0 ? 0.12 + 0.28 * (p / 0.35) : stage === 1 ? 0.45 + 0.5 * ((p - 0.35) / 0.35) : 1;
    roofCover = stage === 2 ? 0.15 + 0.85 * ((p - 0.7) / 0.3) : 0;
  }
  const wallH = stage >= 2 ? bodyH : Math.min(bodyH, Math.max(1.1, bodyH * f));
  const frameTop = stage >= 2 ? bodyH : Math.min(bodyH, (Math.floor(wallH / FH + 1e-6) + 1) * FH);

  const g = rng(hashStr(`garden:${plot}`));
  return {
    x,
    z,
    rot: lot.rot,
    w,
    d,
    floors,
    rh,
    roof,
    wall,
    roofC,
    door,
    stage,
    wallH,
    frameTop,
    roofCover,
    detail: ring <= 2,
    chimney: g() < 0.3,
    tree: g() < 0.5 ? 1 : g() < 0.35 ? 2 : 0,
    hedge: g() < 0.55,
  };
};

// Highest point of a house (roof ridge, or the scaffold's guard rail while it's being built).
export const siteTop = (h: HouseSpec) =>
  Y0 +
  0.4 +
  (h.stage === 3
    ? h.floors * FH + (h.roof === "flat" ? 0.6 : h.rh + 0.3)
    : h.stage === 2
      ? h.floors * FH + (h.roof === "flat" ? 0.9 : h.rh + 0.3)
      : h.frameTop + 1.0);

export const specForPlot = (plot: number, progress?: number) => {
  const lot = lotForPlot(plot);
  return { lot, spec: houseSpec(plot, lot, lot.x, lot.z, progress) };
};

// Neighbours can message each other: same town, at most NEIGHBOUR_RADIUS apart. The database
// checks the same rule (public.plots_near) when a message is sent.
export const areNeighbours = (a: number, b: number) => {
  if (a === b || a < 1 || b < 1) return false;
  const la = lotForPlot(a);
  const lb = lotForPlot(b);
  return la.town === lb.town && Math.hypot(la.x - lb.x, la.z - lb.z) <= NEIGHBOUR_RADIUS;
};

// The houses near yours, nearest first.
export const neighboursOf = <T extends { plot: number }>(mine: number, houses: readonly T[]): T[] => {
  const me = lotForPlot(mine);
  return houses
    .filter((h) => areNeighbours(mine, h.plot))
    .map((h) => ({ h, d: Math.hypot(lotForPlot(h.plot).x - me.x, lotForPlot(h.plot).z - me.z) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.h);
};

// What a house is worth, in in-game coins (not real money). Plots near the plaza cost more, bigger
// houses more, finished houses more than sites, Town 1 and the first 100 houses a bit more, and
// every wave adds a little.
const RING_PRICE = [0, 260_000, 210_000, 175_000, 150_000, 130_000];

export const houseValue = (plot: number, progress: number, waves: number) => {
  const { lot, spec } = specForPlot(plot);
  const land = RING_PRICE[lot.ring] ?? 120_000;
  const size = (spec.w * spec.d * spec.floors) / (8.2 * 8.3 * 2);
  const town = lot.town === 1 ? 1.15 : 1;
  const founder = plot <= 100 ? 1.2 : 1;
  const built = 0.4 + 0.6 * Math.min(1, Math.max(0, progress));
  const v = land * Math.pow(size, 0.7) * town * founder * built + Math.max(0, waves) * 250;
  return Math.round(v / 100) * 100;
};
