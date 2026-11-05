// One person in 3D: a low-poly human built from their look (look.ts), with a skeleton so they can
// walk, run, sit, sweep, queue, fight and fall over. Every body part is rigidly attached to one bone,
// so the whole person is one mesh and one draw call. Animation is worked out here from a few numbers
// (gait, stride phase, what they're doing and for how long); there are no animation files.
import * as THREE from "three";
import { Builder, C, T } from "../land/geo";
import type { Look } from "./look";

// What someone is doing (besides walking): idle ways of standing, chores and the rest.
export const ACTS = [
  "none",
  "phone",
  "crossed",
  "stretch",
  "look",
  "sweep",
  "water",
  "mailbox",
  "watch",
  "sitBench",
  "sitGround",
  "queue",
  "chat",
  "listen",
  "fight",
  "fall",
  "cheer",
  "grab",
  "shakeFist",
  "flinch",
  "wave",
] as const;
export type Act = (typeof ACTS)[number];
export const actCode = (a: Act) => Math.max(0, ACTS.indexOf(a));
export const actOf = (code: number): Act => ACTS[code] ?? "none";

// 0 standing, 1 walk, 2 jog, 3 run, 4 sneak.
export type Gait = 0 | 1 | 2 | 3 | 4;

export type Anim = {
  gait: Gait;
  phase: number; // stride, in whole cycles (two steps each)
  act: Act;
  actT: number; // seconds into the act
  actDur: number; // how long the act lasts (falls get up at the end)
  t: number; // clock, for idle movement
  seed: number;
  side: number; // fights: 0 or 1, so two fighters punch in turn
};

const B = { root: 0, spine: 1, head: 2, lThigh: 3, lShin: 4, rThigh: 5, rShin: 6, lUpper: 7, lFore: 8, rUpper: 9, rFore: 10 };
const NB = 11;

export type Dims = {
  H: number;
  hip: number;
  knee: number;
  ankle: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  neck: number;
  headC: number;
  headH: number;
  headW: number;
  sx: number;
  hx: number;
  torsoW: number;
  torsoD: number;
  legW: number;
  armW: number;
};

export const dimsOf = (l: Look): Dims => {
  const H = l.height;
  const bw = [0.9, 1, 1.12][l.build];
  const torsoW = (l.fem ? 0.2 : 0.23) * H * bw;
  const armW = (l.fem ? 0.045 : 0.05) * H * bw;
  return {
    H,
    hip: 0.53 * H,
    knee: 0.285 * H,
    ankle: 0.045 * H,
    shoulder: 0.815 * H,
    elbow: 0.64 * H,
    wrist: 0.47 * H,
    neck: 0.845 * H,
    headC: 0.925 * H,
    headH: 0.13 * H,
    headW: 0.104 * H,
    sx: torsoW / 2 + armW * 0.45,
    hx: (l.fem ? 0.058 : 0.052) * H * bw,
    torsoW,
    torsoD: 0.11 * H * bw,
    legW: (l.fem ? 0.064 : 0.068) * H * bw,
    armW,
  };
};

const shadeCache = new Map<string, string>();
const shade = (hex: string, k: number) => {
  const key = `${hex}|${k}`;
  let v = shadeCache.get(key);
  if (!v) {
    const c = new THREE.Color(hex);
    if (k >= 1) c.lerp(new THREE.Color("#FFFFFF"), k - 1);
    else c.multiplyScalar(k);
    v = `#${c.getHexString()}`;
    shadeCache.set(key, v);
  }
  return v;
};
const mix = (a: string, b: string, t: number) => {
  const key = `${a}|${b}|${t}`;
  let v = shadeCache.get(key);
  if (!v) {
    v = `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
    shadeCache.set(key, v);
  }
  return v;
};

// The parts of a person, each on its bone, in the standing pose (feet at y = 0, facing +z).
const buildParts = (l: Look, d: Dims): Builder[] => {
  const p = Array.from({ length: NB }, () => new Builder());
  const box = (bone: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, col: string, ry = 0) =>
    p[bone].add(T.box, x, y, z, sx, sy, sz, ry, C(col));
  const ico = (bone: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, col: string) =>
    p[bone].add(T.ico1, x, y, z, rx, ry, rz, 0, C(col));
  const { H, hip, knee, ankle, shoulder, elbow, wrist, neck, headC, headH, headW, sx, hx, torsoW, torsoD, legW, armW } = d;
  const skin = l.skin;
  const top = l.topColor;
  const bot = l.bottomColor;
  const hair = l.hairColor;
  const long = l.top !== "tee";
  const pants = l.bottom === "trousers" || l.bottom === "joggers";

  // ----- body (spine) -----
  const waistY = hip + 0.07 * H;
  const torsoTop = shoulder + 0.015 * H;
  const jacket = l.top === "jacket";
  const tw = torsoW * (jacket ? 1.05 : 1);
  const hem = jacket ? hip - 0.005 * H : waistY - 0.012 * H;
  if (l.bottom !== "skirt") box(B.spine, 0, hip + 0.025 * H, 0, torsoW * 0.9, 0.1 * H, torsoD * 1.02, bot);
  if (l.bottom !== "skirt" && !jacket) box(B.spine, 0, waistY, 0, torsoW * 0.93, 0.018 * H, torsoD * 1.06, "#2A2420");
  if (l.fem) {
    const mid = hip + 0.17 * H;
    box(B.spine, 0, (hem + mid) / 2, 0, tw * 0.82, mid - hem, torsoD, top);
    box(B.spine, 0, (mid + torsoTop) / 2, 0.006 * H, tw * 0.94, torsoTop - mid, torsoD * 1.1, top);
  } else {
    box(B.spine, 0, (hem + torsoTop) / 2, 0, tw, torsoTop - hem, torsoD, top);
  }
  // Rounded shoulders.
  box(B.spine, 0, shoulder - 0.005 * H, 0, tw + armW * 0.7, 0.05 * H, torsoD * 0.96, top);
  const front = torsoD / 2 + (l.fem ? 0.009 * H : 0.002);
  if (jacket) {
    const inner = new THREE.Color(top).getHSL({ h: 0, s: 0, l: 0 }).l > 0.45 ? "#2E2E33" : "#F1EEE8";
    box(B.spine, 0, (hem + torsoTop) / 2 + 0.02 * H, front, torsoW * 0.26, (torsoTop - hem) * 0.86, 0.01, inner);
    box(B.spine, 0, torsoTop - 0.03 * H, front + 0.004, torsoW * 0.5, 0.035 * H, 0.012, shade(top, 0.8));
  } else if (l.top === "hoodie") {
    box(B.spine, 0, shoulder + 0.012 * H, -torsoD * 0.42, torsoW * 0.56, 0.075 * H, torsoD * 0.42, shade(top, 0.85));
    box(B.spine, 0, waistY + 0.05 * H, front, torsoW * 0.5, 0.07 * H, 0.012, shade(top, 0.86));
    for (const s of [-1, 1]) box(B.spine, s * 0.03 * H, shoulder - 0.08 * H, front + 0.002, 0.008 * H, 0.09 * H, 0.008, "#EDEAE4");
  } else if (l.top === "shirt") {
    for (const s of [-1, 1]) box(B.spine, s * 0.035 * H, torsoTop - 0.01 * H, front * 0.9, 0.05 * H, 0.03 * H, 0.04 * H, shade(top, 1.25), s * 0.5);
    box(B.spine, 0, (hem + torsoTop) / 2, front + 0.001, 0.006 * H, (torsoTop - hem) * 0.85, 0.008, shade(top, 0.7));
  } else {
    box(B.spine, 0, torsoTop - 0.008 * H, 0.006, torsoW * 0.36, 0.016 * H, torsoD * 0.9, shade(top, 0.82));
  }
  if (l.bottom === "skirt") {
    const s0 = hip + 0.05 * H;
    const s1 = hip - 0.06 * H;
    const s2 = knee + 0.07 * H;
    box(B.spine, 0, (s0 + s1) / 2, 0, torsoW * 0.94, s0 - s1, torsoD * 1.12, bot);
    box(B.spine, 0, (s1 + s2) / 2, 0, torsoW * 1.12, s1 - s2, torsoD * 1.3, bot);
  }
  box(B.spine, 0, (shoulder + neck) / 2 + 0.012 * H, 0, 0.052 * H, 0.07 * H, 0.05 * H, skin);

  // ----- head -----
  const a = headW / 2;
  const b = headH / 2;
  const c = headW * 0.54;
  ico(B.head, 0, headC, 0, a, b, c, skin);
  box(B.head, 0, headC - 0.006 * H, c * 0.96, 0.018 * H, 0.03 * H, 0.024 * H, shade(skin, 0.93));
  for (const s of [-1, 1]) {
    box(B.head, s * 0.026 * H, headC + 0.012 * H, c * 0.88, 0.014 * H, 0.011 * H, 0.012 * H, "#1E1A18");
    box(B.head, s * 0.026 * H, headC + 0.03 * H, c * 0.86, 0.022 * H, 0.006 * H, 0.012 * H, shade(hair, 0.85));
    box(B.head, s * a * 0.98, headC, -0.004 * H, 0.012 * H, 0.03 * H, 0.022 * H, shade(skin, 0.95));
  }
  const lips = l.fem && l.detail >= 2 ? "#C2304A" : mix(skin, "#7A3A34", 0.45);
  box(B.head, 0, headC - 0.035 * H, c * 0.88, 0.032 * H, 0.008 * H, 0.012 * H, lips);
  if (l.fem && (l.detail === 1 || l.detail === 3))
    for (const s of [-1, 1]) box(B.head, s * a * 1.0, headC - 0.022 * H, 0, 0.009 * H, 0.014 * H, 0.009 * H, "#E8C35A");
  if (!l.fem && l.detail === 1) box(B.head, 0, headC - 0.038 * H, c * 0.3, headW * 0.96, 0.052 * H, c * 1.38, mix(skin, hair, 0.3));
  if (!l.fem && l.detail >= 2) box(B.head, 0, headC - 0.022 * H, c * 0.92, 0.046 * H, 0.012 * H, 0.016 * H, hair);
  if (!l.fem && l.detail === 3) {
    box(B.head, 0, headC - 0.052 * H, c * 0.22, headW * 1.02, 0.07 * H, c * 1.5, hair);
    box(B.head, 0, headC - 0.078 * H, c * 0.55, headW * 0.7, 0.03 * H, c * 0.9, hair);
  }

  // Hair, kept up and back so the face shows.
  const cap = (up: number, rx: number, ry: number, rz: number, back = 0.06) => ico(B.head, 0, headC + b * up, -c * back, a * rx, b * ry, c * rz, hair);
  const backHair = (down: number, depth = 0.4) => box(B.head, 0, headC - b * down * 0.5, -c * 0.62, headW * 1.0, b * (1 + down), c * depth, hair);
  switch (l.hair) {
    case "buzz":
      cap(0.42, 1.04, 0.66, 1.03);
      break;
    case "short":
      cap(0.32, 1.08, 0.8, 1.07);
      backHair(0.3);
      break;
    case "sidepart":
      cap(0.34, 1.08, 0.8, 1.07);
      backHair(0.3);
      box(B.head, a * 0.35, headC + b * 0.95, c * 0.25, headW * 0.62, 0.028 * H, c * 1.2, hair, 0.25);
      break;
    case "curly":
      cap(0.3, 1.1, 0.82, 1.08);
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2;
        ico(B.head, Math.cos(ang) * a * 0.75, headC + b * 0.9, Math.sin(ang) * c * 0.65 - c * 0.1, 0.03 * H, 0.028 * H, 0.03 * H, hair);
      }
      break;
    case "afro":
      ico(B.head, 0, headC + 0.05 * H, -0.035 * H, a * 1.42, b * 1.12, c * 1.3, hair);
      break;
    case "long":
      cap(0.3, 1.1, 0.84, 1.08);
      box(B.head, 0, headC - 0.09 * H, -c * 0.58, headW * 1.08, 0.22 * H, c * 0.42, hair);
      for (const s of [-1, 1]) box(B.head, s * a * 1.02, headC - 0.03 * H, -c * 0.1, 0.02 * H, 0.12 * H, c * 0.9, hair);
      break;
    case "ponytail":
      cap(0.3, 1.08, 0.82, 1.07);
      backHair(0.2);
      box(B.head, 0, headC - 0.03 * H, -c * 1.1, 0.04 * H, 0.15 * H, 0.045 * H, hair);
      box(B.head, 0, headC + 0.04 * H, -c * 0.98, 0.05 * H, 0.016 * H, 0.05 * H, shade(l.accColor, 0.9));
      break;
    case "bun":
      cap(0.3, 1.08, 0.82, 1.07);
      backHair(0.2);
      ico(B.head, 0, headC + b * 1.15, -c * 0.45, 0.045 * H, 0.04 * H, 0.045 * H, hair);
      break;
    case "bob":
      cap(0.3, 1.12, 0.86, 1.1);
      for (const s of [-1, 1]) box(B.head, s * a * 1.04, headC - 0.012 * H, -c * 0.12, 0.024 * H, 0.085 * H, c * 1.25, hair);
      box(B.head, 0, headC - 0.02 * H, -c * 0.66, headW * 1.12, 0.095 * H, c * 0.5, hair);
      break;
    case "spiky":
      cap(0.4, 1.05, 0.7, 1.04);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + 0.3;
        p[B.head].add(T.cone, Math.cos(ang) * a * 0.45, headC + b * 1.1, Math.sin(ang) * c * 0.4 - c * 0.05, 0.022 * H, 0.06 * H, 0.022 * H, ang, C(hair));
      }
      break;
  }

  // Accessories.
  const eyeY = headC + 0.012 * H;
  if (l.acc === "glasses" || l.acc === "sunglasses") {
    const frame = l.acc === "glasses" ? "#2A2A2E" : "#141416";
    const lens = l.acc === "glasses" ? "#BFD9E6" : "#1C1E22";
    box(B.head, 0, eyeY, c * 0.97, headW * 0.82, 0.006 * H, 0.008 * H, frame);
    for (const s of [-1, 1]) {
      box(B.head, s * 0.027 * H, eyeY - 0.002 * H, c * 0.96, 0.03 * H, 0.022 * H, 0.006 * H, lens);
      box(B.head, s * a * 0.98, eyeY, c * 0.4, 0.006 * H, 0.006 * H, c * 1.1, frame);
    }
  } else if (l.acc === "cap") {
    ico(B.head, 0, headC + b * 0.5, -c * 0.02, a * 1.1, b * 0.62, c * 1.1, l.accColor);
    box(B.head, 0, headC + b * 0.5, c * 1.08, headW * 0.86, 0.012 * H, c * 0.95, shade(l.accColor, 0.85));
  } else if (l.acc === "beanie") {
    ico(B.head, 0, headC + b * 0.58, -c * 0.04, a * 1.12, b * 0.72, c * 1.12, l.accColor);
    box(B.head, 0, headC + b * 0.36, -c * 0.03, headW * 1.14, 0.03 * H, c * 2.16, shade(l.accColor, 0.82));
  } else if (l.acc === "headphones") {
    for (const s of [-1, 1]) {
      box(B.head, s * a * 1.08, headC, 0, 0.022 * H, 0.06 * H, 0.05 * H, l.accColor);
      box(B.head, s * a * 0.78, headC + b * 1.02, 0, 0.012 * H, 0.05 * H, 0.016 * H, "#2A2A2E", 0);
    }
    box(B.head, 0, headC + b * 1.22, 0, headW * 0.7, 0.012 * H, 0.016 * H, "#2A2A2E");
  }

  // ----- legs -----
  const thighLen = hip - knee;
  const shinLen = knee - ankle;
  for (const [th, sh, s] of [
    [B.lThigh, B.lShin, 1],
    [B.rThigh, B.rShin, -1],
  ] as [number, number, number][]) {
    const x = s * hx;
    if (pants) box(th, x, (hip + knee) / 2 + 0.01 * H, 0, legW, thighLen + 0.03 * H, legW * 1.05, bot);
    else if (l.bottom === "shorts") {
      const cut = knee + thighLen * 0.28;
      box(th, x, (hip + cut) / 2 + 0.01 * H, 0, legW * 1.08, hip - cut + 0.03 * H, legW * 1.1, bot);
      box(th, x, (cut + knee) / 2, 0, legW * 0.9, cut - knee + 0.01, legW * 0.92, skin);
    } else box(th, x, (hip + knee) / 2, 0, legW * 0.9, thighLen + 0.01, legW * 0.92, skin);
    box(sh, x, (knee + ankle) / 2, 0, legW * 0.86, shinLen + 0.012 * H, legW * 0.9, pants ? bot : skin);
    if (l.bottom === "joggers") box(sh, x, ankle + 0.02 * H, 0, legW * 0.95, 0.025 * H, legW, shade(bot, 0.75));
    box(sh, x, ankle * 0.55, 0.028 * H, legW * 1.04, ankle * 1.1, 0.15 * H, l.shoes);
    box(sh, x, 0.008, 0.03 * H, legW * 1.08, 0.016, 0.155 * H, l.shoes === "#F4F4F2" ? "#4A4A4E" : "#EDEAE4");
  }

  // ----- arms -----
  const upperLen = shoulder - elbow;
  const foreLen = elbow - wrist;
  for (const [up, fo, s] of [
    [B.lUpper, B.lFore, 1],
    [B.rUpper, B.rFore, -1],
  ] as [number, number, number][]) {
    const x = s * sx;
    if (long) box(up, x, (shoulder + elbow) / 2, 0, armW, upperLen + 0.03 * H, armW * 1.02, top);
    else {
      const cut = shoulder - upperLen * 0.5;
      box(up, x, (shoulder + cut) / 2 + 0.008 * H, 0, armW * 1.12, shoulder - cut + 0.03 * H, armW * 1.12, top);
      box(up, x, (cut + elbow) / 2, 0, armW * 0.86, cut - elbow + 0.01, armW * 0.86, skin);
    }
    box(fo, x, (elbow + wrist) / 2, 0, armW * 0.86, foreLen + 0.01 * H, armW * 0.86, long ? top : skin);
    if (long) box(fo, x, wrist + 0.012 * H, 0, armW * 0.92, 0.02 * H, armW * 0.92, shade(top, 0.82));
    box(fo, x, wrist - 0.04 * H, 0.004 * H, armW * 0.78, 0.085 * H, armW * 0.58, skin);
  }
  return p;
};

// Merges the parts into one skinned geometry: every vertex follows one bone.
const skinned = (parts: Builder[]) => {
  const geos = parts.map((b) => b.geometry());
  let total = 0;
  for (const g of geos) total += g.getAttribute("position").count;
  const pos = new Float32Array(total * 3);
  const nor = new Int8Array(total * 3);
  const col = new Uint8Array(total * 3);
  const si = new Uint16Array(total * 4);
  const sw = new Float32Array(total * 4);
  let o = 0;
  geos.forEach((g, bone) => {
    const n = g.getAttribute("position").count;
    pos.set(g.getAttribute("position").array as Float32Array, o * 3);
    nor.set(g.getAttribute("normal").array as Int8Array, o * 3);
    col.set(g.getAttribute("color").array as Uint8Array, o * 3);
    for (let v = 0; v < n; v++) {
      si[(o + v) * 4] = bone;
      sw[(o + v) * 4] = 1;
    }
    o += n;
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3, true));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  geo.computeBoundingSphere();
  return geo;
};

// Things people hold: a broom, a watering can, a phone (shared by everyone, sized for 1.75 m).
type PropKind = "none" | "broom" | "can" | "phone";
let propGeos: Record<Exclude<PropKind, "none">, THREE.BufferGeometry> | null = null;
const props = () => {
  if (propGeos) return propGeos;
  const g = (fill: (b: Builder) => void) => {
    const b = new Builder();
    fill(b);
    return b.geometry();
  };
  propGeos = {
    broom: g((b) => {
      b.addE(T.box, 0, -0.32, 0.22, 0.03, 1.3, 0.03, -0.42, 0, 0, C("#9A6A43"));
      b.addE(T.box, 0, -0.88, 0.48, 0.3, 0.14, 0.07, -0.42, 0, 0, C("#D9B45A"));
    }),
    can: g((b) => {
      b.add(T.box, 0, -0.1, 0.06, 0.14, 0.15, 0.22, 0, C("#3E8E4A"));
      b.addE(T.box, 0, -0.08, 0.22, 0.03, 0.03, 0.18, 0.5, 0, 0, C("#3E8E4A"));
      b.add(T.box, 0, 0.0, 0.06, 0.02, 0.06, 0.12, 0, C("#2F6E39"));
    }),
    phone: g((b) => {
      b.add(T.box, 0, -0.02, 0.035, 0.055, 0.1, 0.012, 0, C("#1E1F24"));
      b.add(T.box, 0, -0.02, 0.042, 0.047, 0.088, 0.002, 0, C("#7FB2E0"));
    }),
  };
  return propGeos;
};

export type Rig = {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  dims: Dims;
  prop: THREE.Mesh;
  propKind: PropKind;
  plot: number;
};

export const buildRig = (look: Look, mat: THREE.Material, plot: number): Rig => {
  const d = dimsOf(look);
  const bones = Array.from({ length: NB }, () => new THREE.Bone());
  const at = (i: number, parent: number, x: number, y: number, z: number) => {
    bones[i].position.set(x, y, z);
    if (parent >= 0) bones[parent].add(bones[i]);
  };
  at(B.root, -1, 0, d.hip, 0);
  at(B.spine, B.root, 0, 0, 0);
  at(B.head, B.spine, 0, d.neck - d.hip, 0);
  at(B.lThigh, B.root, d.hx, 0, 0);
  at(B.lShin, B.lThigh, 0, d.knee - d.hip, 0);
  at(B.rThigh, B.root, -d.hx, 0, 0);
  at(B.rShin, B.rThigh, 0, d.knee - d.hip, 0);
  at(B.lUpper, B.spine, d.sx, d.shoulder - d.hip, 0);
  at(B.lFore, B.lUpper, 0, d.elbow - d.shoulder, 0);
  at(B.rUpper, B.spine, -d.sx, d.shoulder - d.hip, 0);
  at(B.rFore, B.rUpper, 0, d.elbow - d.shoulder, 0);
  // Arms and legs: swing (x), then spread (z), then turn about the vertical (y).
  for (const i of [B.lThigh, B.rThigh, B.lUpper, B.rUpper]) bones[i].rotation.order = "YXZ";

  const mesh = new THREE.SkinnedMesh(skinned(buildParts(look, d)), mat);
  mesh.add(bones[B.root]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;

  const prop = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  prop.position.set(0, d.wrist - d.elbow - 0.04 * d.H, 0.01);
  prop.scale.setScalar(d.H / 1.75);
  prop.visible = false;
  bones[B.rFore].add(prop);
  return { mesh, bones, dims: d, prop, propKind: "none", plot };
};

export const disposeRig = (r: Rig) => {
  r.mesh.geometry.dispose();
  r.mesh.skeleton.dispose();
  r.mesh.removeFromParent();
};

const setProp = (r: Rig, k: PropKind) => {
  if (r.propKind === k) return;
  r.propKind = k;
  r.prop.visible = k !== "none";
  if (k !== "none") r.prop.geometry = props()[k];
};

// How high the hips are when the thighs swing by th and the knees bend by kn, feet on the ground.
const hipHeight = (d: Dims, th: number, kn: number) => (d.hip - d.knee) * Math.cos(th) + (d.knee - d.ankle) * Math.cos(th + kn) + d.ankle;

const TAU = Math.PI * 2;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// Puts the skeleton in the pose for this moment.
export const poseRig = (r: Rig, a: Anim) => {
  const b = r.bones;
  const d = r.dims;
  for (const bone of b) bone.rotation.set(0, 0, 0);
  const root = b[B.root];
  root.position.set(0, d.hip, 0);
  const t = a.t + a.seed * 7.3;
  let prop: PropKind = "none";

  // ----- legs and arms for moving -----
  const moving = a.gait > 0 && a.act !== "sitBench" && a.act !== "sitGround" && a.act !== "fall";
  if (moving) {
    const s = Math.sin(a.phase * TAU);
    const c = Math.cos(a.phase * TAU);
    const g = [
      null,
      { th: 0.42, sh: 0.55, arm: 0.36, fore: -0.25, bob: 0.022, lean: 0.03 },
      { th: 0.62, sh: 1.1, arm: 0.55, fore: -1.25, bob: 0.045, lean: 0.12 },
      { th: 0.82, sh: 1.5, arm: 0.8, fore: -1.5, bob: 0.06, lean: 0.22 },
      { th: 0.3, sh: 0.5, arm: 0.12, fore: -0.9, bob: 0.012, lean: 0.4 },
    ][a.gait]!;
    const bend = a.gait === 4 ? 0.55 : 0.06;
    b[B.lThigh].rotation.x = -g.th * s - bend * 0.5;
    b[B.rThigh].rotation.x = g.th * s - bend * 0.5;
    b[B.lShin].rotation.x = bend + g.sh * Math.max(0, c);
    b[B.rShin].rotation.x = bend + g.sh * Math.max(0, -c);
    b[B.lUpper].rotation.x = g.arm * s - (a.gait === 4 ? 0.5 : 0);
    b[B.rUpper].rotation.x = -g.arm * s - (a.gait === 4 ? 0.5 : 0);
    b[B.lFore].rotation.x = g.fore;
    b[B.rFore].rotation.x = g.fore;
    b[B.lUpper].rotation.z = 0.07;
    b[B.rUpper].rotation.z = -0.07;
    b[B.spine].rotation.x = g.lean;
    b[B.spine].rotation.y = 0.06 * s * (a.gait >= 2 ? 1.6 : 1);
    root.position.y = hipHeight(d, bend * 0.5, bend) - g.bob * 0.5 + g.bob * Math.abs(c);
  } else {
    // Standing: breathing, weight shifting from foot to foot.
    b[B.spine].rotation.x = 0.015 * Math.sin(t * 1.7);
    root.rotation.z = 0.018 * Math.sin(t * 0.45);
    b[B.lUpper].rotation.z = 0.08;
    b[B.rUpper].rotation.z = -0.08;
    b[B.lFore].rotation.x = -0.12;
    b[B.rFore].rotation.x = -0.12;
    b[B.head].rotation.y = 0.18 * Math.sin(t * 0.31);
  }

  // ----- what they're doing -----
  const T2 = a.actT;
  switch (a.act) {
    case "phone":
    case "queue": {
      const onPhone = a.act === "phone" || Math.sin(t * 0.21) > 0.35;
      if (onPhone) {
        b[B.rUpper].rotation.set(-0.35, 0.35, 0.12);
        b[B.rFore].rotation.x = -1.8;
        b[B.head].rotation.x = 0.38;
        b[B.head].rotation.y = 0;
        prop = "phone";
      } else if (a.act === "queue") {
        b[B.head].rotation.y = 0.5 * Math.sin(t * 0.5);
        b[B.lUpper].rotation.set(-0.25, -0.5, 0.05);
        b[B.lFore].rotation.x = -1.45;
        b[B.rUpper].rotation.set(-0.25, 0.5, -0.05);
        b[B.rFore].rotation.x = -1.45;
      }
      break;
    }
    case "crossed":
    case "watch":
    case "listen": {
      b[B.lUpper].rotation.set(-0.42, -0.62, 0.05);
      b[B.rUpper].rotation.set(-0.42, 0.62, -0.05);
      b[B.lFore].rotation.x = -1.6;
      b[B.rFore].rotation.x = -1.6;
      if (a.act === "watch") b[B.head].rotation.x = -0.28;
      if (a.act === "listen") b[B.head].rotation.x = 0.07 * Math.sin(t * 2.4);
      break;
    }
    case "stretch": {
      const k = ease(Math.sin(t * 0.9) * 2 - 0.6);
      b[B.lUpper].rotation.x = -0.12 - 2.85 * k;
      b[B.rUpper].rotation.x = -0.12 - 2.85 * k;
      b[B.spine].rotation.x = -0.12 * k;
      break;
    }
    case "look":
      b[B.head].rotation.y = 0.75 * Math.sin(t * 0.6);
      break;
    case "sweep": {
      const sw = Math.sin(t * 3.4);
      b[B.spine].rotation.x = 0.28;
      b[B.spine].rotation.y = 0.32 * sw;
      b[B.lUpper].rotation.set(-0.75, -0.45, 0);
      b[B.rUpper].rotation.set(-0.45, 0.25, 0);
      b[B.lFore].rotation.x = -0.6;
      b[B.rFore].rotation.x = -0.3;
      prop = "broom";
      break;
    }
    case "water":
      b[B.rUpper].rotation.set(-1.0, 0.15, 0);
      b[B.rFore].rotation.x = -0.25 + 0.08 * Math.sin(t * 1.3);
      b[B.head].rotation.x = 0.3;
      prop = "can";
      break;
    case "mailbox":
      b[B.lUpper].rotation.x = -1.0;
      b[B.rUpper].rotation.x = -1.05 + 0.12 * Math.sin(t * 4);
      b[B.lFore].rotation.x = -0.45;
      b[B.rFore].rotation.x = -0.4;
      b[B.head].rotation.x = 0.32;
      b[B.spine].rotation.x = 0.1;
      break;
    case "sitBench":
    case "sitGround": {
      const bench = a.act === "sitBench";
      const th = bench ? -1.52 : -1.45;
      const kn = bench ? 1.5 : 0.08;
      b[B.lThigh].rotation.set(th, 0, 0.06);
      b[B.rThigh].rotation.set(th, 0, -0.06);
      b[B.lShin].rotation.x = kn;
      b[B.rShin].rotation.x = kn;
      root.position.y = bench ? 0.6 : d.legW * 0.55 + 0.02;
      if (bench) {
        b[B.spine].rotation.x = -0.06;
        b[B.lUpper].rotation.x = -0.55;
        b[B.rUpper].rotation.x = -0.55;
        b[B.lFore].rotation.x = -0.85;
        b[B.rFore].rotation.x = -0.85;
        if (Math.sin(t * 0.17) > 0.3) {
          b[B.rUpper].rotation.set(-0.45, 0.35, 0.1);
          b[B.rFore].rotation.x = -1.75;
          b[B.head].rotation.x = 0.35;
          prop = "phone";
        }
      } else {
        b[B.spine].rotation.x = -0.32;
        b[B.lUpper].rotation.set(0.6, 0, 0.18);
        b[B.rUpper].rotation.set(0.6, 0, -0.18);
        b[B.lFore].rotation.x = 0.05;
        b[B.rFore].rotation.x = 0.05;
        b[B.head].rotation.x = -0.15 + 0.1 * Math.sin(t * 0.4);
      }
      root.rotation.z = 0;
      break;
    }
    case "chat": {
      b[B.lUpper].rotation.x = -0.3;
      b[B.rUpper].rotation.x = -0.35;
      b[B.lFore].rotation.x = -1.05 + 0.4 * Math.sin(t * 4.1);
      b[B.rFore].rotation.x = -0.9 + 0.4 * Math.sin(t * 4.7 + 1);
      b[B.lUpper].rotation.y = -0.25;
      b[B.rUpper].rotation.y = 0.25;
      b[B.head].rotation.x = 0.06 * Math.sin(t * 3);
      b[B.head].rotation.y = 0.12 * Math.sin(t * 1.3);
      break;
    }
    case "fight": {
      // Square up, fists by the face, and throw punches in turn with the other fighter.
      const th = -0.22;
      const kn = 0.38;
      b[B.lThigh].rotation.set(th - 0.12, 0, 0.12);
      b[B.rThigh].rotation.set(th + 0.18, 0, -0.12);
      b[B.lShin].rotation.x = kn;
      b[B.rShin].rotation.x = kn;
      root.position.y = hipHeight(d, th, kn) + 0.02 * Math.sin(t * 7);
      const guardL = () => {
        b[B.lUpper].rotation.set(-0.95, -0.4, 0.1);
        b[B.lFore].rotation.x = -1.9;
      };
      const guardR = () => {
        b[B.rUpper].rotation.set(-0.95, 0.4, -0.1);
        b[B.rFore].rotation.x = -1.9;
      };
      guardL();
      guardR();
      const cyc = (T2 * 1.35 + a.side * 0.5) % 1;
      const left = Math.floor(T2 * 1.35 + a.side * 0.5) % 2 === 0;
      if (T2 > 1.2 && cyc < 0.42) {
        const k = Math.sin((cyc / 0.42) * Math.PI);
        if (left) {
          b[B.lUpper].rotation.set(-0.95 - 0.65 * k, -0.4 + 0.25 * k, 0.1);
          b[B.lFore].rotation.x = -1.9 + 1.75 * k;
        } else {
          b[B.rUpper].rotation.set(-0.95 - 0.65 * k, 0.4 - 0.25 * k, -0.1);
          b[B.rFore].rotation.x = -1.9 + 1.75 * k;
        }
        b[B.spine].rotation.y = (left ? -0.35 : 0.35) * k;
        b[B.spine].rotation.x = 0.1 * k;
      } else if (T2 > 1.2 && cyc > 0.55 && cyc < 0.75) {
        // Taking a hit from the other one.
        const k = Math.sin(((cyc - 0.55) / 0.2) * Math.PI);
        b[B.head].rotation.x = -0.3 * k;
        b[B.spine].rotation.x = -0.15 * k;
      }
      break;
    }
    case "fall": {
      // Knocked over backwards, lying there, then getting up at the end.
      const down = ease(T2 / 0.45);
      const up = ease((T2 - (a.actDur - 1.3)) / 1.3);
      const k = Math.max(0, down - up);
      root.rotation.x = -1.5 * k;
      root.position.y = d.hip + (d.torsoD * 0.55 + 0.02 - d.hip) * k;
      b[B.lUpper].rotation.z = 0.08 + 1.0 * k;
      b[B.rUpper].rotation.z = -0.08 - 1.0 * k;
      b[B.lThigh].rotation.x = -0.25 * k;
      b[B.lShin].rotation.x = 0.5 * k;
      b[B.head].rotation.x = 0.25 * k;
      break;
    }
    case "cheer": {
      const j = Math.max(0, Math.sin(t * 8.5));
      b[B.lUpper].rotation.set(-2.75 + 0.2 * j, 0, 0.35);
      b[B.rUpper].rotation.set(-2.75 + 0.2 * j, 0, -0.35);
      b[B.lFore].rotation.x = -0.3;
      b[B.rFore].rotation.x = -0.3;
      root.position.y += 0.06 * j;
      break;
    }
    case "grab": {
      const th = -1.0;
      const kn = 1.55;
      b[B.lThigh].rotation.set(th, 0, 0.1);
      b[B.rThigh].rotation.set(th + 0.25, 0, -0.1);
      b[B.lShin].rotation.x = kn;
      b[B.rShin].rotation.x = kn - 0.2;
      root.position.y = hipHeight(d, th, kn);
      b[B.spine].rotation.x = 0.6;
      b[B.rUpper].rotation.x = -1.15 + 0.2 * Math.sin(t * 6);
      b[B.rFore].rotation.x = -0.45;
      b[B.lUpper].rotation.x = -0.5;
      b[B.lFore].rotation.x = -0.9;
      b[B.head].rotation.x = -0.3;
      b[B.head].rotation.y = 0.5 * Math.sin(t * 1.7);
      break;
    }
    case "shakeFist":
      b[B.rUpper].rotation.set(-2.4, 0, -0.15);
      b[B.rFore].rotation.x = -0.75 + 0.35 * Math.sin(t * 15);
      b[B.lUpper].rotation.z = 0.25;
      b[B.head].rotation.x = -0.12;
      break;
    case "flinch": {
      const k = Math.exp(-T2 * 2.5);
      b[B.spine].rotation.x = -0.35 * k;
      b[B.head].rotation.x = -0.3 * k;
      b[B.lUpper].rotation.set(-1.2 * k, -0.3 * k, 0.08);
      b[B.rUpper].rotation.set(-1.2 * k, 0.3 * k, -0.08);
      b[B.lFore].rotation.x = -1.8 * k;
      b[B.rFore].rotation.x = -1.8 * k;
      break;
    }
    case "wave":
      b[B.rUpper].rotation.set(-0.1, 0, -2.55);
      b[B.rFore].rotation.z = 0.45 * Math.sin(t * 10);
      break;
    case "none":
      break;
  }
  setProp(r, prop);
};
