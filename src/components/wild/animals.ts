// The animals of the jungle next to the town drawn in detail: a herd of elephants with a calf, a
// Bengal tiger, spotted deer, langur monkeys in the banyan, peafowl, and birds (bats at night)
// circling over the clearing. Where each animal is and what it does comes from the clock alone
// (seeded by town and animal), so everyone sees the same jungle; only how they react to you (deer
// running off, the tiger growling, an elephant trumpeting) happens on your own screen.
// Bodies are small hierarchies of low-poly parts (legs, head, trunk, tail) posed every frame.
import * as THREE from "three";
import { Builder, C, T } from "../land/geo";
import { BANYAN_PERCHES, JUNGLE, aroundPond, jungleOf, pondR, type JungleSpot } from "../land/jungle";
import { hashStr, rng } from "../land/layout";

export type AnimalKind = "elephant" | "calf" | "tiger" | "deer" | "stag" | "monkey" | "peacock" | "peahen";

export const ANIMAL_NAME: Record<AnimalKind, string> = {
  elephant: "Asian elephant",
  calf: "Elephant calf",
  tiger: "Bengal tiger",
  deer: "Spotted deer",
  stag: "Spotted deer stag",
  monkey: "Langur monkey",
  peacock: "Peacock",
  peahen: "Peahen",
};

type Act = "walk" | "run" | "graze" | "browse" | "drink" | "lie" | "rest" | "look" | "roar" | "trumpet" | "display" | "scratch" | "perch" | "hop";

const DOING: Record<Act, string> = {
  walk: "Wandering",
  run: "Running off",
  graze: "Grazing",
  browse: "Eating leaves",
  drink: "Drinking at the waterhole",
  lie: "Lying down",
  rest: "Resting",
  look: "Keeping watch",
  roar: "Roaring",
  trumpet: "Trumpeting",
  display: "Showing off his tail",
  scratch: "Scratching",
  perch: "Up in the banyan",
  hop: "Hopping about",
};

// Something worth a note on your screen (you got close, or tapped an animal).
export type AnimalNote = { kind: AnimalKind; text: string };

const NOTICE: Partial<Record<AnimalKind, string>> = {
  tiger: "The tiger growls at you. Back off slowly!",
  elephant: "The elephant trumpets. Give the herd some room.",
  calf: "The calf's mother is watching you.",
  deer: "The deer bolt into the trees.",
  stag: "The stag bolts into the trees.",
  peacock: "The peacock fans out his tail.",
  monkey: "A langur hops away, chattering.",
};

// ---------- bodies ----------

type Rig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[]; // front left, front right, back left, back right
  tail: THREE.Group[];
  trunk: THREE.Group[];
  ears: THREE.Group[];
  arms: THREE.Group[];
  jaw: THREE.Group | null;
  fan: THREE.Group | null;
  train: THREE.Object3D | null;
  meshes: THREE.Mesh[];
  r: number; // size, for picking and tags
  h: number;
};

const geoCache = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, fill: (b: Builder) => void) => {
  let g = geoCache.get(key);
  if (!g) {
    const b = new Builder();
    fill(b);
    g = b.geometry();
    geoCache.set(key, g);
  }
  return g;
};

class Maker {
  readonly meshes: THREE.Mesh[] = [];
  constructor(private mat: THREE.Material) {}
  pivot(parent: THREE.Object3D, x: number, y: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  mesh(parent: THREE.Object3D, key: string, fill: (b: Builder) => void) {
    const m = new THREE.Mesh(geo(key, fill), this.mat);
    parent.add(m);
    this.meshes.push(m);
    return m;
  }
}

const rigOf = (m: Maker, root: THREE.Group, body: THREE.Group, head: THREE.Group, r: number, h: number): Rig => ({
  root,
  body,
  head,
  legs: [],
  tail: [],
  trunk: [],
  ears: [],
  arms: [],
  jaw: null,
  fan: null,
  train: null,
  meshes: m.meshes,
  r,
  h,
});

const GREY = "#7D7774";
const GREY_D = "#6C6664";

const makeElephant = (mat: THREE.Material, tusks: boolean): Rig => {
  const m = new Maker(mat);
  const root = new THREE.Group();
  const body = m.pivot(root, 0, 0, 0);
  m.mesh(body, "el-body", (b) => {
    b.add(T.ico1, 0, 1.95, 0, 1.05, 1.0, 1.55, 0, C(GREY));
    b.add(T.ico1, 0, 1.68, 0.05, 0.95, 0.78, 1.25, 0, C(GREY_D));
    b.add(T.ico1, 0, 2.35, 0.45, 0.85, 0.62, 0.85, 0, C(GREY));
    b.add(T.ico1, 0, 2.15, -0.75, 0.9, 0.85, 0.75, 0, C(GREY));
  });
  const head = m.pivot(body, 0, 2.35, 1.45);
  m.mesh(head, "el-head", (b) => {
    b.add(T.ico1, 0, 0.1, 0.35, 0.62, 0.72, 0.6, 0, C(GREY));
    for (const s of [-1, 1]) {
      b.add(T.ico1, s * 0.2, 0.55, 0.42, 0.32, 0.3, 0.3, 0, C(GREY));
      b.add(T.box, s * 0.47, 0.22, 0.6, 0.05, 0.07, 0.07, 0, C("#1A1614"));
    }
  });
  if (tusks)
    m.mesh(head, "el-tusks", (b) => {
      for (const s of [-1, 1]) b.addE(T.cone, s * 0.22, -0.3, 0.78, 0.07, 0.6, 0.07, 1.88, 0, 0, C("#F2EBDA"));
    });
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ear = m.pivot(head, s * 0.5, 0.28, 0.42);
    m.mesh(ear, s < 0 ? "el-ear-l" : "el-ear-r", (b) => {
      b.addE(T.disc, s * 0.06, -0.22, -0.46, 0.66, 0.06, 0.66, 0, 0, Math.PI / 2, C("#857E7B"));
      b.addE(T.disc, s * 0.025, -0.24, -0.46, 0.5, 0.02, 0.5, 0, 0, Math.PI / 2, C("#A88A86"));
    });
    ears.push(ear);
  }
  const t1 = m.pivot(head, 0, -0.05, 0.85);
  m.mesh(t1, "el-t1", (b) => b.add(T.disc8, 0, -0.32, 0, 0.2, 0.66, 0.2, 0, C(GREY)));
  const t2 = m.pivot(t1, 0, -0.62, 0);
  m.mesh(t2, "el-t2", (b) => b.add(T.disc8, 0, -0.3, 0, 0.15, 0.62, 0.15, 0, C(GREY)));
  const t3 = m.pivot(t2, 0, -0.58, 0);
  m.mesh(t3, "el-t3", (b) => {
    b.add(T.disc8, 0, -0.27, 0, 0.11, 0.56, 0.11, 0, C(GREY));
    b.add(T.disc8, 0, -0.56, 0, 0.13, 0.06, 0.13, 0, C(GREY_D));
  });
  const rig = rigOf(m, root, body, head, 2.2, 3.1);
  rig.ears = ears;
  rig.trunk = [t1, t2, t3];
  for (const [x, z] of [
    [-0.55, 0.82],
    [0.55, 0.82],
    [-0.55, -0.85],
    [0.55, -0.85],
  ]) {
    const leg = m.pivot(body, x, 1.5, z);
    m.mesh(leg, "el-leg", (b) => {
      b.add(T.disc8, 0, -0.75, 0, 0.3, 1.5, 0.3, 0, C(GREY));
      b.add(T.disc8, 0, -1.43, 0, 0.34, 0.14, 0.34, 0, C("#9A9490"));
    });
    rig.legs.push(leg);
  }
  const tail = m.pivot(body, 0, 2.1, -1.5);
  m.mesh(tail, "el-tail", (b) => {
    b.add(T.disc8, 0, -0.47, 0, 0.05, 0.95, 0.05, 0, C(GREY_D));
    b.add(T.box, 0, -0.97, 0, 0.1, 0.2, 0.06, 0, C("#2E2A28"));
  });
  rig.tail = [tail];
  return rig;
};

const ORANGE = "#E07A2A";
const STRIPE = "#231812";
const CREAM = "#F4EBDD";

const makeTiger = (mat: THREE.Material): Rig => {
  const m = new Maker(mat);
  const root = new THREE.Group();
  const body = m.pivot(root, 0, 0, 0);
  m.mesh(body, "tg-body", (b) => {
    b.add(T.box, 0, 0.8, 0, 0.5, 0.46, 1.3, 0, C(ORANGE));
    b.add(T.box, 0, 0.6, 0, 0.44, 0.14, 1.05, 0, C(CREAM));
    b.add(T.box, 0, 0.74, 0.62, 0.38, 0.32, 0.12, 0, C(CREAM));
    b.add(T.box, 0, 0.84, 0.42, 0.54, 0.4, 0.36, 0, C(ORANGE));
    b.add(T.box, 0, 0.82, -0.42, 0.54, 0.44, 0.4, 0, C(ORANGE));
    for (const z of [-0.56, -0.4, -0.22, -0.04, 0.14, 0.3, 0.5]) b.addE(T.box, 0, 0.9, z, 0.56, 0.31, 0.06, 0.18, 0, 0, C(STRIPE));
  });
  const head = m.pivot(body, 0, 0.95, 0.66);
  m.mesh(head, "tg-head", (b) => {
    b.add(T.box, 0, 0.04, 0.16, 0.42, 0.36, 0.36, 0, C(ORANGE));
    b.add(T.box, 0, -0.07, 0.15, 0.48, 0.15, 0.28, 0, C(CREAM));
    b.add(T.box, 0, -0.06, 0.38, 0.24, 0.14, 0.14, 0, C(CREAM));
    b.add(T.box, 0, 0.02, 0.455, 0.09, 0.06, 0.04, 0, C("#3A2A28"));
    for (const s of [-1, 1]) {
      b.add(T.box, s * 0.1, 0.1, 0.342, 0.07, 0.045, 0.02, 0, C("#D8E04A"));
      b.add(T.box, s * 0.1, 0.1, 0.354, 0.025, 0.045, 0.01, 0, C(STRIPE));
      b.add(T.box, s * 0.15, 0.25, 0.08, 0.11, 0.11, 0.05, 0, C(ORANGE));
      b.add(T.box, s * 0.15, 0.25, 0.108, 0.06, 0.06, 0.01, 0, C(CREAM));
      b.add(T.box, s * 0.215, 0.05, 0.12, 0.01, 0.16, 0.035, 0, C(STRIPE));
    }
    for (const x of [-0.07, 0, 0.07]) b.add(T.box, x, 0.17, 0.342, 0.03, 0.1, 0.02, 0, C(STRIPE));
  });
  const jaw = m.pivot(head, 0, -0.13, 0.3);
  m.mesh(jaw, "tg-jaw", (b) => {
    b.add(T.box, 0, -0.03, 0.08, 0.2, 0.06, 0.2, 0, C(CREAM));
    b.add(T.box, 0, 0.004, 0.08, 0.17, 0.02, 0.17, 0, C("#A8323A"));
  });
  const rig = rigOf(m, root, body, head, 1.3, 1.2);
  rig.jaw = jaw;
  for (const [x, y, z] of [
    [-0.17, 0.66, 0.5],
    [0.17, 0.66, 0.5],
    [-0.17, 0.68, -0.5],
    [0.17, 0.68, -0.5],
  ]) {
    const leg = m.pivot(body, x, y, z);
    m.mesh(leg, "tg-leg", (b) => {
      b.add(T.box, 0, -0.33, 0, 0.15, 0.66, 0.17, 0, C(ORANGE));
      b.add(T.box, 0, -0.25, 0, 0.16, 0.05, 0.18, 0, C(STRIPE));
      b.add(T.box, 0, -0.62, 0.03, 0.18, 0.08, 0.22, 0, C("#F2DCC0"));
    });
    rig.legs.push(leg);
  }
  const t1 = m.pivot(body, 0, 0.92, -0.66);
  m.mesh(t1, "tg-tail1", (b) => {
    b.add(T.disc8, 0, -0.25, 0, 0.055, 0.5, 0.055, 0, C(ORANGE));
    b.add(T.disc8, 0, -0.3, 0, 0.062, 0.06, 0.062, 0, C(STRIPE));
  });
  const t2 = m.pivot(t1, 0, -0.5, 0);
  m.mesh(t2, "tg-tail2", (b) => {
    b.add(T.disc8, 0, -0.22, 0, 0.05, 0.45, 0.05, 0, C(ORANGE));
    for (const y of [-0.12, -0.3]) b.add(T.disc8, 0, y, 0, 0.057, 0.05, 0.057, 0, C(STRIPE));
    b.add(T.disc8, 0, -0.43, 0, 0.052, 0.08, 0.052, 0, C(STRIPE));
  });
  rig.tail = [t1, t2];
  return rig;
};

const DEER = "#B8723C";
const DEER_D = "#5A3A20";

const makeDeer = (mat: THREE.Material, stag: boolean): Rig => {
  const m = new Maker(mat);
  const root = new THREE.Group();
  const body = m.pivot(root, 0, 0, 0);
  m.mesh(body, "dr-body", (b) => {
    b.add(T.ico1, 0, 0.8, 0, 0.25, 0.27, 0.56, 0, C(DEER));
    b.add(T.ico1, 0, 0.66, 0, 0.2, 0.12, 0.44, 0, C(CREAM));
    b.add(T.ico1, 0, 0.8, -0.5, 0.15, 0.15, 0.1, 0, C(CREAM));
    const r = rng(77);
    for (let n = 0; n < 26; n++) {
      const z = (r() - 0.5) * 0.8;
      const y = 0.8 + (r() - 0.2) * 0.17;
      const q = 1 - ((y - 0.8) / 0.27) ** 2 - (z / 0.56) ** 2;
      if (q < 0.15) continue;
      const x = 0.25 * Math.sqrt(q) * 0.92 + 0.004;
      for (const s of [-1, 1]) b.add(T.box, s * x, y, z, 0.012, 0.024, 0.034, 0, C(CREAM));
    }
  });
  const head = m.pivot(body, 0, 0.92, 0.42);
  m.mesh(head, stag ? "dr-head-stag" : "dr-head", (b) => {
    b.addE(T.box, 0, 0.23, 0.08, 0.11, 0.5, 0.13, 0.35, 0, 0, C(DEER));
    b.add(T.box, 0, 0.5, 0.22, 0.13, 0.13, 0.27, 0, C(DEER));
    b.add(T.box, 0, 0.47, 0.37, 0.09, 0.09, 0.07, 0, C("#3A2A20"));
    for (const s of [-1, 1]) {
      b.addE(T.box, s * 0.1, 0.58, 0.15, 0.12, 0.06, 0.02, 0, 0, s * 0.4, C(DEER));
      b.add(T.box, s * 0.066, 0.53, 0.28, 0.02, 0.03, 0.03, 0, C(STRIPE));
      if (stag) {
        b.addE(T.disc8, s * 0.06, 0.78, 0.16, 0.018, 0.42, 0.018, -0.25, 0, -s * 0.28, C("#C9B48E"));
        b.addE(T.disc8, s * 0.1, 0.8, 0.25, 0.013, 0.2, 0.013, 0.7, 0, -s * 0.2, C("#C9B48E"));
        b.addE(T.disc8, s * 0.14, 1.0, 0.1, 0.012, 0.18, 0.012, -0.6, 0, -s * 0.4, C("#C9B48E"));
      }
    }
  });
  const rig = rigOf(m, root, body, head, 0.8, stag ? 1.65 : 1.4);
  for (const [x, y, z] of [
    [-0.12, 0.58, 0.36],
    [0.12, 0.58, 0.36],
    [-0.12, 0.6, -0.38],
    [0.12, 0.6, -0.38],
  ]) {
    const leg = m.pivot(body, x, y, z);
    m.mesh(leg, "dr-leg", (b) => {
      b.add(T.box, 0, -0.2, 0, 0.075, 0.4, 0.085, 0, C(DEER));
      b.add(T.box, 0, -0.45, 0, 0.055, 0.2, 0.06, 0, C("#C99A6A"));
      b.add(T.box, 0, -0.56, 0.01, 0.07, 0.05, 0.08, 0, C(DEER_D));
    });
    rig.legs.push(leg);
  }
  const tail = m.pivot(body, 0, 0.9, -0.55);
  m.mesh(tail, "dr-tail", (b) => {
    b.add(T.box, 0, -0.08, -0.02, 0.07, 0.18, 0.04, 0, C(DEER));
    b.add(T.box, 0, -0.08, -0.045, 0.06, 0.15, 0.02, 0, C(CREAM));
  });
  rig.tail = [tail];
  return rig;
};

const FUR = "#BDB7AA";
const FACE = "#26221F";

const makeMonkey = (mat: THREE.Material): Rig => {
  const m = new Maker(mat);
  const root = new THREE.Group();
  const body = m.pivot(root, 0, 0, 0);
  m.mesh(body, "mk-body", (b) => {
    b.add(T.ico1, 0, 0.36, 0, 0.15, 0.2, 0.13, 0, C(FUR));
    b.add(T.ico1, 0, 0.38, 0.06, 0.12, 0.13, 0.08, 0, C("#D9D3C6"));
  });
  const head = m.pivot(body, 0, 0.58, 0.02);
  m.mesh(head, "mk-head", (b) => {
    b.add(T.ico1, 0, 0.06, 0, 0.11, 0.11, 0.1, 0, C(FUR));
    b.add(T.box, 0, 0.04, 0.075, 0.13, 0.1, 0.06, 0, C(FACE));
    b.add(T.box, 0, 0.1, 0.07, 0.15, 0.03, 0.06, 0, C("#A39D90"));
    for (const s of [-1, 1]) {
      b.add(T.box, s * 0.03, 0.06, 0.106, 0.02, 0.02, 0.01, 0, C("#C9A04A"));
      b.add(T.box, s * 0.11, 0.06, 0, 0.03, 0.04, 0.02, 0, C(FACE));
    }
  });
  const rig = rigOf(m, root, body, head, 0.4, 0.75);
  for (const s of [-1, 1]) {
    const arm = m.pivot(body, s * 0.13, 0.5, 0.02);
    m.mesh(arm, "mk-arm", (b) => {
      b.add(T.box, 0, -0.14, 0, 0.05, 0.28, 0.05, 0, C(FUR));
      b.add(T.box, 0, -0.29, 0, 0.05, 0.05, 0.05, 0, C(FACE));
    });
    rig.arms.push(arm);
  }
  for (const s of [-1, 1]) {
    const leg = m.pivot(body, s * 0.08, 0.22, 0.04);
    m.mesh(leg, "mk-leg", (b) => {
      b.add(T.box, 0, 0, 0.1, 0.07, 0.07, 0.2, 0, C(FUR));
      b.add(T.box, 0, -0.1, 0.2, 0.06, 0.2, 0.06, 0, C(FUR));
      b.add(T.box, 0, -0.2, 0.23, 0.06, 0.03, 0.09, 0, C(FACE));
    });
    rig.legs.push(leg);
  }
  const t1 = m.pivot(body, 0, 0.22, -0.12);
  m.mesh(t1, "mk-t1", (b) => b.add(T.disc8, 0, -0.2, 0, 0.025, 0.4, 0.025, 0, C(FUR)));
  const t2 = m.pivot(t1, 0, -0.4, 0);
  m.mesh(t2, "mk-t2", (b) => b.add(T.disc8, 0, -0.22, 0, 0.022, 0.45, 0.022, 0, C(FUR)));
  const t3 = m.pivot(t2, 0, -0.44, 0);
  m.mesh(t3, "mk-t3", (b) => b.add(T.disc8, 0, -0.17, 0, 0.02, 0.35, 0.02, 0, C("#A39D90")));
  rig.tail = [t1, t2, t3];
  return rig;
};

const PEA_BLUE = "#1D5DB0";
const PEA_BLUE_L = "#2F7FD0";
const PEA_GREEN = "#2F8A4A";

const makePeafowl = (mat: THREE.Material, male: boolean): Rig => {
  const m = new Maker(mat);
  const root = new THREE.Group();
  const body = m.pivot(root, 0, 0, 0);
  m.mesh(body, male ? "pc-body" : "ph-body", (b) => {
    b.add(T.ico1, 0, 0.55, 0, 0.15, 0.17, 0.27, 0, C(male ? PEA_BLUE : "#8A6E4E"));
    for (const s of [-1, 1]) b.addE(T.ico1, s * 0.1, 0.58, -0.08, 0.06, 0.11, 0.2, 0, 0, s * 0.2, C(male ? "#9A6A43" : "#7A5E40"));
    for (const s of [-1, 1]) {
      b.add(T.box, s * 0.05, 0.2, 0.02, 0.025, 0.4, 0.025, 0, C("#8C8478"));
      b.add(T.box, s * 0.05, 0.01, 0.05, 0.05, 0.02, 0.1, 0, C("#8C8478"));
    }
  });
  const head = m.pivot(body, 0, 0.65, 0.18);
  m.mesh(head, male ? "pc-head" : "ph-head", (b) => {
    const neck = male ? PEA_BLUE_L : "#3E7A5A";
    b.addE(T.disc8, 0, 0.13, 0.03, 0.045, 0.28, 0.045, 0.2, 0, 0, C(neck));
    b.add(T.ico1, 0, 0.3, 0.07, 0.06, 0.06, 0.07, 0, C(neck));
    b.addE(T.cone, 0, 0.29, 0.15, 0.02, 0.07, 0.02, Math.PI / 2, 0, 0, C("#B9AE98"));
    for (const s of [-1, 1]) b.add(T.box, s * 0.045, 0.31, 0.1, 0.02, 0.02, 0.02, 0, C("#FFFFFF"));
    for (const x of [-0.02, 0, 0.02]) {
      b.add(T.box, x, 0.39, 0.06, 0.006, 0.08, 0.006, 0, C(neck));
      b.add(T.ico, x, 0.435, 0.06, 0.017, 0.017, 0.017, 0, C(neck));
    }
  });
  const rig = rigOf(m, root, body, head, 0.5, 1.0);
  if (!male) return rig;
  const train = m.mesh(body, "pc-train", (b) => {
    b.addE(T.box, 0, 0.46, -0.45, 0.16, 0.05, 0.5, -0.22, 0, 0, C("#3E8E3A"));
    b.addE(T.box, 0, 0.36, -0.88, 0.26, 0.04, 0.5, -0.22, 0, 0, C("#357F36"));
    for (let k = 0; k < 6; k++) b.addE(T.box, (k % 2 ? 1 : -1) * 0.05, 0.47 - k * 0.035, -0.36 - k * 0.12, 0.05, 0.012, 0.05, -0.22, 0, 0, C(k % 2 ? "#C9A23A" : "#1D3F9E"));
  });
  rig.train = train;
  const fan = m.pivot(body, 0, 0.6, -0.2);
  m.mesh(fan, "pc-fan", (b) => {
    for (let n = 0; n < 27; n++) {
      const f = -1.45 + (2.9 * n) / 26;
      const len = n % 2 ? 1.0 : 1.2;
      b.addE(T.box, Math.sin(f) * len * 0.5, Math.cos(f) * len * 0.5, 0, 0.07, len, 0.015, 0, 0, -f, C(n % 2 ? "#3E8E3A" : PEA_GREEN));
      b.addE(T.disc, Math.sin(f) * (len - 0.1), Math.cos(f) * (len - 0.1), 0.012, 0.075, 0.01, 0.075, Math.PI / 2, 0, 0, C("#C9A23A"));
      b.addE(T.disc, Math.sin(f) * (len - 0.1), Math.cos(f) * (len - 0.1), 0.02, 0.04, 0.01, 0.04, Math.PI / 2, 0, 0, C("#1D3F9E"));
    }
  });
  fan.scale.setScalar(0.02);
  fan.visible = false;
  rig.fan = fan;
  return rig;
};

// ---------- what they do ----------

type Spot = { a: number; d: number; act: Act; y?: number; face?: number };

type Def = {
  seg: number; // seconds per stop
  speed: number; // walking speed, m/s
  stride: number; // metres per step cycle
  spot: (r: () => number) => Spot;
  fear: number; // runs from you inside this distance (0: stands its ground)
};

const pondSide = (a: number, gap: number): Spot => ({ a, d: pondR(a) + gap, act: "drink" });
const clearing = (r: () => number, lo: number, hi: number, act: Act): Spot => ({ a: r() * Math.PI * 2, d: lo + r() * (hi - lo), act, face: r() * Math.PI * 2 });

const DEFS: Record<AnimalKind, Def> = {
  elephant: {
    seg: 75,
    speed: 0.9,
    stride: 2.6,
    fear: 0,
    spot: (r) => {
      const k = r();
      if (k < 0.35) return pondSide(r() * Math.PI * 2, 2.6);
      if (k < 0.75) return clearing(r, 17, 32, "graze");
      return { a: r() * Math.PI * 2, d: 41 + r() * 5, act: "browse" };
    },
  },
  calf: { seg: 75, speed: 0.9, stride: 1.4, fear: 0, spot: () => ({ a: 0, d: 20, act: "graze" }) },
  tiger: {
    seg: 55,
    speed: 1.2,
    stride: 1.5,
    fear: 0,
    spot: (r) => {
      const k = r();
      if (k < 0.25) return pondSide(r() * Math.PI * 2, 1.4);
      if (k < 0.55) return { a: JUNGLE.rock.a, d: JUNGLE.rock.r, act: "lie", y: JUNGLE.rock.top, face: r() * Math.PI * 2 };
      if (k < 0.85) return { a: r() * Math.PI * 2, d: 32 + r() * 4, act: "look" };
      return { a: r() * Math.PI * 2, d: 47 + r() * 6, act: "lie", face: r() * Math.PI * 2 };
    },
  },
  deer: {
    seg: 45,
    speed: 1.3,
    stride: 1.2,
    fear: 9,
    spot: (r) => {
      const k = r();
      if (k < 0.3) return pondSide(r() * Math.PI * 2, 1.3);
      if (k < 0.85) return clearing(r, 15, 31, "graze");
      return clearing(r, 33, 37, "look");
    },
  },
  stag: { seg: 45, speed: 1.3, stride: 1.25, fear: 9, spot: () => ({ a: 0, d: 20, act: "graze" }) },
  monkey: {
    seg: 22,
    speed: 1.6,
    stride: 0.6,
    fear: 4,
    spot: (r) => {
      const a = JUNGLE.banyan.a + (r() - 0.5) * 0.6;
      // Facing out towards the banyan, more or less.
      return { a, d: 33 + r() * 7, act: r() < 0.5 ? "scratch" : "rest", face: Math.atan2(Math.cos(a), Math.sin(a)) + (r() - 0.5) };
    },
  },
  peacock: {
    seg: 38,
    speed: 0.7,
    stride: 0.45,
    fear: 5,
    spot: (r) => {
      const k = r();
      if (k < 0.35) return { ...clearing(r, 20, 34, "display") };
      return clearing(r, 16, 36, "graze");
    },
  },
  peahen: { seg: 38, speed: 0.7, stride: 0.42, fear: 5, spot: (r) => clearing(r, 16, 36, "graze") },
};

type Animal = {
  id: number;
  kind: AnimalKind;
  def: Def;
  rig: Rig | null;
  follow: { lead: number; da: number; dd: number; lag: number } | null; // walks with another animal
  perch: [number, number, number] | null; // sits up in the banyan
  phase: number;
  // This frame.
  x: number;
  y: number;
  z: number;
  ry: number;
  act: Act;
  speed: number;
  dist: number;
  // Your screen only.
  fx: number;
  fz: number;
  fleeUntil: number; // running away until (seconds, performance clock)
  fleeDir: number; // which way (heading)
  react: Act | null;
  reactAt: number;
};

type Pose = { x: number; z: number; y: number; ry: number; act: Act; speed: number; dist: number };

const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth01 = (t: number) => t * t * (3 - 2 * t);
const turn = (from: number, to: number, k: number) => from + wrapA(to - from) * k;

type Label = { el: HTMLDivElement; name: HTMLSpanElement; doing: HTMLSpanElement };

export type WildOptions = {
  scene: THREE.Scene;
  labels: HTMLElement;
  font: string;
  lowPower: boolean;
  onNote?: (n: AnimalNote) => void;
};

export class Wildlife {
  readonly group = new THREE.Group();
  private o: WildOptions;
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private birdMat = new THREE.MeshLambertMaterial({ color: "#F4F2EA" });
  private birds: THREE.InstancedMesh;
  private birdRig: { root: THREE.Object3D; l: THREE.Object3D; r: THREE.Object3D }[] = [];
  private animals: Animal[] = [];
  private spot: JungleSpot | null = null;
  private town = 0;
  private labelPool: Label[] = [];
  private tmp = new THREE.Vector3();
  private box = new THREE.Box3();
  private pose: Pose = { x: 0, z: 0, y: 0, ry: 0, act: "rest", speed: 0, dist: 0 };
  private pose2: Pose = { x: 0, z: 0, y: 0, ry: 0, act: "rest", speed: 0, dist: 0 };
  private m4 = new THREE.Matrix4();
  private m5 = new THREE.Matrix4();
  private birdCol = { day: new THREE.Color("#F4F2EA"), night: new THREE.Color("#2A2530") };
  private shown = false;
  private noteAt = new Map<AnimalKind, number>();

  constructor(o: WildOptions) {
    this.o = o;
    this.group.visible = false;
    o.scene.add(this.group);
    const n = o.lowPower ? 10 : 18;
    this.birds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.birdMat, n * 3);
    this.birds.frustumCulled = false;
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.birds);
    for (let i = 0; i < n; i++) {
      const root = new THREE.Object3D();
      const l = new THREE.Object3D();
      const r = new THREE.Object3D();
      root.add(l, r);
      this.birdRig.push({ root, l, r });
    }
  }

  // The town drawn in detail changed: its jungle's animals come out.
  setTown(town: number) {
    if (town === this.town) return;
    this.town = town;
    this.spot = jungleOf(town);
    for (const a of this.animals) this.dropRig(a);
    this.animals = [];
    const kinds: AnimalKind[] = this.o.lowPower
      ? ["elephant", "calf", "tiger", "deer", "deer", "stag", "deer", "monkey", "monkey", "monkey", "peacock", "peahen"]
      : ["elephant", "elephant", "calf", "tiger", "stag", "deer", "deer", "deer", "deer", "deer", "monkey", "monkey", "monkey", "monkey", "monkey", "peacock", "peacock", "peahen", "peahen"];
    let herdLead = -1;
    let deerLead = -1;
    let monkeys = 0;
    kinds.forEach((kind, id) => {
      const r = rng(hashStr(`animal:${town}:${id}`));
      const a: Animal = {
        id,
        kind,
        def: DEFS[kind],
        rig: null,
        follow: null,
        perch: null,
        phase: r() * 100,
        x: 0,
        y: 0,
        z: 0,
        ry: 0,
        act: "rest",
        speed: 0,
        dist: 0,
        fx: 0,
        fz: 0,
        fleeUntil: 0,
        fleeDir: 0,
        react: null,
        reactAt: -Infinity,
      };
      // Elephants keep together; the calf stays at its mother's side. Deer move as a herd.
      if (kind === "elephant") {
        if (herdLead < 0) herdLead = id;
        else a.follow = { lead: herdLead, da: 0.16, dd: 3.5, lag: 4 };
      } else if (kind === "calf") a.follow = { lead: herdLead, da: -0.08, dd: 2.6, lag: 1.5 };
      else if (kind === "deer" || kind === "stag") {
        if (deerLead < 0) {
          deerLead = id;
          a.def = DEFS.deer;
        } else a.follow = { lead: deerLead, da: (r() - 0.5) * 0.4, dd: (r() - 0.5) * 7, lag: r() * 3 };
      } else if (kind === "monkey") {
        // Two sit up in the banyan; the rest are on the ground below it.
        if (monkeys < 2) a.perch = BANYAN_PERCHES[monkeys];
        monkeys++;
      }
      this.animals.push(a);
    });
  }

  private build(a: Animal): Rig {
    switch (a.kind) {
      case "elephant":
        return makeElephant(this.mat, a.id % 2 === 0);
      case "calf": {
        const r = makeElephant(this.mat, false);
        r.root.scale.setScalar(0.5);
        r.r *= 0.5;
        r.h *= 0.5;
        return r;
      }
      case "tiger":
        return makeTiger(this.mat);
      case "deer":
        return makeDeer(this.mat, false);
      case "stag":
        return makeDeer(this.mat, true);
      case "monkey":
        return makeMonkey(this.mat);
      case "peacock":
        return makePeafowl(this.mat, true);
      case "peahen":
        return makePeafowl(this.mat, false);
    }
  }

  private giveRig(a: Animal) {
    const rig = this.build(a);
    for (const m of rig.meshes) {
      m.castShadow = !this.o.lowPower && a.kind !== "monkey";
      m.receiveShadow = true;
    }
    this.group.add(rig.root);
    a.rig = rig;
  }

  private dropRig(a: Animal) {
    a.rig?.root.removeFromParent();
    a.rig = null;
  }

  // Where an animal is at time t by its own timetable (no reactions).
  private planned(a: Animal, t: number, out: Pose): Pose {
    const j = this.spot!;
    if (a.perch) {
      const [bx, bz] = aroundPond(j, JUNGLE.banyan.a, JUNGLE.banyan.r);
      out.x = bx + a.perch[0];
      out.y = a.perch[1];
      out.z = bz + a.perch[2];
      out.ry = Math.atan2(a.perch[0], a.perch[2]) + Math.sin(t * 0.05 + a.phase) * 0.6;
      out.act = "perch";
      out.speed = 0;
      out.dist = 0;
      return out;
    }
    if (a.follow) {
      const lead = this.animals[a.follow.lead];
      this.planned(lead, t - a.follow.lag, out);
      // Stand beside the leader: turned a little round the waterhole and nearer or further out.
      const ang = Math.atan2(out.z - j.cz, out.x - j.cx) + a.follow.da;
      const d = Math.max(pondR(ang) + 1.5, Math.hypot(out.x - j.cx, out.z - j.cz) + a.follow.dd);
      const nx = j.cx + Math.cos(ang) * d;
      const nz = j.cz + Math.sin(ang) * d;
      out.x = nx;
      out.z = nz;
      if (out.act === "drink") out.ry = Math.atan2(j.cx - nx, j.cz - nz);
      if (out.act === "display" || out.act === "browse") out.act = "graze";
      if (a.kind === "stag" && out.act === "graze" && Math.sin(t * 0.07 + a.phase) > 0.6) out.act = "look";
      return out;
    }
    const def = a.def;
    const T0 = t + a.phase * 7;
    const k = Math.floor(T0 / def.seg);
    const tau = T0 - k * def.seg;
    const A = def.spot(rng(hashStr(`a:${this.town}:${a.id}:${k}`)));
    const B = def.spot(rng(hashStr(`a:${this.town}:${a.id}:${k + 1}`)));
    const da = wrapA(B.a - A.a);
    const len = Math.hypot(da * ((A.d + B.d) / 2), B.d - A.d) + 0.01;
    const walk = Math.min(def.seg * 0.7, len / def.speed);
    const at = (s: number, o: { x: number; z: number }) => {
      const ang = A.a + da * s;
      const d = Math.max(pondR(ang) + 1.2, A.d + (B.d - A.d) * s);
      o.x = j.cx + Math.cos(ang) * d;
      o.z = j.cz + Math.sin(ang) * d;
      return o;
    };
    if (tau < walk) {
      const s = smooth01(tau / walk);
      at(s, out);
      const nx = out.x;
      const nz = out.z;
      at(Math.min(1, s + 0.01), this.pose2);
      out.x = nx;
      out.z = nz;
      out.ry = Math.atan2(this.pose2.x - nx, this.pose2.z - nz);
      out.act = "walk";
      out.speed = (len / walk) * 6 * s * (1 - s) * 1.0;
      out.dist = len * s;
      // Up onto the tiger's rock, or down from it, over the last / first couple of metres.
      const toGo = len * (1 - s);
      const gone = len * s;
      out.y = (B.y ?? 0) * smooth01(Math.max(0, 1 - toGo / 2.2)) + (A.y ?? 0) * smooth01(Math.max(0, 1 - gone / 2.2));
      return out;
    }
    at(1, out);
    out.y = B.y ?? 0;
    out.act = B.act;
    out.speed = 0;
    out.dist = len;
    out.ry = B.act === "drink" ? Math.atan2(j.cx - out.x, j.cz - out.z) : B.face ?? Math.atan2(j.cx - out.x, j.cz - out.z);
    // Grazing and keeping watch take turns.
    if (B.act === "graze" && Math.sin((t + a.phase) * 0.21) > 0.75) out.act = "look";
    return out;
  }

  // A tap on an animal (ray from the camera). Returns true if one was hit.
  poke(ray: THREE.Ray, camera: THREE.Vector3, now: number): boolean {
    let best: Animal | null = null;
    let bd = Infinity;
    for (const a of this.animals) {
      if (!a.rig) continue;
      const r = a.rig.r;
      this.box.min.set(a.x - r * 0.7, a.y, a.z - r * 0.7);
      this.box.max.set(a.x + r * 0.7, a.y + a.rig.h, a.z + r * 0.7);
      if (!ray.intersectBox(this.box, this.tmp)) continue;
      const d = this.tmp.distanceTo(ray.origin);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return false;
    this.startle(best, camera.x, camera.z, now, true);
    return true;
  }

  private startle(a: Animal, px: number, pz: number, now: number, tapped: boolean) {
    const react: Partial<Record<AnimalKind, Act>> = { tiger: "roar", elephant: "trumpet", calf: "trumpet", peacock: "display", monkey: "hop" };
    const act = react[a.kind];
    if (act) {
      a.react = act;
      a.reactAt = now;
    }
    if (a.def.fear > 0 && !a.perch) {
      // Run off, away from where the danger is.
      a.fleeDir = Math.atan2(a.x - px, a.z - pz);
      a.fleeUntil = Math.max(a.fleeUntil, now + (tapped ? 1.6 : 0.6));
    }
    // One note per kind of animal at a time (a whole herd bolting is one note).
    const group = a.kind === "stag" ? "deer" : a.kind === "calf" ? "elephant" : a.kind === "peahen" ? "peacock" : a.kind;
    if (now - (this.noteAt.get(group) ?? -Infinity) > (tapped ? 4 : 25)) {
      this.noteAt.set(group, now);
      const text = NOTICE[a.kind];
      if (text) this.o.onNote?.({ kind: a.kind, text: tapped && a.kind === "tiger" ? "The tiger roars. Good thing you're not any closer." : text });
    }
  }

  // Your person nearby (play mode), or null.
  update(dt: number, t: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3, camDist: number, player: THREE.Vector3 | null, night: number, width: number, height: number) {
    const j = this.spot;
    if (!j) return false;
    const near = Math.hypot(target.x - j.cx, target.z - j.cz) < 520;
    const show = near && camDist < 950;
    this.group.visible = show;
    if (!show) {
      if (this.shown) {
        for (const a of this.animals) this.dropRig(a);
        this.hideLabels(0);
        this.shown = false;
      }
      return false;
    }
    this.shown = true;
    const now = performance.now() / 1000;
    for (const a of this.animals) {
      if (!a.rig) this.giveRig(a);
      const p = this.planned(a, t, this.pose);
      let x = p.x;
      let z = p.z;
      let act = p.act;
      let ry = p.ry;
      let speed = p.speed;

      // Your person: deer, monkeys and peafowl keep their distance; the tiger and the elephants
      // turn to face you and warn you off.
      if (player) {
        const dx = x + a.fx - player.x;
        const dz = z + a.fz - player.z;
        const d = Math.hypot(dx, dz);
        const fear = a.def.fear;
        if (fear && d < fear && !a.perch) {
          if (now > a.fleeUntil) this.startle(a, player.x, player.z, now, false);
          a.fleeDir = Math.atan2(dx, dz);
          a.fleeUntil = now + 0.6;
        } else if ((a.kind === "tiger" || a.kind === "elephant" || a.kind === "calf") && d < 8 && !(p.y > 0.5)) {
          ry = Math.atan2(player.x - x - a.fx, player.z - z - a.fz);
          if (now - a.reactAt > 6) this.startle(a, player.x, player.z, now, false);
        }
      }
      // Coming back after running off: walk home, slowly.
      const off = Math.hypot(a.fx, a.fz);
      if (off > 18) {
        a.fx *= 18 / off;
        a.fz *= 18 / off;
      }
      if (now < a.fleeUntil && off < 18) {
        act = "run";
        speed = a.kind === "monkey" || a.kind === "peacock" || a.kind === "peahen" ? 3 : 5;
        a.fx += Math.sin(a.fleeDir) * speed * dt;
        a.fz += Math.cos(a.fleeDir) * speed * dt;
        ry = a.fleeDir;
      } else if (off > 0.05) {
        const back = Math.min(off, 1.4 * dt);
        a.fx -= (a.fx / off) * back;
        a.fz -= (a.fz / off) * back;
        if (p.speed < 0.05) {
          act = "walk";
          speed = 1.4;
          ry = Math.atan2(-a.fx, -a.fz);
        }
      } else {
        a.fx = a.fz = 0;
      }
      x += a.fx;
      z += a.fz;
      // Never into the waterhole.
      const pa = Math.atan2(z - j.cz, x - j.cx);
      const pd = Math.hypot(x - j.cx, z - j.cz);
      const minD = pondR(pa) + 0.6;
      if (pd < minD) {
        x = j.cx + Math.cos(pa) * minD;
        z = j.cz + Math.sin(pa) * minD;
      }
      if (a.react && now - a.reactAt < 3) act = a.react;
      else a.react = null;

      const moved = Math.hypot(x - a.x, z - a.z);
      if (moved < 3) a.dist += moved;
      a.x = x;
      a.z = z;
      a.y = (p.y > 0 ? p.y : 0.09) + (act === "hop" ? Math.abs(Math.sin((now - a.reactAt) * 6)) * 0.35 : 0);
      a.ry = moved > 3 ? ry : turn(a.ry, ry, Math.min(1, dt * 5));
      a.act = act;
      a.speed = speed;
      this.poseRig(a, t, now);
    }
    this.updateBirds(t, j, night);
    this.birdMat.color.copy(night > 0.5 ? this.birdCol.night : this.birdCol.day);
    this.placeLabels(camera, player, width, height);
    return true;
  }

  private poseRig(a: Animal, t: number, now: number) {
    const rig = a.rig!;
    rig.root.position.set(a.x, a.y, a.z);
    rig.root.rotation.y = a.ry;
    const moving = a.act === "walk" || a.act === "run";
    const phase = (a.dist / a.def.stride) * Math.PI * 2;
    const swing = a.act === "run" ? 0.75 : moving ? 0.35 * Math.min(1, a.speed / 0.35) : 0;
    const idle = t + a.phase;
    const L = rig.legs;
    const B = rig.body;
    B.position.set(0, 0, 0);
    B.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);
    for (const leg of L) leg.rotation.set(0, 0, 0);

    switch (a.kind) {
      case "elephant":
      case "calf": {
        const off = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
        L.forEach((leg, i) => (leg.rotation.x = Math.sin(phase + off[i]) * swing * 0.7));
        B.position.y = moving ? Math.abs(Math.sin(phase)) * 0.05 : 0;
        B.rotation.z = moving ? Math.sin(phase) * 0.025 : 0;
        const [t1, t2, t3] = rig.trunk;
        let a1 = -0.12 + Math.sin(idle * 0.9) * 0.08;
        let a2 = -0.12 + Math.sin(idle * 1.1) * 0.08;
        let a3 = -0.15;
        let flap = 0.25 + Math.sin(idle * 1.7) * 0.18;
        t1.rotation.z = Math.sin(idle * 0.7) * 0.12;
        if (a.act === "drink") {
          // Trunk to the water, then up to the mouth.
          const sip = Math.sin(idle * 0.6) > 0.3;
          a1 = sip ? -1.4 : -0.55;
          a2 = sip ? -1.0 : 0.15;
          a3 = sip ? -0.6 : 0.1;
          rig.head.rotation.x = 0.18;
        } else if (a.act === "graze" || a.act === "browse") {
          const up = Math.max(0, Math.sin(idle * 0.8));
          a1 = a.act === "browse" ? -1.6 - up * 0.6 : -0.3 - up * 1.2;
          a2 = a.act === "browse" ? -0.5 : -0.4 - up * 0.6;
          a3 = -0.3 - up * 0.5;
          if (a.act === "browse") rig.head.rotation.x = -0.25;
        } else if (a.act === "trumpet") {
          const s = Math.min(1, (now - a.reactAt) * 3);
          a1 = -0.12 + (-2.3 + 0.12) * s;
          a2 = -0.45 * s;
          a3 = -0.35 * s;
          rig.head.rotation.x = -0.32 * s;
          flap = 0.95;
        }
        t1.rotation.x = a1;
        t2.rotation.x = a2;
        t3.rotation.x = a3;
        rig.ears.forEach((ear, i) => (ear.rotation.y = (i === 0 ? 1 : -1) * flap));
        rig.tail[0].rotation.x = 0.15;
        rig.tail[0].rotation.z = Math.sin(idle * 2.1) * 0.3;
        break;
      }
      case "tiger": {
        const off = [0, Math.PI, Math.PI, 0];
        L.forEach((leg, i) => (leg.rotation.x = Math.sin(phase + off[i]) * swing));
        const [t1, t2] = rig.tail;
        t1.rotation.set(0.95, 0, Math.sin(idle * 1.3) * 0.25);
        t2.rotation.set(-0.9 + Math.sin(idle * 1.7) * 0.2, 0, 0);
        rig.jaw!.rotation.x = 0;
        if (moving) {
          B.position.y = Math.abs(Math.sin(phase)) * 0.03;
          rig.head.rotation.x = a.act === "run" ? 0 : 0.12;
        } else if (a.act === "lie") {
          B.position.y = -0.4;
          for (const leg of L) leg.rotation.x = -1.5;
          rig.head.rotation.y = Math.sin(idle * 0.23) * 0.6;
          rig.head.rotation.x = Math.sin(idle * 0.11) > 0.8 ? 0.35 : -0.05;
          t1.rotation.set(1.45, 0, 0.5 + Math.sin(idle * 0.9) * 0.3);
          t2.rotation.set(-0.15, 0, 0);
        } else if (a.act === "drink") {
          B.position.y = -0.1;
          B.rotation.x = 0.12;
          L[0].rotation.x = L[1].rotation.x = -0.25;
          rig.head.rotation.x = 0.75;
          rig.jaw!.rotation.x = Math.max(0, Math.sin(idle * 7)) * 0.15;
        } else if (a.act === "roar") {
          const s = Math.min(1, (now - a.reactAt) * 4);
          rig.head.rotation.x = -0.4 * s;
          rig.jaw!.rotation.x = 0.6 * s;
          B.rotation.x = -0.06 * s;
        } else {
          rig.head.rotation.y = Math.sin(idle * 0.4) * 0.5;
        }
        break;
      }
      case "deer":
      case "stag": {
        const off = [0, Math.PI, Math.PI, 0];
        L.forEach((leg, i) => (leg.rotation.x = Math.sin(phase + off[i]) * swing * (a.act === "run" ? 1.2 : 1)));
        rig.tail[0].rotation.x = a.act === "run" ? -1.2 : Math.sin(idle * 3) * 0.15;
        if (a.act === "run") {
          B.position.y = Math.abs(Math.sin(phase)) * 0.12;
          rig.head.rotation.x = -0.2;
        } else if (a.act === "graze" || a.act === "drink") {
          B.rotation.x = 0.12;
          rig.head.rotation.x = 2.05 + Math.sin(idle * 2.3) * 0.08;
        } else if (a.act === "look") {
          rig.head.rotation.x = -0.15;
          rig.head.rotation.y = Math.sin(idle * 0.5) * 0.7;
        } else if (moving) {
          rig.head.rotation.x = 0.25;
        }
        break;
      }
      case "monkey": {
        const [t1, t2, t3] = rig.tail;
        rig.arms.forEach((arm) => arm.rotation.set(-0.6, 0, 0));
        if (a.act === "perch") {
          t1.rotation.set(0.15, 0, Math.sin(idle * 0.8) * 0.15);
          t2.rotation.set(0.05, 0, 0);
          t3.rotation.set(0.05, 0, 0);
          rig.head.rotation.y = Math.sin(idle * 0.6) * 0.8;
        } else {
          t1.rotation.set(1.45, 0, Math.sin(idle * 0.7) * 0.2);
          t2.rotation.set(0.1, 0, 0);
          t3.rotation.set(-0.6, 0, 0);
        }
        if (moving || a.act === "hop") {
          // Bounding along on all fours.
          B.rotation.x = 0.7;
          rig.arms.forEach((arm, i) => (arm.rotation.x = -0.7 + Math.sin(phase + i * 0.3) * 0.6));
          if (moving) B.position.y = Math.abs(Math.sin(phase)) * 0.18;
        } else if (a.act === "scratch") {
          rig.arms[1].rotation.set(-2.4, 0, -0.4 + Math.sin(idle * 9) * 0.25);
          rig.head.rotation.z = 0.25;
        } else {
          rig.head.rotation.y = Math.sin(idle * 0.5) * 0.6;
        }
        break;
      }
      case "peacock":
      case "peahen": {
        if (moving) {
          B.position.y = Math.abs(Math.sin(phase)) * 0.02;
          rig.head.position.z = 0.18 + Math.sin(phase * 2) * 0.04;
        } else rig.head.position.z = 0.18;
        if (a.act === "graze") rig.head.rotation.x = Math.max(0, Math.sin(idle * 1.4)) * 1.3;
        const fan = rig.fan;
        if (fan) {
          const open = a.act === "display";
          const s = THREE.MathUtils.lerp(fan.scale.x, open ? 1 : 0.02, 0.08);
          fan.scale.setScalar(s);
          fan.visible = s > 0.05;
          fan.rotation.set(0.2, 0, open ? Math.sin(idle * 22) * 0.03 : 0);
          if (rig.train) rig.train.visible = s < 0.6;
          if (open) {
            B.rotation.x = -0.12;
            rig.head.rotation.x = -0.1;
          }
        }
        break;
      }
    }
  }

  private updateBirds(t: number, j: JungleSpot, night: number) {
    const bats = night > 0.5;
    const M = this.m4;
    const S = this.m5;
    this.birdRig.forEach((b, i) => {
      const r = rng(i * 977 + 13);
      const R = 26 + r() * 40;
      const h = (bats ? 9 : 20) + r() * 14;
      const dir = r() < 0.5 ? 1 : -1;
      const w = ((bats ? 9 : 7) / R) * dir;
      const a = t * w + r() * Math.PI * 2;
      const x = j.cx + Math.cos(a) * R;
      const z = j.cz + Math.sin(a) * R;
      const flapT = t * (bats ? 14 : 6) + r() * 10;
      const glide = !bats && Math.sin(t * 0.4 + i) > 0.3;
      const flap = glide ? 0.15 : Math.sin(flapT) * (bats ? 0.9 : 0.6);
      b.root.position.set(x, h + Math.sin(t * 0.8 + i) * 1.5, z);
      b.root.rotation.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), -0.25 * dir);
      const span = bats ? 0.35 : 0.55;
      b.l.position.set(-0.05, 0, 0);
      b.r.position.set(0.05, 0, 0);
      b.l.rotation.set(0, 0, -flap);
      b.r.rotation.set(0, 0, flap);
      b.root.updateMatrixWorld(true);
      M.copy(b.root.matrixWorld).multiply(S.makeScale(0.12, 0.1, bats ? 0.25 : 0.5));
      this.birds.setMatrixAt(i * 3, M);
      for (let k = 1; k <= 2; k++) {
        const wing = k === 1 ? b.l : b.r;
        M.copy(wing.matrixWorld).multiply(S.makeTranslation((k === 1 ? -1 : 1) * span * 0.5, 0, 0));
        M.multiply(S.makeScale(span, 0.02, bats ? 0.2 : 0.26));
        this.birds.setMatrixAt(i * 3 + k, M);
      }
    });
    this.birds.instanceMatrix.needsUpdate = true;
  }

  // ---------- tags ----------

  private makeLabel(): Label {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity .2s ease;text-align:center;white-space:nowrap;";
    const pill = document.createElement("div");
    pill.style.cssText = `display:inline-block;background:rgba(32,58,28,.86);color:#fff;border-radius:10px;padding:4px 8px 5px;box-shadow:0 4px 12px rgba(0,0,0,.25);font:800 12px/1.15 ${this.o.font};`;
    const name = document.createElement("span");
    name.style.cssText = "display:block;";
    const doing = document.createElement("span");
    doing.style.cssText = `display:block;margin-top:2px;font:700 10px/1.1 ${this.o.font};color:rgba(255,255,255,.78);`;
    pill.append(name, doing);
    el.append(pill);
    this.o.labels.append(el);
    return { el, name, doing };
  }

  private hideLabels(from: number) {
    for (let i = from; i < this.labelPool.length; i++) {
      const el = this.labelPool[i].el;
      if (el.style.opacity !== "0") el.style.opacity = "0";
    }
  }

  private placeLabels(camera: THREE.PerspectiveCamera, player: THREE.Vector3 | null, width: number, height: number) {
    const cam = camera.position;
    const cands: { a: Animal; d: number }[] = [];
    for (const a of this.animals) {
      if (!a.rig) continue;
      const dc = Math.hypot(a.x - cam.x, a.y - cam.y, a.z - cam.z);
      const dp = player ? Math.hypot(a.x - player.x, a.z - player.z) : Infinity;
      if (dc < 55 || dp < 14) cands.push({ a, d: Math.min(dc, dp) });
    }
    cands.sort((p, q) => p.d - q.d);
    const shown = cands.slice(0, 5);
    while (this.labelPool.length < shown.length) this.labelPool.push(this.makeLabel());
    // Nearest first; a tag that would cover a nearer one stays hidden.
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    shown.forEach(({ a }, i) => {
      const l = this.labelPool[i];
      const name = ANIMAL_NAME[a.kind];
      if (l.name.textContent !== name) l.name.textContent = name;
      const doing = a.act === "lie" && a.y > 0.5 ? "Lazing on a rock" : DOING[a.act];
      if (l.doing.textContent !== doing) l.doing.textContent = doing;
      const v = this.tmp.set(a.x, a.y + a.rig!.h + 0.35, a.z).project(camera);
      if (v.z > 1 || v.z < -1) {
        l.el.style.opacity = "0";
        return;
      }
      const px = ((v.x + 1) / 2) * width;
      const py = ((1 - v.y) / 2) * height;
      const w = l.el.offsetWidth || 110;
      const h = l.el.offsetHeight || 36;
      const rect = { x0: px - w / 2, x1: px + w / 2, y0: py - h, y1: py };
      const covered = placed.some((q) => Math.min(rect.x1, q.x1) - Math.max(rect.x0, q.x0) > w * 0.2 && Math.min(rect.y1, q.y1) - Math.max(rect.y0, q.y0) > h * 0.3);
      if (covered) {
        l.el.style.opacity = "0";
        return;
      }
      placed.push(rect);
      l.el.style.opacity = "1";
      l.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
    });
    this.hideLabels(shown.length);
  }

  // Where the animals are, for the map card / debugging.
  get stats() {
    return this.animals.map((a) => ({ kind: a.kind, act: a.act, x: Math.round(a.x), z: Math.round(a.z) }));
  }

  dispose() {
    for (const a of this.animals) this.dropRig(a);
    for (const l of this.labelPool) l.el.remove();
    this.birds.dispose();
    this.birds.geometry.dispose();
    this.birdMat.dispose();
    this.mat.dispose();
    this.group.removeFromParent();
  }
}
