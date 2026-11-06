// Everything outside the town you're looking at: the countryside, the sea, highways between towns,
// the jungle round the towns (jungle.ts), and every other town in simple form. Far towns and the farmland are instanced (one shape drawn
// many times), so a world of 100 towns and 100,000 houses still costs only a few draw calls.
import * as THREE from "three";
import { TOWN_SIZE, firstPlotOf } from "@/lib/world";
import { Builder, C, T, roofTpl, type Tpl } from "./geo";
import { CRANE, LAMP_HEAD } from "./build";
import { buildCanopy, inJungle } from "./jungle";
import { houseSpec } from "./spec";
import { HOSPITAL, WORK, workBuildings, type WorkKind } from "../people/nav";
import {
  ASPHALT,
  BX,
  BZ,
  FH,
  GRASS,
  HIGHWAY_OFF,
  LAWN,
  PX,
  PZ,
  SEA_Z,
  TOWN_HALF,
  TOWN_PITCH,
  TOWN_RINGS,
  WALK,
  Y0,
  hashStr,
  isCivic,
  isPark,
  isPlaza,
  lotForPlot,
  pick,
  rng,
  townCell,
  townCenter,
} from "./layout";

const LEAF = ["#5DAE45", "#6CBB4C", "#4F9F3D", "#78C257", "#64B04A"];
const PINE = ["#3E8E4A", "#2F7D45", "#47975A"];
const FIELDS = ["#B5DB7E", "#A4D16E", "#E2CF7F", "#D7BE8E", "#C3DF8A", "#9DCB63", "#E8D88F"];
const MARGIN = 1700; // countryside beyond the outermost towns
// Wall and roof colours of the workplaces, seen from afar.
const FAR_WORK: Record<WorkKind, [string, string]> = {
  police: ["#E9EEF4", "#1E4B9A"],
  fire: ["#B8432F", "#F2EEE6"],
  engineer: ["#6E9BB8", "#2B3440"],
  bank: ["#EFE6D2", "#D8B34A"],
  school: ["#F3CF79", "#C8443A"],
  film: ["#4A4E57", "#C9CDD3"],
};

// A growable list of instances: a transform (scale, turn about y, move) and a colour each.
export class Inst {
  private m = new Float32Array(16 * 256);
  private c = new Float32Array(3 * 256);
  count = 0;

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, col: THREE.Color) {
    if ((this.count + 1) * 16 > this.m.length) {
      const m = new Float32Array(this.m.length * 2);
      m.set(this.m);
      this.m = m;
      const c = new Float32Array(this.c.length * 2);
      c.set(this.c);
      this.c = c;
    }
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const o = this.count * 16;
    const e = this.m;
    e[o] = cs * sx;
    e[o + 1] = 0;
    e[o + 2] = -sn * sx;
    e[o + 3] = 0;
    e[o + 4] = 0;
    e[o + 5] = sy;
    e[o + 6] = 0;
    e[o + 7] = 0;
    e[o + 8] = sn * sz;
    e[o + 9] = 0;
    e[o + 10] = cs * sz;
    e[o + 11] = 0;
    e[o + 12] = x;
    e[o + 13] = y;
    e[o + 14] = z;
    e[o + 15] = 1;
    const k = this.count * 3;
    this.c[k] = col.r;
    this.c[k + 1] = col.g;
    this.c[k + 2] = col.b;
    this.count++;
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, this.count);
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(this.m.slice(0, this.count * 16), 16);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(this.c.slice(0, this.count * 3), 3);
    mesh.computeBoundingSphere();
    return mesh;
  }
}

export const tplGeo = (t: Tpl) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(t.p, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(t.n, 3));
  return g;
};

// Shapes shared by every instanced mesh (never disposed).
export const SHAPES = {
  box: tplGeo(T.box),
  quad: tplGeo(T.quadY),
  ico: tplGeo(T.ico),
  cone: tplGeo(T.cone),
  cyl: tplGeo(T.cyl),
  roof: tplGeo(roofTpl(0.5)),
};

export type Trees = { crowns: Inst; pines: Inst; trunks: Inst };
const newTrees = (): Trees => ({ crowns: new Inst(), pines: new Inst(), trunks: new Inst() });

const tree = (t: Trees, x: number, z: number, s: number, r: () => number) => {
  t.trunks.add(x, 1.6 * s, z, 0.3 * s, 3.2 * s, 0.3 * s, 0, C("#7A4E2D"));
  t.crowns.add(x, 4.7 * s, z, 2.2 * s, 2.3 * s, 2.2 * s, r() * 6, C(pick(r, LEAF)));
};

const pine = (t: Trees, x: number, z: number, s: number, r: () => number) => {
  t.trunks.add(x, 0.6 * s, z, 0.25 * s, 1.2 * s, 0.25 * s, 0, C("#6E4528"));
  const col = C(pick(r, PINE));
  t.pines.add(x, 3.2 * s, z, 1.7 * s, 4.4 * s, 1.7 * s, r() * 6, col);
  t.pines.add(x, 5.2 * s, z, 1.15 * s, 3.0 * s, 1.15 * s, r() * 6, col);
};

// Which towns get drawn: every town up to `maxTown` (a whole ring of the grid), and the area they cover.
export type Extent = { minX: number; maxX: number; minZ: number; maxZ: number; minGx: number; maxGx: number; maxGz: number };

export const extentOf = (maxTown: number): Extent => {
  let minGx = 0;
  let maxGx = 0;
  let maxGz = 0;
  for (let t = 1; t <= maxTown; t++) {
    const [gx, gz] = townCell(t);
    minGx = Math.min(minGx, gx);
    maxGx = Math.max(maxGx, gx);
    maxGz = Math.max(maxGz, gz);
  }
  return {
    minGx,
    maxGx,
    maxGz,
    minX: minGx * TOWN_PITCH.x - TOWN_HALF.x,
    maxX: maxGx * TOWN_PITCH.x + TOWN_HALF.x,
    minZ: -TOWN_HALF.z,
    maxZ: maxGz * TOWN_PITCH.z + TOWN_HALF.z,
  };
};

export type CountryBuild = {
  ground: THREE.BufferGeometry;
  fields: Inst;
  trees: Trees;
};

// Grass to the horizon, the beach and the sea, highways along every row and column of towns, the
// jungle round the towns, and farmland with hedgerow trees beyond it.
export const buildCountry = (ext: Extent, maxTown: number, lowPower: boolean): CountryBuild => {
  const b = new Builder();
  const fields = new Inst();
  const trees = newTrees();
  const x0 = ext.minX - MARGIN;
  const x1 = ext.maxX + MARGIN;
  const z1 = ext.maxZ + MARGIN;
  const far = Math.max(x1 - x0, z1 - SEA_Z) * 4;
  const cx = (x0 + x1) / 2;

  b.add(T.box, cx, -0.25, (SEA_Z + z1) / 2 + far / 4, far * 2, 0.3, far * 2, 0, C(GRASS));
  b.add(T.box, cx, 0.06, SEA_Z - 16, far * 2, 0.12, 32, 0, C("#EADBAA"));
  b.add(T.box, cx, 0.08, SEA_Z - 32 - far / 2, far * 2, 0.12, far, 0, C("#3D95CB"));

  // Highways (below the towns' own asphalt, so inside a town only the town's streets show).
  const hz: number[] = [];
  const hx: number[] = [];
  for (let gz = 0; gz <= ext.maxGz + 1; gz++) hz.push(gz * TOWN_PITCH.z + HIGHWAY_OFF.z);
  for (let gx = ext.minGx - 1; gx <= ext.maxGx + 1; gx++) hx.push(gx * TOWN_PITCH.x + HIGHWAY_OFF.x);
  const asphalt = C(ASPHALT);
  const paint = C("#F2F0E6");
  for (const z of hz) {
    b.add(T.box, cx, 0.04, z, x1 - x0 + far, 0.08, 14, 0, asphalt);
    b.add(T.box, cx, 0.085, z, x1 - x0 + far, 0.01, 0.3, 0, paint);
  }
  const zTop = -TOWN_HALF.z - 4;
  for (const x of hx) {
    b.add(T.box, x, 0.04, (zTop + z1 + far) / 2, 14, 0.08, z1 + far - zTop, 0, asphalt);
    b.add(T.box, x, 0.085, (zTop + z1 + far) / 2, 0.3, 0.01, z1 + far - zTop, 0, paint);
  }

  const r = rng(4242);
  const inTown = (x: number, z: number) => {
    const gx = Math.round(x / TOWN_PITCH.x);
    const gz = Math.round(z / TOWN_PITCH.z);
    if (gz < 0 || gz > ext.maxGz || gx < ext.minGx || gx > ext.maxGx) return false;
    return Math.abs(x - gx * TOWN_PITCH.x) < TOWN_HALF.x + 58 && Math.abs(z - gz * TOWN_PITCH.z) < TOWN_HALF.z + 52;
  };
  const nearRoad = (x: number, z: number) =>
    hz.some((h) => Math.abs(z - h) < 34 + 10) || hx.some((h) => Math.abs(x - h) < 42 + 10);

  for (let gx = x0; gx < x1; gx += 92)
    for (let gz = SEA_Z + 45; gz < z1; gz += 76) {
      const fx = gx + (r() - 0.5) * 8;
      const fz = gz + (r() - 0.5) * 8;
      const a = r();
      const hedge = r() < 0.28;
      const wood = r() < 0.07;
      if (inTown(fx, fz) || nearRoad(fx, fz) || inJungle(ext, fx, fz, 46)) continue;
      fields.add(fx, 0.06, fz, 84 + a * 4, 1, 68 + a * 4, 0, C(pick(r, FIELDS)));
      if (hedge) for (let t = 0; t < 5; t++) tree(trees, fx - 40 + t * 20 + r() * 4, fz + 36.5, 1.1 + r() * 0.4, r);
      if (wood) for (let t = 0; t < 10; t++) pine(trees, fx + (r() - 0.5) * 70, fz + (r() - 0.5) * 56, 1.4 + r() * 0.8, r);
    }

  buildCanopy(b, trees, ext, maxTown, lowPower);
  return { ground: b.geometry(), fields, trees };
};

export type FarBuild = {
  ground: THREE.BufferGeometry;
  bodies: Inst;
  roofs: Inst;
  cranes: Inst;
  trees: Trees;
  lights: number[]; // a window light per house and the street lamps (x, y, z), for night
};

// Every drawn town except the one shown in detail: streets, blocks, a plaza with its two landmarks,
// park trees, and one simple block per house. houses(t) = how many houses town t has.
export const buildFarTowns = (maxTown: number, skip: number, houses: (t: number) => number): FarBuild => {
  const b = new Builder();
  const bodies = new Inst();
  const roofs = new Inst();
  const cranes = new Inst();
  const trees = newTrees();
  const lights: number[] = [];
  const R = TOWN_RINGS;
  const walk = C(WALK);
  const lawn = C(LAWN);

  for (let t = 1; t <= maxTown; t++) {
    if (t === skip) continue;
    const [ox, oz] = townCenter(t);
    b.add(T.box, ox, 0.05, oz, 2 * TOWN_HALF.x, 0.1, 2 * TOWN_HALF.z, 0, C(ASPHALT));
    const r = rng(hashStr(`far:${t}`));
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++) {
        const cx = ox + i * PX;
        const cz = oz + j * PZ;
        b.add(T.box, cx, 0.15, cz, BX, 0.3, BZ, 0, walk);
        if (isPlaza(i, j)) {
          b.add(T.quadY, cx, 0.42, cz, BX - 3.2, 1, BZ - 3.2, 0, C("#E7DDC8"));
          b.add(T.box, cx - 14.8, Y0 + 12.5, cz + 12.5, 4.1, 25, 4.1, 0, C("#F0DDB0"));
          b.add(roofTpl(0), cx - 14.8, Y0 + 25, cz + 12.5, 5.4, 7, 5.4, 0, C("#D2483A"));
          b.add(T.taper, cx + 14.8, Y0 + 11, cz - 12.5, 2.8, 22, 2.8, 0, C("#E9E3D8"));
          b.add(T.cone, cx + 14.8, Y0 + 23.5, cz - 12.5, 2.2, 3, 2.2, 0, C("#C8402F"));
        } else if (isCivic(i, j)) {
          b.add(T.quadY, cx, 0.42, cz, BX - 3.2, 1, BZ - 3.2, 0, lawn);
        } else if (isPark(i, j)) {
          b.add(T.quadY, cx, 0.42, cz, BX - 3.2, 1, BZ - 3.2, 0, C("#8ED061"));
          b.add(T.quadY, cx, 0.44, cz, 13, 1, 8.5, 0, C("#6FC0E6"));
          for (let n = 0; n < 6; n++) tree(trees, cx + (r() - 0.5) * (BX - 10), cz + (r() < 0.5 ? -1 : 1) * (9 + r() * 7), 1, r);
        } else {
          b.add(T.quadY, cx, 0.42, cz, BX - 3.2, 1, BZ - 3.2, 0, lawn);
        }
        if (Math.max(Math.abs(i), Math.abs(j)) <= 4)
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) lights.push(cx + sx * (BX / 2 - 0.8), 0.3 + LAMP_HEAD, cz + sz * (BZ / 2 - 0.8));
      }

    // The hospital and the civic quarter's workplaces, as plain blocks.
    bodies.add(ox + HOSPITAL.x, Y0 + 0.2 + HOSPITAL.h / 2, oz + HOSPITAL.z, HOSPITAL.hx * 2, HOSPITAL.h, HOSPITAL.hz * 2, 0, C("#F4F1EA"));
    for (const w of workBuildings(t)) {
      const [wall, roof] = FAR_WORK[w.kind];
      const h = WORK[w.kind].h;
      bodies.add(w.x, Y0 + 0.2 + h / 2, w.z, w.hx * 2, h, w.hz * 2, 0, C(wall));
      bodies.add(w.x, Y0 + 0.2 + h + 0.2, w.z, w.hx * 2 + 0.3, 0.4, w.hz * 2 + 0.3, 0, C(roof));
    }
    const n = Math.min(TOWN_SIZE, houses(t));
    const first = firstPlotOf(t);
    for (let q = 0; q < n; q++) {
      const plot = first + q;
      const lot = lotForPlot(plot);
      const h = houseSpec(plot, lot, lot.x, lot.z);
      const wallH = Math.max(1.2, h.wallH);
      bodies.add(lot.x, Y0 + 0.4 + wallH / 2, lot.z, h.w + 0.6, wallH, h.d + 0.6, h.rot, C(h.wall));
      if (h.stage >= 2) lights.push(lot.x, Y0 + 0.4 + wallH * 0.6, lot.z + (lot.rot === 0 ? 1 : -1) * (h.d / 2 + 0.5));
      if (h.stage === 2 && h.roof !== "flat") {
        roofs.add(lot.x, Y0 + 0.4 + h.floors * FH, lot.z, h.w + 0.6, h.rh, h.d + 0.6, h.rot, C(h.roofC));
      } else {
        // Unfinished: the frame and scaffolding read as a pale cage on top.
        const cage = h.frameTop - h.wallH + 1;
        bodies.add(lot.x, Y0 + 0.4 + wallH + cage / 2, lot.z, h.w + 1.4, cage, h.d + 1.4, h.rot, C("#D9D2C2"));
      }
      if (h.stage === 1 && lot.ring >= 2 && rng(hashStr(`site:${plot}`))() < 0.05) {
        cranes.add(lot.x, Y0 + 11, lot.z - 6, 0.9, 22, 0.9, 0, C(CRANE));
        cranes.add(lot.x + 6, Y0 + 22.4, lot.z - 6, 14, 0.8, 0.8, 0, C(CRANE));
      }
    }
  }

  return { ground: b.geometry(), bodies, roofs, cranes, trees, lights };
};
