// The writing on the name boards in front of the houses: @username, house number, waves and how far
// the house is built. Drawing all 1,000 boards would cost too much memory, so only the boards
// nearest the camera get writing; the rest stay plain white until you come closer.
import * as THREE from "three";
import { percentText, progressOf } from "@/lib/house";
import type { House } from "@/lib/world";
import type { HouseHit } from "./build";
import { BOARD } from "./spec";

const W = 512;
const H = 256;
// Past this camera distance the boards are too small to read, so they're left blank.
const READ_D = 380;

type Slot = {
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  tex: THREE.CanvasTexture;
  g: CanvasRenderingContext2D;
  plot: number;
  key: string;
};

const fmt = (n: number) => n.toLocaleString("en");

const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

const draw = (g: CanvasRenderingContext2D, font: string, h: House, p: number) => {
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.textBaseline = "middle";

  const name = `@${h.username}`;
  let size = 74;
  g.font = `900 ${size}px ${font}`;
  while (g.measureText(name).width > W - 44 && size > 30) {
    size -= 4;
    g.font = `900 ${size}px ${font}`;
  }
  g.fillStyle = "#24272C";
  g.fillText(name, W / 2, 66, W - 40);

  g.font = `800 32px ${font}`;
  g.fillStyle = "#71757C";
  const waves = h.waves > 0 ? ` · ${fmt(h.waves)} ${h.waves === 1 ? "WAVE" : "WAVES"}` : "";
  g.fillText(`HOUSE #${fmt(h.plot)}${waves}`, W / 2, 130, W - 40);

  const bx = 34;
  const by = 166;
  const bw = W - 68;
  const bh = 58;
  const done = p >= 1;
  roundRect(g, bx, by, bw, bh, bh / 2);
  g.fillStyle = "#EFE8DA";
  g.fill();
  if (p > 0) {
    g.save();
    roundRect(g, bx, by, bw, bh, bh / 2);
    g.clip();
    g.fillStyle = done ? "#3E9E52" : "#F08A3C";
    g.fillRect(bx, by, Math.max(bh, bw * p), bh);
    g.restore();
  }
  g.font = `900 30px ${font}`;
  g.fillStyle = done || p > 0.55 ? "#FFFFFF" : "#3A3D42";
  g.fillText(done ? "MOVE-IN READY" : `${percentText(p)} BUILT`, W / 2, by + bh / 2 + 1);
};

export class NameBoards {
  readonly group = new THREE.Group();
  private slots: Slot[] = [];
  private geo = new THREE.PlaneGeometry(BOARD.w, BOARD.h);
  private font: string;
  private lastAt = -Infinity;
  private lastTarget = new THREE.Vector3(Infinity, 0, 0);
  private lastDist = 0;
  private dirty = true;
  private tmp = new THREE.Vector3();

  constructor(count: number, font: string) {
    this.font = font;
    for (let i = 0; i < count; i++) {
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const g = cv.getContext("2d") as CanvasRenderingContext2D;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      // A little glow of its own, so boards that face away from the sun are still readable.
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        emissive: "#FFFFFF",
        emissiveMap: tex,
        emissiveIntensity: 0.32,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.slots.push({ mesh, mat, tex, g, plot: 0, key: "" });
    }
  }

  // Something on the boards changed (new town, a wave): redraw on the next update.
  invalidate() {
    this.dirty = true;
  }

  // Called every frame; only does work when the camera has moved enough, or now and then so the
  // build percentages keep up.
  update(houses: readonly HouseHit[], camera: THREE.Vector3, target: THREE.Vector3, dist: number, now: number) {
    const moved = target.distanceToSquared(this.lastTarget) > 9 || Math.abs(dist - this.lastDist) > dist * 0.08;
    if (!this.dirty && !moved && now - this.lastAt < 30_000) return;
    if (!this.dirty && moved && now - this.lastAt < 120) return;
    this.lastAt = now;
    this.lastTarget.copy(target);
    this.lastDist = dist;
    this.dirty = false;

    let wanted: HouseHit[] = [];
    if (dist < READ_D) {
      const reach = Math.max(90, dist * 1.25);
      const near: { hit: HouseHit; d: number }[] = [];
      for (const hit of houses) {
        if (!hit.board) continue;
        if (Math.abs(hit.board.x - target.x) > reach || Math.abs(hit.board.z - target.z) > reach) continue;
        near.push({ hit, d: camera.distanceToSquared(this.tmp.set(hit.board.x, hit.board.y, hit.board.z)) });
      }
      near.sort((a, b) => a.d - b.d);
      wanted = near.slice(0, this.slots.length).map((n) => n.hit);
    }

    const keep = new Set(wanted.map((h) => h.n));
    const free: Slot[] = [];
    for (const s of this.slots) {
      if (s.plot && keep.has(s.plot)) continue;
      s.plot = 0;
      s.mesh.visible = false;
      free.push(s);
    }
    const bySlot = new Map(this.slots.filter((s) => s.plot).map((s) => [s.plot, s]));
    const secs = Date.now() / 1000;
    for (const hit of wanted) {
      const s = bySlot.get(hit.n) ?? free.pop();
      if (!s || !hit.board) continue;
      const p = progressOf(hit.house, secs);
      const key = `${hit.house.username}|${Math.floor(p * 100)}|${hit.house.waves}`;
      if (s.plot !== hit.n || s.key !== key) {
        draw(s.g, this.font, hit.house, p);
        s.tex.needsUpdate = true;
        s.key = key;
      }
      s.plot = hit.n;
      const { x, y, z, ry } = hit.board;
      s.mesh.position.set(x, y, z);
      s.mesh.rotation.set(0, ry, 0);
      s.mesh.visible = true;
    }
  }

  dispose() {
    this.geo.dispose();
    for (const s of this.slots) {
      s.tex.dispose();
      s.mat.dispose();
    }
  }
}
