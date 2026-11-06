// The civic quarter's six workplaces in 3D (positions and sizes: nav.ts WORK): the Police Station,
// the Fire Station, the Tech Park, the City Bank, the City School and Lazy Films Studio. Each is
// built in its own frame (front door to +z, ground at y = 0) as one mesh, plus a sign with its name.
import * as THREE from "three";
import { Builder, C, T } from "../land/geo";
import { WORK, WORK_FRONT, type Prop, type WorkKind } from "./nav";

type B = Builder;
const Y = 0.6; // floor level (the lawn is at 0.42)
const PAVE = "#DCD3C2";
const TAR = "#6A6E75";
const TYRE = "#25272B";

const box = (b: B, x: number, y: number, z: number, sx: number, sy: number, sz: number, col: string, ry = 0) =>
  b.add(T.box, x, y, z, sx, sy, sz, ry, C(col));

// A plain building: base, walls, a band at each floor, roof trim, and windows all round.
const shell = (
  b: B,
  w: { hx: number; hz: number; h: number },
  o: { wall: string; trim: string; glass: string; band?: string; floors: number; skipFront?: (x: number) => boolean },
) => {
  const { hx, hz, h } = w;
  const cz = WORK_FRONT - hz;
  box(b, 0, 0.53, cz, hx * 2 + 0.5, 0.14, hz * 2 + 0.5, "#CFC6B5");
  box(b, 0, Y + h / 2, cz, hx * 2, h, hz * 2, o.wall);
  const fh = h / o.floors;
  for (let f = 1; f < o.floors; f++) box(b, 0, Y + f * fh, cz, hx * 2 + 0.08, 0.16, hz * 2 + 0.08, o.band ?? o.trim);
  box(b, 0, Y + h + 0.13, cz, hx * 2 + 0.3, 0.26, hz * 2 + 0.3, o.trim);
  // Windows every 1.6 m, centred on each wall.
  const across = (half: number) => {
    const n = Math.max(1, Math.floor((2 * half - 2.2) / 1.6) + 1);
    return Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * 1.6);
  };
  for (let f = 0; f < o.floors; f++) {
    const y = Y + f * fh + fh * 0.55;
    for (const x of across(hx)) {
      if (f > 0 || !o.skipFront?.(x)) box(b, x, y, WORK_FRONT + 0.02, 0.95, fh * 0.42, 0.05, o.glass);
      box(b, x, y, cz - hz - 0.02, 0.95, fh * 0.42, 0.05, o.glass);
    }
    for (const z of across(hz)) for (const s of [-1, 1]) box(b, s * (hx + 0.02), y, cz + z, 0.05, fh * 0.42, 0.9, o.glass);
  }
};

// A paved patch (for the forecourt and parking bays).
const pad = (b: B, x0: number, x1: number, z0: number, z1: number, col: string, y = 0.44) =>
  box(b, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.05, z1 - z0, col);

// The forecourt from the front door to the street, and a step.
const forecourt = (b: B, half: number) => {
  pad(b, -half, half, WORK_FRONT, 18.3, PAVE);
  box(b, 0, 0.62, WORK_FRONT + 0.5, 3.0, 0.16, 1.0, "#D8D2C4");
};

const wheels = (b: B, x: number, z: number, hw: number, zs: number[], r = 0.36) => {
  for (const s of [-1, 1]) for (const dz of zs) box(b, x + s * hw, 0.44 + r, z + dz, 0.26, r * 2, r * 2, TYRE);
};

// A car parked facing the street (+z), centred at (x, z).
const car = (b: B, p: Prop, body: string, stripe: string | null, lights: boolean) => {
  const { x, z } = p;
  const y = 0.44 + 0.34;
  box(b, x, y + 0.32, z, 1.76, 0.62, 4.1, body);
  box(b, x, y + 0.86, z - 0.25, 1.56, 0.5, 2.1, "#2C3540");
  box(b, x, y + 1.13, z - 0.25, 1.5, 0.05, 1.9, body);
  if (stripe) for (const s of [-1, 1]) box(b, x + s * 0.89, y + 0.36, z, 0.03, 0.22, 4.0, stripe);
  if (lights) {
    box(b, x - 0.3, y + 1.23, z - 0.25, 0.55, 0.14, 0.3, "#FF3B3B");
    box(b, x + 0.3, y + 1.23, z - 0.25, 0.55, 0.14, 0.3, "#3B7BFF");
  }
  box(b, x, y + 0.42, z + 2.06, 1.3, 0.16, 0.04, "#FFF3C4");
  wheels(b, x, z, 0.82, [-1.35, 1.35]);
};

// ---------- the six buildings ----------

const police = (b: B) => {
  const w = WORK.police;
  const blue = "#1E4B9A";
  forecourt(b, 7.5);
  for (const p of w.props.slice(0, 2)) {
    pad(b, p.x - 1.5, p.x + 1.5, p.z - 2.8, p.z + 2.8, TAR, 0.445);
    car(b, p, "#F7F7F5", blue, true);
  }
  shell(b, w, { wall: "#E9EEF4", trim: blue, glass: "#9DB8CC", floors: 2, skipFront: (x) => Math.abs(x) < 1.6 });
  const cz = WORK_FRONT - w.hz;
  // Blue stripe round the ground floor, glass doors, a canopy and two blue lamps.
  box(b, 0, Y + 0.35, cz, w.hx * 2 + 0.06, 0.3, w.hz * 2 + 0.06, blue);
  box(b, 0, Y + 1.1, WORK_FRONT + 0.03, 1.8, 2.2, 0.06, "#8CC3E0");
  box(b, 0, Y + 1.1, WORK_FRONT + 0.05, 0.06, 2.2, 0.06, "#D7DEE3");
  box(b, 0, Y + 2.55, WORK_FRONT + 0.7, 3.4, 0.16, 1.4, blue);
  for (const s of [-1, 1]) {
    box(b, s * 1.9, Y + 1.0, WORK_FRONT + 0.25, 0.1, 2.0, 0.1, "#2A2A2A");
    b.add(T.ico, s * 1.9, Y + 2.15, WORK_FRONT + 0.25, 0.2, 0.24, 0.2, 0, C("#4C8DFF"));
  }
  // The cells: barred windows down the east side.
  for (const z of [cz - 2.4, cz, cz + 2.4]) {
    box(b, w.hx + 0.07, Y + 1.7, z, 0.05, 1.0, 1.1, "#3A3F45");
    for (let k = -2; k <= 2; k++) box(b, w.hx + 0.11, Y + 1.7, z + k * 0.22, 0.05, 1.1, 0.05, "#9AA1A8");
  }
  // A siren on the roof.
  box(b, 0, Y + w.h + 0.45, cz - w.hz + 1.2, 1.6, 0.3, 0.5, "#2A2A2A");
  box(b, -0.42, Y + w.h + 0.7, cz - w.hz + 1.2, 0.7, 0.2, 0.42, "#FF3B3B");
  box(b, 0.42, Y + w.h + 0.7, cz - w.hz + 1.2, 0.7, 0.2, 0.42, "#3B7BFF");
};

const fire = (b: B) => {
  const w = WORK.fire;
  const red = "#C0392B";
  const cz = WORK_FRONT - w.hz;
  forecourt(b, 9.2);
  pad(b, -6.2, -2.4, WORK_FRONT, 10.4, "#C9BFAE", 0.447);
  shell(b, w, { wall: "#B8432F", trim: "#F2EEE6", glass: "#A9C3D3", floors: 2, skipFront: () => true });
  // Two engine bays: the left one open (the engine's out), the right one shut.
  box(b, -4.3, Y + 1.9, WORK_FRONT + 0.03, 3.5, 3.8, 0.06, "#1E2024");
  box(b, 4.3, Y + 1.9, WORK_FRONT + 0.03, 3.5, 3.8, 0.06, "#ECE6DA");
  for (let k = 0; k < 6; k++) box(b, 4.3, Y + 0.4 + k * 0.62, WORK_FRONT + 0.07, 3.4, 0.05, 0.04, "#C9BFAE");
  for (const x of [-4.3, 4.3]) box(b, x, Y + 3.95, WORK_FRONT + 0.06, 3.9, 0.3, 0.1, "#F2EEE6");
  b.addE(T.disc, 0, Y + 3.0, WORK_FRONT + 0.06, 0.75, 0.08, 0.75, Math.PI / 2, 0, 0, C("#F2EEE6"));
  b.addE(T.disc, 0, Y + 3.0, WORK_FRONT + 0.1, 0.55, 0.06, 0.55, Math.PI / 2, 0, 0, C(red));
  // The hose tower at the back.
  const tx = w.hx - 1.5;
  const tz = cz - w.hz + 1.5;
  box(b, tx, Y + (w.h + 5) / 2, tz, 2.6, w.h + 5, 2.6, "#A63B2A");
  box(b, tx, Y + w.h + 5.15, tz, 3.0, 0.3, 3.0, "#F2EEE6");
  b.add(T.cone, tx, Y + w.h + 5.9, tz, 2.0, 1.2, 2.0, 0, C("#4A4E55"));
  for (const y of [Y + w.h + 1.4, Y + w.h + 3.4]) box(b, tx, y, tz + 1.32, 0.7, 1.0, 0.05, "#A9C3D3");
  // The fire engine, pulled out in front of its bay, and a hydrant.
  const t = w.props[0];
  const ty = 0.44 + 0.5;
  box(b, t.x, ty + 0.95, t.z - 0.9, 2.4, 1.9, 4.6, red);
  box(b, t.x, ty + 0.8, t.z + 2.25, 2.4, 1.6, 1.9, red);
  box(b, t.x, ty + 1.25, t.z + 3.21, 2.1, 0.7, 0.04, "#2C3540");
  box(b, t.x, ty + 0.55, t.z, 2.44, 0.18, 6.6, "#F2EEE6");
  for (const s of [-1, 1]) box(b, t.x + s * 0.55, ty + 2.02, t.z - 1.0, 0.12, 0.12, 5.2, "#C9CED4");
  for (let k = 0; k < 9; k++) box(b, t.x, ty + 2.02, t.z - 3.4 + k * 0.6, 1.2, 0.08, 0.08, "#C9CED4");
  box(b, t.x - 0.4, ty + 1.72, t.z + 2.6, 0.5, 0.16, 0.3, "#FF3B3B");
  box(b, t.x + 0.4, ty + 1.72, t.z + 2.6, 0.5, 0.16, 0.3, "#FF3B3B");
  wheels(b, t.x, t.z, 1.1, [-2.4, -1.3, 2.2], 0.5);
  const hy = w.props[1];
  b.add(T.disc8, hy.x, 0.44 + 0.38, hy.z, 0.2, 0.76, 0.2, 0, C("#D9342B"));
  b.add(T.ico1, hy.x, 0.44 + 0.8, hy.z, 0.22, 0.16, 0.22, 0, C("#D9342B"));
  box(b, hy.x, 0.44 + 0.5, hy.z, 0.6, 0.12, 0.12, "#D9342B");
};

const engineer = (b: B) => {
  const w = WORK.engineer;
  const cz = WORK_FRONT - w.hz;
  const { hx, hz, h } = w;
  forecourt(b, 7.2);
  box(b, 0, 0.53, cz, hx * 2 + 0.6, 0.14, hz * 2 + 0.6, "#CFC6B5");
  box(b, 0, Y + h / 2, cz, hx * 2, h, hz * 2, "#6E9BB8");
  // Glass curtain wall: white floor bands and mullions on every face.
  for (let y = Y + 2.9; y < Y + h - 0.5; y += 2.9) box(b, 0, y, cz, hx * 2 + 0.1, 0.22, hz * 2 + 0.1, "#E8EEF2");
  for (let x = -hx; x <= hx + 0.01; x += 1.4)
    for (const s of [-1, 1]) box(b, x, Y + h / 2, cz + s * (hz + 0.04), 0.1, h, 0.06, "#E8EEF2");
  for (let z = cz - hz; z <= cz + hz + 0.01; z += 1.5)
    for (const s of [-1, 1]) box(b, s * (hx + 0.04), Y + h / 2, z, 0.06, h, 0.1, "#E8EEF2");
  box(b, 0, Y + h + 0.2, cz, hx * 2 + 0.3, 0.4, hz * 2 + 0.3, "#2B3440");
  // The way in: a dark canopy and lit glass doors.
  box(b, 0, Y + 1.15, WORK_FRONT + 0.06, 2.6, 2.3, 0.06, "#BFE3F2");
  box(b, 0, Y + 2.6, WORK_FRONT + 0.8, 4.2, 0.18, 1.6, "#2B3440");
  // Roof: a satellite dish, a mast and a plant room.
  const ry = Y + h + 0.4;
  box(b, -hx + 1.8, ry + 0.7, cz - 1.5, 2.4, 1.4, 2.4, "#B9C1C7");
  b.add(T.cyl, hx - 1.6, ry + 2.2, cz - hz + 1.6, 0.08, 4.4, 0.08, 0, C("#8D949B"));
  b.add(T.ico, hx - 1.6, ry + 4.5, cz - hz + 1.6, 0.14, 0.14, 0.14, 0, C("#FF4B4B"));
  box(b, 2.4, ry + 0.5, cz - 3.0, 0.25, 1.0, 0.25, "#8D949B");
  b.addE(T.disc, 2.4, ry + 1.4, cz - 3.0, 1.25, 0.12, 1.25, -0.7, 0.4, 0, C("#E8EEF2"));
  // In the yard: a giant gear and a robot, on plinths.
  const g = w.props[0];
  box(b, g.x, 0.44 + 0.3, g.z, 3.2, 0.6, 1.0, "#D8CDB4");
  b.addE(T.disc, g.x, 0.44 + 2.2, g.z, 1.45, 0.4, 1.45, Math.PI / 2, 0, 0, C("#E8892B"));
  b.addE(T.disc, g.x, 0.44 + 2.2, g.z + 0.05, 0.5, 0.42, 0.5, Math.PI / 2, 0, 0, C("#6B4A2E"));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.addE(T.box, g.x + Math.cos(a) * 1.55, 0.44 + 2.2 + Math.sin(a) * 1.55, g.z, 0.45, 0.45, 0.4, 0, 0, a, C("#E8892B"));
  }
  const r = w.props[1];
  const by = 0.44 + 0.5;
  box(b, r.x, by - 0.2, r.z, 1.4, 0.6, 1.2, "#D8CDB4");
  for (const s of [-1, 1]) box(b, r.x + s * 0.28, by + 0.6, r.z, 0.3, 1.0, 0.36, "#9AA4AE");
  box(b, r.x, by + 1.55, r.z, 1.1, 1.0, 0.7, "#B8C2CC");
  box(b, r.x, by + 1.6, r.z + 0.36, 0.5, 0.36, 0.04, "#5CE1E6");
  for (const s of [-1, 1]) b.addE(T.box, r.x + s * 0.72, by + 1.4, r.z + 0.15, 0.24, 0.9, 0.24, -0.6, 0, s * 0.3, C("#9AA4AE"));
  box(b, r.x, by + 2.4, r.z, 0.75, 0.6, 0.6, "#B8C2CC");
  for (const s of [-1, 1]) box(b, r.x + s * 0.18, by + 2.45, r.z + 0.31, 0.16, 0.12, 0.03, "#5CE1E6");
  b.add(T.cyl, r.x, by + 2.95, r.z, 0.03, 0.4, 0.03, 0, C("#8D949B"));
  b.add(T.ico, r.x, by + 3.18, r.z, 0.08, 0.08, 0.08, 0, C("#FF4B4B"));
};

const bank = (b: B) => {
  const w = WORK.bank;
  const cz = WORK_FRONT - w.hz;
  const stone = "#EFE6D2";
  const gold = "#D8B34A";
  forecourt(b, 7.5);
  shell(b, w, { wall: stone, trim: "#D8CDB4", glass: "#9FB8C8", floors: 1, skipFront: () => true });
  // Tall windows on the front, glass doors.
  for (const x of [-5.4, -3.9, 3.9, 5.4]) box(b, x, Y + 2.8, WORK_FRONT + 0.02, 0.9, 2.8, 0.05, "#9FB8C8");
  box(b, 0, Y + 1.3, WORK_FRONT + 0.03, 2.2, 2.6, 0.06, "#6B4A2E");
  box(b, 0, Y + 1.3, WORK_FRONT + 0.05, 0.06, 2.6, 0.06, gold);
  // Steps, six columns, the beam over them and a stepped pediment.
  for (let k = 0; k < 3; k++) box(b, 0, 0.5 + k * 0.12, WORK_FRONT + 1.4 - k * 0.3, 12.6 - k * 0.5, 0.12, 1.2, "#D8D2C4");
  for (const x of [-5.2, -3.1, -1.05, 1.05, 3.1, 5.2]) {
    b.add(T.disc8, x, Y + 2.55, WORK_FRONT + 1.0, 0.3, 4.6, 0.3, 0, C("#F7F1E3"));
    box(b, x, Y + 4.95, WORK_FRONT + 1.0, 0.8, 0.22, 0.8, "#E3D7BD");
  }
  box(b, 0, Y + 5.35, WORK_FRONT + 0.6, 12.0, 0.6, 1.6, "#E3D7BD");
  for (let k = 0; k < 3; k++) box(b, 0, Y + 5.85 + k * 0.32, WORK_FRONT + 0.55, 10.6 - k * 3.4, 0.32, 1.3, k === 1 ? gold : "#EADFC7");
  // A gold dome on the roof.
  b.add(T.disc, 0, Y + w.h + 0.5, cz - 1.2, 2.2, 0.5, 2.2, 0, C("#E3D7BD"));
  b.add(T.ico1, 0, Y + w.h + 0.8, cz - 1.2, 1.9, 1.4, 1.9, 0, C(gold));
  b.add(T.ico, 0, Y + w.h + 2.4, cz - 1.2, 0.25, 0.3, 0.25, 0, C(gold));
  // The cash van and the ATM.
  const v = w.props[0];
  pad(b, v.x - 1.6, v.x + 1.6, v.z - 3.0, v.z + 3.0, TAR, 0.445);
  const vy = 0.44 + 0.4;
  box(b, v.x, vy + 0.95, v.z - 0.5, 2.0, 1.9, 3.4, "#55654F");
  box(b, v.x, vy + 0.65, v.z + 1.7, 2.0, 1.3, 1.2, "#55654F");
  box(b, v.x, vy + 1.05, v.z + 2.31, 1.7, 0.5, 0.04, "#2C3540");
  for (const s of [-1, 1]) box(b, v.x + s * 1.01, vy + 1.2, v.z - 0.5, 0.03, 0.5, 2.2, gold);
  wheels(b, v.x, v.z, 0.92, [-1.5, 1.6], 0.42);
  const a = w.props[1];
  box(b, a.x, 0.44 + 1.15, a.z, 1.5, 2.3, 1.3, "#2F6E4F");
  box(b, a.x, 0.44 + 2.4, a.z, 1.7, 0.22, 1.5, gold);
  box(b, a.x, 0.44 + 1.45, a.z + 0.66, 0.7, 0.5, 0.04, "#BFE3F2");
  box(b, a.x, 0.44 + 1.0, a.z + 0.7, 0.8, 0.12, 0.12, "#2A2A2A");
};

const school = (b: B) => {
  const w = WORK.school;
  const cz = WORK_FRONT - w.hz;
  const red = "#C8443A";
  forecourt(b, 6.0);
  shell(b, w, { wall: "#F3CF79", trim: red, glass: "#A9C3D3", band: "#F7F1E3", floors: 2, skipFront: (x) => Math.abs(x) < 1.6 });
  // Red double doors under a porch, and a clock over them.
  box(b, 0, Y + 1.1, WORK_FRONT + 0.03, 2.0, 2.2, 0.06, red);
  box(b, 0, Y + 1.1, WORK_FRONT + 0.05, 0.06, 2.2, 0.06, "#7A2E1F");
  box(b, 0, Y + 2.5, WORK_FRONT + 0.7, 3.2, 0.16, 1.4, red);
  b.addE(T.disc, 0, Y + 4.6, WORK_FRONT + 0.06, 0.6, 0.08, 0.6, Math.PI / 2, 0, 0, C("#FFFDF5"));
  b.addE(T.box, 0.12, Y + 4.7, WORK_FRONT + 0.11, 0.06, 0.4, 0.03, 0, 0, -0.6, C("#2A2A2A"));
  // The bell tower on the roof.
  const ry = Y + w.h + 0.26;
  box(b, 0, ry + 1.2, cz, 1.8, 2.4, 1.8, "#F7F1E3");
  for (const s of [-1, 1]) box(b, 0, ry + 1.5, cz + s * 0.91, 0.8, 1.1, 0.04, "#3A3F45");
  b.add(T.ico1, 0, ry + 1.4, cz, 0.36, 0.42, 0.36, 0, C("#D8A93A"));
  b.add(T.cone, 0, ry + 3.2, cz, 1.6, 1.6, 1.6, 0, C(red));
  // The playground: a slide, swings and a sandpit, and a flagpole.
  pad(b, -12.0, -7.4, 6.6, 15.4, "#E9D9A6", 0.447);
  pad(b, 6.6, 12.0, 8.6, 13.4, "#E9D9A6", 0.447);
  const s = w.props[0];
  for (const dx of [-0.6, 0.6]) box(b, s.x + dx, 0.44 + 1.25, s.z - 1.9, 0.12, 2.5, 0.12, "#3F6FB5");
  for (let k = 0; k < 5; k++) box(b, s.x, 0.44 + 0.4 + k * 0.45, s.z - 1.9, 1.2, 0.07, 0.07, "#3F6FB5");
  box(b, s.x, 0.44 + 2.45, s.z - 1.6, 1.3, 0.1, 0.8, "#3F6FB5");
  b.addE(T.box, s.x, 0.44 + 1.25, s.z + 0.35, 1.0, 0.1, 3.6, 0.62, 0, 0, C("#F2B134"));
  for (const dx of [-0.5, 0.5]) b.addE(T.box, s.x + dx, 0.44 + 1.4, s.z + 0.35, 0.06, 0.25, 3.6, 0.62, 0, 0, C("#F2B134"));
  const sw = w.props[1];
  for (const dx of [-1.8, 1.8])
    for (const dz of [-0.7, 0.7]) b.addE(T.box, sw.x + dx, 0.44 + 1.2, sw.z + dz * 0.6, 0.1, 2.5, 0.1, dz * 0.35, 0, 0, C("#C8443A"));
  box(b, sw.x, 0.44 + 2.38, sw.z, 3.8, 0.12, 0.12, "#C8443A");
  for (const dx of [-0.8, 0.8]) {
    for (const ox of [-0.25, 0.25]) box(b, sw.x + dx + ox, 0.44 + 1.55, sw.z, 0.03, 1.6, 0.03, "#8D949B");
    box(b, sw.x + dx, 0.44 + 0.72, sw.z, 0.6, 0.06, 0.3, "#3A3F45");
  }
  const f = w.props[2];
  b.add(T.cyl, f.x, 0.44 + 4.2, f.z, 0.06, 8.4, 0.06, 0, C("#D7DEE3"));
  box(b, f.x + 0.75, 0.44 + 7.7, f.z, 1.4, 0.9, 0.03, "#3F6FB5");
  box(b, f.x + 0.75, 0.44 + 7.7, f.z, 0.9, 0.3, 0.04, "#F7C631");
};

const film = (b: B) => {
  const w = WORK.film;
  const cz = WORK_FRONT - w.hz;
  const { hx, hz, h } = w;
  forecourt(b, 8.5);
  box(b, 0, 0.53, cz, hx * 2 + 0.5, 0.14, hz * 2 + 0.5, "#CFC6B5");
  box(b, 0, Y + h / 2, cz, hx * 2, h, hz * 2, "#4A4E57");
  // The sound stage's curved roof, and a yellow stripe round it.
  // (Its ends sit just inside the walls, so only the half above them shows.)
  b.addE(T.disc, 0, Y + h, cz, hx - 0.05, hz * 2 - 0.1, 3.2, Math.PI / 2, 0, 0, C("#C9CDD3"));
  box(b, 0, Y + h - 0.25, cz, hx * 2 + 0.06, 0.5, hz * 2 + 0.06, "#F7C631");
  for (const s of [-1, 1]) for (let z = cz - hz + 1.5; z < cz + hz - 1; z += 2.4) box(b, s * (hx + 0.03), Y + 3.2, z, 0.05, 4.4, 0.12, "#3A3E46");
  // The big stage door, a star over it, and a red carpet with ropes.
  box(b, 0, Y + 2.2, WORK_FRONT + 0.03, 6.2, 4.4, 0.06, "#6B7280");
  for (let k = -2; k <= 2; k++) box(b, k * 1.24, Y + 2.2, WORK_FRONT + 0.07, 0.05, 4.4, 0.04, "#565C66");
  b.addE(T.box, 0, Y + 5.0, WORK_FRONT + 0.08, 0.5, 0.5, 0.04, 0, 0, Math.PI / 4, C("#F7C631"));
  pad(b, -1.3, 1.3, WORK_FRONT, 15.5, "#B3202A", 0.452);
  for (let z = WORK_FRONT + 4.6; z < 15; z += 2.2)
    for (const s of [-1, 1]) {
      b.add(T.cyl, s * 1.6, 0.44 + 0.45, z, 0.05, 0.9, 0.05, 0, C("#D8B34A"));
      b.add(T.ico, s * 1.6, 0.44 + 0.92, z, 0.09, 0.09, 0.09, 0, C("#D8B34A"));
      if (z + 2.2 < 15) box(b, s * 1.6, 0.44 + 0.78, z + 1.1, 0.06, 0.06, 2.2, "#7A1A22");
    }
  // A giant clapperboard, a camera on its tripod and a spotlight.
  const c = w.props[0];
  for (const dx of [-0.9, 0.9]) box(b, c.x + dx, 0.44 + 0.6, c.z, 0.14, 1.2, 0.14, "#3A3F45");
  box(b, c.x, 0.44 + 2.0, c.z, 2.6, 1.6, 0.18, "#1C1C1E");
  box(b, c.x, 0.44 + 2.0, c.z + 0.1, 2.3, 0.05, 0.02, "#F2F0E6");
  box(b, c.x, 0.44 + 1.55, c.z + 0.1, 2.3, 0.05, 0.02, "#F2F0E6");
  b.addE(T.box, c.x - 0.05, 0.44 + 3.05, c.z, 2.7, 0.32, 0.2, 0, 0, 0.18, C("#1C1C1E"));
  for (let k = 0; k < 5; k++)
    b.addE(T.box, c.x - 1.0 + k * 0.5, 0.44 + 3.0 + k * 0.09, c.z + 0.11, 0.24, 0.3, 0.02, 0, 0, 0.18 + 0.5, C("#F2F0E6"));
  const cam = w.props[1];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    b.addE(T.box, cam.x + Math.sin(a) * 0.3, 0.44 + 0.62, cam.z + Math.cos(a) * 0.3, 0.06, 1.3, 0.06, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4, C("#2A2A2A"));
  }
  box(b, cam.x, 0.44 + 1.45, cam.z, 0.5, 0.45, 0.8, "#1C1C1E");
  b.addE(T.disc8, cam.x, 0.44 + 1.48, cam.z - 0.55, 0.16, 0.4, 0.16, Math.PI / 2, 0, 0, C("#3A3F45"));
  for (const dz of [-0.2, 0.25]) b.addE(T.disc, cam.x, 0.44 + 1.88, cam.z + dz, 0.24, 0.08, 0.24, 0, 0, Math.PI / 2, C("#1C1C1E"));
  const l = w.props[2];
  b.add(T.cyl, l.x, 0.44 + 1.6, l.z, 0.05, 3.2, 0.05, 0, C("#3A3F45"));
  b.addE(T.box, l.x, 0.44 + 3.35, l.z, 0.7, 0.6, 0.6, 0.35, -0.7, 0, C("#2A2A2A"));
  b.addE(T.box, l.x - 0.15, 0.44 + 3.25, l.z - 0.28, 0.55, 0.45, 0.04, 0.35, -0.7, 0, C("#FFF3C4"));
};

const BUILD: Record<WorkKind, (b: B) => void> = { police, fire, engineer, bank, school, film };

// A workplace's mesh, in its frame.
export const workplaceGeo = (kind: WorkKind) => {
  const b = new Builder();
  BUILD[kind](b);
  return b.geometry();
};

// ---------- signs ----------

type SignStyle = { bg: string; ink: string; sub: string; title: string; line: string; mark: (g: CanvasRenderingContext2D) => void };

const star = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
};

const SIGNS: Record<WorkKind, SignStyle> = {
  police: {
    bg: "#1E4B9A",
    ink: "#FFFFFF",
    sub: "#CFE0FF",
    title: "POLICE",
    line: "COPS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#F7C631";
      star(g, 78, 78, 46);
    },
  },
  fire: {
    bg: "#C62E22",
    ink: "#FFFFFF",
    sub: "#FFE1D6",
    title: "FIRE STATION",
    line: "FIREFIGHTERS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#FFB020";
      g.beginPath();
      g.moveTo(78, 28);
      g.bezierCurveTo(118, 68, 112, 128, 78, 132);
      g.bezierCurveTo(44, 128, 38, 84, 62, 58);
      g.bezierCurveTo(64, 78, 72, 84, 78, 86);
      g.bezierCurveTo(70, 62, 76, 44, 78, 28);
      g.fill();
    },
  },
  engineer: {
    bg: "#13202B",
    ink: "#5CE1E6",
    sub: "#B8E9EC",
    title: "TECH PARK",
    line: "ENGINEERS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#E8892B";
      for (let k = 0; k < 8; k++) {
        g.save();
        g.translate(78, 80);
        g.rotate((k * Math.PI) / 4);
        g.fillRect(-9, -50, 18, 22);
        g.restore();
      }
      g.beginPath();
      g.arc(78, 80, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#13202B";
      g.beginPath();
      g.arc(78, 80, 13, 0, Math.PI * 2);
      g.fill();
    },
  },
  bank: {
    bg: "#1F5E45",
    ink: "#F2C94C",
    sub: "#D6EFE2",
    title: "CITY BANK",
    line: "BANKERS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#F2C94C";
      g.beginPath();
      g.arc(78, 80, 46, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1F5E45";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "900 60px sans-serif";
      g.fillText("₹", 78, 84);
    },
  },
  school: {
    bg: "#F7C631",
    ink: "#7A2E1F",
    sub: "#7A2E1F",
    title: "CITY SCHOOL",
    line: "TEACHERS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#7A2E1F";
      g.beginPath();
      g.moveTo(26, 70);
      g.lineTo(78, 44);
      g.lineTo(130, 70);
      g.lineTo(78, 96);
      g.closePath();
      g.fill();
      g.fillRect(48, 82, 60, 30);
      g.fillRect(122, 70, 6, 40);
    },
  },
  film: {
    bg: "#111111",
    ink: "#F7C631",
    sub: "#E5E5E5",
    title: "LAZY FILMS",
    line: "STUDIO · ACTORS WANTED · 30 JOBS",
    mark: (g) => {
      g.fillStyle = "#F2F0E6";
      g.fillRect(30, 66, 96, 64);
      g.fillStyle = "#111111";
      g.fillRect(36, 72, 84, 52);
      g.fillStyle = "#F2F0E6";
      g.save();
      g.translate(30, 62);
      g.rotate(-0.28);
      g.fillRect(0, -22, 98, 22);
      g.fillStyle = "#111111";
      for (let k = 0; k < 4; k++) g.fillRect(8 + k * 24, -22, 12, 22);
      g.restore();
    },
  },
};

export const SIGN_ASPECT = 3.6;

export const workSignTex = (kind: WorkKind, font: string) => {
  const s = SIGNS[kind];
  const cv = document.createElement("canvas");
  cv.width = 576;
  cv.height = 160;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = s.bg;
  g.fillRect(0, 0, 576, 160);
  s.mark(g);
  g.fillStyle = s.ink;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.font = `900 66px ${font}`;
  g.fillText(s.title, 150, 66, 410);
  g.fillStyle = s.sub;
  g.font = `800 23px ${font}`;
  g.fillText(s.line, 152, 124, 410);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// Where a workplace's sign goes, in its frame: on the roof (seen from both sides) or, for the film
// studio's curved roof, over its front door (front only).
export const signSpot = (kind: WorkKind) => {
  const w = WORK[kind];
  if (kind === "film") return { x: 0, y: Y + 6.4, z: WORK_FRONT + 0.12, width: 7.2, height: 7.2 / SIGN_ASPECT, roof: false };
  const width = Math.min(2 * w.hx - 1.4, 8.6);
  const height = width / SIGN_ASPECT;
  const y = Y + w.h + 0.7 + height / 2;
  // The school's bell tower and the bank's dome sit mid-roof, so their signs stand at the front.
  const z = kind === "school" || kind === "bank" ? WORK_FRONT - 0.6 : WORK_FRONT - w.hz;
  return { x: 0, y, z, width, height, roof: true };
};

// The posts and frame behind a roof sign (in the workplace's frame).
export const signFrameGeo = (kind: WorkKind) => {
  const s = signSpot(kind);
  const b = new Builder();
  if (s.roof) {
    const w = WORK[kind];
    const roof = Y + w.h + 0.26;
    for (const k of [-1, 1]) box(b, k * (s.width / 2 - 0.5), (roof + s.y - s.height / 2) / 2, s.z, 0.14, s.y - s.height / 2 - roof + 0.05, 0.14, "#2A2A2A");
    box(b, s.x, s.y, s.z, s.width + 0.16, s.height + 0.16, 0.08, "#1F2226");
  } else {
    box(b, s.x, s.y, s.z - 0.06, s.width + 0.2, s.height + 0.2, 0.06, "#1F2226");
  }
  return b.geometry();
};
