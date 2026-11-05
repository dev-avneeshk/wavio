// Low-poly geometry builder (ported from the House City reel). Every static piece is baked into a few
// big vertex-coloured meshes, so the whole land draws in a handful of draw calls.
import * as THREE from "three";

export type Tpl = { p: Float32Array; n: Float32Array };

const fromGeo = (g: THREE.BufferGeometry): Tpl => {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals(); // non-indexed geometry gives flat, faceted normals
  return {
    p: (ng.getAttribute("position").array as Float32Array).slice(),
    n: (ng.getAttribute("normal").array as Float32Array).slice(),
  };
};

const fromTris = (tris: number[][]): Tpl => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  return fromGeo(g);
};

// Roof: 1x1 base at y=0, ridge at y=1 along x with half-length rx (0.5 = gable prism, 0 = pyramid).
const roofCache = new Map<number, Tpl>();
export const roofTpl = (rx: number): Tpl => {
  const k = Math.round(rx * 20) / 20;
  const hit = roofCache.get(k);
  if (hit) return hit;
  const A = [-0.5, 0, -0.5];
  const B = [0.5, 0, -0.5];
  const Cc = [0.5, 0, 0.5];
  const D = [-0.5, 0, 0.5];
  const E = [-k, 1, 0];
  const F = [k, 1, 0];
  const t = fromTris([D, Cc, F, D, F, E, B, A, E, B, E, F, A, D, E, Cc, B, F, A, B, Cc, A, Cc, D]);
  roofCache.set(k, t);
  return t;
};

export const T = {
  box: fromGeo(new THREE.BoxGeometry(1, 1, 1)),
  ico: fromGeo(new THREE.IcosahedronGeometry(1, 0)),
  ico1: fromGeo(new THREE.IcosahedronGeometry(1, 1)),
  cone: fromGeo(new THREE.ConeGeometry(1, 1, 7)),
  cyl: fromGeo(new THREE.CylinderGeometry(1, 1, 1, 7, 1, true)),
  disc: fromGeo(new THREE.CylinderGeometry(1, 1, 1, 20)),
  disc8: fromGeo(new THREE.CylinderGeometry(1, 1, 1, 10)),
  taper: fromGeo(new THREE.CylinderGeometry(0.95, 1, 1, 14)),
  quadZ: fromGeo(new THREE.PlaneGeometry(1, 1)), // faces +z
  quadY: fromGeo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), // faces +y
};

const colCache = new Map<string, THREE.Color>();
export const C = (hex: string): THREE.Color => {
  let c = colCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colCache.set(hex, c);
  }
  return c;
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class Builder {
  private p = new Float32Array(1 << 15);
  private n = new Float32Array(1 << 15);
  private c = new Float32Array(1 << 15);
  private len = 0;

  private grow(extra: number) {
    if (this.len + extra <= this.p.length) return;
    let cap = this.p.length;
    while (cap < this.len + extra) cap *= 2;
    const np = new Float32Array(cap);
    const nn = new Float32Array(cap);
    const nc = new Float32Array(cap);
    np.set(this.p.subarray(0, this.len));
    nn.set(this.n.subarray(0, this.len));
    nc.set(this.c.subarray(0, this.len));
    this.p = np;
    this.n = nn;
    this.c = nc;
  }

  // Scale (sx, sy, sz), rotate about y by ry, then move to (x, y, z).
  add(t: Tpl, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, col: THREE.Color) {
    const L = t.p.length;
    this.grow(L);
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const { p, n, c } = this;
    let o = this.len;
    for (let i = 0; i < L; i += 3) {
      const px = t.p[i] * sx;
      const py = t.p[i + 1] * sy;
      const pz = t.p[i + 2] * sz;
      p[o] = x + px * cs + pz * sn;
      p[o + 1] = y + py;
      p[o + 2] = z - px * sn + pz * cs;
      let nx = t.n[i] / sx;
      let ny = t.n[i + 1] / sy;
      let nz = t.n[i + 2] / sz;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      n[o] = nx * cs + nz * sn;
      n[o + 1] = ny;
      n[o + 2] = -nx * sn + nz * cs;
      c[o] = col.r;
      c[o + 1] = col.g;
      c[o + 2] = col.b;
      o += 3;
    }
    this.len = o;
  }

  // General transform: Euler rotation (YXZ) + scale + position.
  addE(
    t: Tpl,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ax: number,
    ay: number,
    az: number,
    col: THREE.Color,
  ) {
    _e.set(ax, ay, az, "YXZ");
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    _nm.getNormalMatrix(_m);
    const L = t.p.length;
    this.grow(L);
    const e = _m.elements;
    const ne = _nm.elements;
    const { p, n, c } = this;
    let o = this.len;
    for (let i = 0; i < L; i += 3) {
      const a = t.p[i];
      const b = t.p[i + 1];
      const d = t.p[i + 2];
      p[o] = e[0] * a + e[4] * b + e[8] * d + e[12];
      p[o + 1] = e[1] * a + e[5] * b + e[9] * d + e[13];
      p[o + 2] = e[2] * a + e[6] * b + e[10] * d + e[14];
      const na = t.n[i];
      const nb = t.n[i + 1];
      const nd = t.n[i + 2];
      const nx = ne[0] * na + ne[3] * nb + ne[6] * nd;
      const ny = ne[1] * na + ne[4] * nb + ne[7] * nd;
      const nz = ne[2] * na + ne[5] * nb + ne[8] * nd;
      const l = Math.hypot(nx, ny, nz) || 1;
      n[o] = nx / l;
      n[o + 1] = ny / l;
      n[o + 2] = nz / l;
      c[o] = col.r;
      c[o + 1] = col.g;
      c[o + 2] = col.b;
      o += 3;
    }
    this.len = o;
  }

  get verts() {
    return this.len / 3;
  }

  // Normals and colours are packed into bytes to keep big cities light on memory.
  geometry(): THREE.BufferGeometry {
    const count = this.len;
    const normals = new Int8Array(count);
    const colors = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      normals[i] = Math.round(Math.max(-1, Math.min(1, this.n[i])) * 127);
      colors[i] = Math.round(Math.max(0, Math.min(1, this.c[i])) * 255);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.p.slice(0, count), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3, true));
    g.computeBoundingSphere();
    return g;
  }
}

// Rotate a local (lx, lz) offset by ry around the origin.
export const rot = (lx: number, lz: number, ry: number): [number, number] => {
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  return [lx * cs + lz * sn, -lx * sn + lz * cs];
};
