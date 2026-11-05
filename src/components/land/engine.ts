// The 3D land: renderer, camera moves, the yellow pin + PLOT sign, name tags and house picking.
// Plain three.js driven by its own animation loop; React only mounts it and passes data in.
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { getPreviewName } from "@/lib/preview-name";
import { buildLand, type HouseHit, type LandBuild } from "./build";
import { rot } from "./geo";
import { Y0, type Lot } from "./layout";

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, "Helvetica Neue", Arial, sans-serif';
const SKY_FOG = "#DDE8EE";
const SUN = new THREE.Vector3(-0.45, 1, 0.6).normalize();
// Light-space basis of the sun's shadow camera, used to snap its centre to whole shadow texels.
const L_ROT = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), SUN.clone().negate(), new THREE.Vector3(0, 1, 0));
const L_INV = L_ROT.clone().invert();
const PIN_SCALE = 1.15;
const PIN_HEIGHT = (7.4 + 2.2) * PIN_SCALE;
const SIGN = { w: 4.4, h: 2.7 };
// Tall things in the plaza (clock tower, lighthouse) the camera must not hide a plot behind.
const LANDMARKS = [
  { x: -14.8, z: 12.5, r: 7, h: 36 },
  { x: 14.8, z: -12.5, r: 7, h: 30 },
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d") as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

const skyTex = () =>
  canvasTex(1024, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, "#5F9FD6");
    gr.addColorStop(0.3, "#93C0E6");
    gr.addColorStop(0.44, "#C9DEEE");
    gr.addColorStop(0.5, SKY_FOG);
    gr.addColorStop(1, SKY_FOG);
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 512);
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 70; n++) {
      const x = r() * 1024;
      const y = 150 + r() * 95;
      const rw = 20 + r() * 60;
      const rh = 4 + r() * 8;
      const rg = g.createRadialGradient(x, y, 0, x, y, rw);
      rg.addColorStop(0, "rgba(255,255,255,0.75)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.save();
      g.translate(x, y);
      g.scale(1, rh / rw);
      g.translate(-x, -y);
      g.beginPath();
      g.arc(x, y, rw, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });

const signTex = (n: number) =>
  canvasTex(880, 540, (g) => {
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, 880, 540);
    g.strokeStyle = "#C24038";
    g.lineWidth = 22;
    g.strokeRect(19, 19, 842, 502);
    g.fillStyle = "#2A2A2A";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines: [string, number][] = [
      [`PLOT #${n}`, 170],
      ["AVAILABLE", 96],
      ["LAZY FILMS CITY", 70],
    ];
    const total = lines.reduce((a, [, sz]) => a + sz * 1.08, 0);
    let y = (540 - total) / 2;
    for (const [txt, sz] of lines) {
      g.font = `900 ${sz}px ${FONT}`;
      g.fillText(txt, 440, y + (sz * 1.08) / 2, 790);
      y += sz * 1.08;
    }
  });

const glowTex = () =>
  canvasTex(256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, "rgba(255,236,120,1)");
    rg.addColorStop(0.45, "rgba(255,226,90,0.55)");
    rg.addColorStop(1, "rgba(255,220,80,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
  });

// HTML tag that follows a point in the 3D scene (same look as the tags in the reel).
const makeTag = (bg: string, color: string) => {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity .2s ease;";
  const pill = document.createElement("div");
  pill.style.cssText = `background:${bg};color:${color};border-radius:999px;padding:7px 14px;font:800 15px/1.1 ${FONT};white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.22);max-width:72vw;overflow:hidden;text-overflow:ellipsis;`;
  const arrow = document.createElement("div");
  arrow.style.cssText = `width:12px;height:12px;background:${bg};transform:rotate(45deg);margin:-7px auto 0;border-radius:2px;`;
  el.append(pill, arrow);
  return { el, pill };
};

type View = { target: THREE.Vector3; radius: number; phi: number; theta: number };
type Flight = {
  t0: number;
  dur: number;
  fromT: THREE.Vector3;
  toT: THREE.Vector3;
  from: THREE.Spherical;
  to: THREE.Spherical;
  bump: number;
};

export type LandEngineOptions = {
  // Pixels on the left edge covered by the page's card (desktop), so focused things are centred in the free space.
  leftInset: () => number;
  onHouseCount?: (count: number) => void;
};

export class LandEngine {
  private host: HTMLElement;
  private opts: LandEngineOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.5, 14000);
  private controls: MapControls;
  private sun = new THREE.DirectionalLight("#FFF4E0", 2.1);
  private fog = new THREE.Fog(SKY_FOG, 100, 3000);
  private sky: THREE.Mesh;
  private lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  private pinMat = new THREE.MeshLambertMaterial({ color: "#F7C631", emissive: "#8A6400", emissiveIntensity: 0.7 });
  private glowMat: THREE.MeshBasicMaterial;
  private signMat = new THREE.MeshLambertMaterial();
  private city = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private dash = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private xw = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private xwFar = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private own = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private pin = new THREE.Group();
  private glow: THREE.Mesh;
  private sign = new THREE.Group();
  private labels: HTMLDivElement;
  private focusTag = makeTag("#F7C631", "#2C2F34");
  private hoverTag = makeTag("#FFFFFF", "#2C2F34");
  private data: LandBuild | null = null;
  private boxes: { hit: HouseHit; box: THREE.Box3 }[] = [];
  private mine: number | null = null;
  private mineName: string | null = null;
  private focus: { lot: Lot; n: number; baseY: number; own: boolean } | null = null;
  private flight: Flight | null = null;
  private growStart = -1;
  private hovered: HouseHit | null = null;
  private selected: HouseHit | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private raf = 0;
  private visible = true;
  private disposed = false;
  private reduced: boolean;
  private shadowRes: number;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private width = 1;
  private height = 1;
  private tmp = new THREE.Vector3();
  private ray = new THREE.Raycaster();

  constructor(host: HTMLElement, opts: LandEngineOptions) {
    this.host = host;
    this.opts = opts;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.shadowRes = coarse ? 1024 : 2048;

    // Throws if WebGL is unavailable; the caller shows a fallback.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;outline:none;";
    canvas.setAttribute("aria-label", "3D map of Lazy Films City. Drag to move around, scroll or pinch to zoom.");
    canvas.setAttribute("role", "img");
    host.appendChild(canvas);

    this.labels = document.createElement("div");
    this.labels.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    this.labels.append(this.hoverTag.el, this.focusTag.el);
    host.appendChild(this.labels);

    // Lights, sky, fog
    this.scene.fog = this.fog;
    this.scene.add(new THREE.HemisphereLight("#EAF4FF", "#A3B57F", 1.5));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.shadowRes, this.shadowRes);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(7000, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    // City meshes
    for (const m of [this.city, this.own]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.dash.receiveShadow = true;
    this.xw.receiveShadow = true;
    this.xwFar.receiveShadow = true;
    this.own.visible = false;
    this.scene.add(this.city, this.dash, this.xw, this.xwFar, this.own);

    // Yellow pin + ground glow
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 20), this.pinMat);
    ball.position.y = 7.4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.86, 4.3, 32), this.pinMat);
    tip.position.y = 4.75;
    tip.rotation.x = Math.PI;
    ball.castShadow = true;
    tip.castShadow = true;
    const pinBody = new THREE.Group();
    pinBody.add(ball, tip);
    pinBody.scale.setScalar(PIN_SCALE);
    this.pin.add(pinBody);
    this.glowMat = new THREE.MeshBasicMaterial({
      map: glowTex(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: "#FFE27A",
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.scene.add(this.pin, this.glow);

    // PLOT #N AVAILABLE sign
    const postMat = new THREE.MeshLambertMaterial({ color: "#7A4E2D" });
    const frameMat = new THREE.MeshLambertMaterial({ color: "#C24038" });
    for (const x of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.22), postMat);
      post.position.set(x, 1.6, 0);
      post.castShadow = true;
      this.sign.add(post);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(SIGN.w + 0.2, SIGN.h + 0.2, 0.12), frameMat);
    frame.position.set(0, 3.0, 0);
    frame.castShadow = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), this.signMat);
    board.position.set(0, 3.0, 0.07);
    this.sign.add(frame, board);
    this.scene.add(this.sign);

    // Controls: drag to pan, right-drag / two fingers to rotate, wheel / pinch to zoom.
    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 22;
    this.controls.maxDistance = 1200;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.22;
    this.controls.zoomToCursor = true;

    canvas.addEventListener("pointerdown", this.onPointerDown, { capture: true });
    canvas.addEventListener("wheel", this.cancelFlight, { capture: true, passive: true });
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.raf) this.raf = requestAnimationFrame(this.loop);
    });
    this.io.observe(host);
    this.resize();

    // Start high above the city until the first data arrives.
    this.camera.position.set(0, 520, 620);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.raf = requestAnimationFrame(this.loop);
  }

  setData(names: readonly string[], mine: number | null, mineName: string | null) {
    const first = this.data === null;
    const justJoined = !first && mine !== null && this.mine === null;
    this.mine = mine;
    this.mineName = mineName;

    const prev = this.data;
    const data = buildLand(names, mine);
    this.data = data;
    this.city.geometry = data.city;
    this.dash.geometry = data.dash;
    this.xw.geometry = data.xw;
    this.xwFar.geometry = data.xwFar;
    this.own.geometry = data.own?.geo ?? new THREE.BufferGeometry();
    if (prev) {
      for (const g of [prev.city, prev.dash, prev.xw, prev.xwFar, prev.own?.geo]) g?.dispose();
    }
    this.boxes = data.houses.map((hit) => ({ hit, box: new THREE.Box3(hit.min, hit.max) }));
    this.hovered = null;
    this.selected = null;
    this.opts.onHouseCount?.(names.length);

    if (data.own) {
      this.own.visible = true;
      this.own.position.set(data.own.lot.x, 0, data.own.lot.z);
      this.focus = { lot: data.own.lot, n: data.own.n, baseY: data.own.top - 1.6, own: true };
    } else {
      this.own.visible = false;
      this.focus = { lot: data.next.lot, n: data.next.n, baseY: Y0, own: false };
    }
    this.growStart = justJoined && !this.reduced ? performance.now() + 500 : -1;

    // Sign on the next free plot, near its street-side corner.
    const nl = data.next.lot;
    const [sx, sz] = rot(-3.4, 6.6, nl.rot);
    this.sign.position.set(nl.x + sx, Y0, nl.z + sz);
    this.sign.rotation.y = nl.rot + 0.25;
    this.signMat.map?.dispose();
    this.signMat.map = signTex(data.next.n);
    this.signMat.needsUpdate = true;

    this.controls.maxDistance = clamp(Math.max(data.half.x, data.half.z) * 2.2, 700, 2600);

    if (first) this.intro();
    else if (justJoined) this.flyTo(this.focusView(), 1600);
  }

  // Fly to your house, or to the next free plot if you don't have one yet.
  flyToFocus() {
    this.selected = null;
    this.flyTo(this.focusView(), 1300);
  }

  // Zoom out to see the whole city.
  flyToOverview() {
    this.flyTo(this.overview(), 1600);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown, { capture: true });
    canvas.removeEventListener("wheel", this.cancelFlight, { capture: true });
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.labels.remove();
  }

  // ---------- camera ----------

  private portrait() {
    return this.width / this.height < 0.9;
  }

  // Look at the plot from its street side, choosing an angle the plaza's tall landmarks don't block.
  private focusView(): View {
    const f = this.focus;
    if (!f) return this.overview();
    const front = f.lot.rot === 0 ? 0 : Math.PI;
    const target = new THREE.Vector3(f.lot.x, Y0 + (f.own ? 3 : 1.5), f.lot.z);
    const radius = this.portrait() ? 64 : 70;
    const tries: [number, number][] = [];
    for (const phi of [0.98, 0.8]) for (const off of [0.42, -0.42, 0.9, -0.9, 1.3, -1.3]) tries.push([phi, front + off]);
    const clear = tries.find(([phi, theta]) => !this.blocked(target, radius, phi, theta)) ?? [0.62, front + 0.42];
    return { target, radius, phi: clear[0], theta: clear[1] };
  }

  // True if a plaza landmark would sit in the middle of the shot. The test widens towards the camera,
  // because things close to the lens fill more of the frame.
  private blocked(target: THREE.Vector3, radius: number, phi: number, theta: number) {
    const cam = new THREE.Vector3().copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta)));
    for (let s = 0; s <= 24; s++) {
      const t = s / 24;
      const x = THREE.MathUtils.lerp(target.x, cam.x, t);
      const y = THREE.MathUtils.lerp(target.y, cam.y, t);
      const z = THREE.MathUtils.lerp(target.z, cam.z, t);
      for (const lm of LANDMARKS) {
        if (y > lm.h) continue;
        if (Math.hypot(x - lm.x, z - lm.z) < lm.r + 0.32 * radius * t) return true;
      }
    }
    return false;
  }

  private overview(): View {
    const half = this.data?.half ?? { x: 300, z: 250 };
    return {
      target: new THREE.Vector3(0, 0, 0),
      radius: clamp(Math.max(half.x, half.z) * (this.portrait() ? 2.4 : 1.7), 380, 2400),
      phi: 0.82,
      theta: 0.35,
    };
  }

  private intro() {
    const v = this.focusView();
    if (this.reduced) {
      this.applyView(v);
      return;
    }
    const start = this.overview();
    start.theta = v.theta - 0.7;
    start.phi = 0.7;
    this.applyView(start);
    this.flyTo(v, 2800, 300);
  }

  private applyView(v: View) {
    this.controls.target.copy(v.target);
    this.camera.position.copy(v.target).add(this.tmp.setFromSpherical(new THREE.Spherical(v.radius, v.phi, v.theta)));
    this.camera.lookAt(v.target);
    this.controls.update();
  }

  private flyTo(v: View, dur: number, delay = 0) {
    if (this.reduced) {
      this.applyView(v);
      return;
    }
    const from = new THREE.Spherical().setFromVector3(this.tmp.copy(this.camera.position).sub(this.controls.target));
    const to = new THREE.Spherical(v.radius, v.phi, v.theta);
    while (to.theta - from.theta > Math.PI) to.theta -= Math.PI * 2;
    while (to.theta - from.theta < -Math.PI) to.theta += Math.PI * 2;
    const travel = this.controls.target.distanceTo(v.target);
    this.flight = {
      t0: performance.now() + delay,
      dur,
      fromT: this.controls.target.clone(),
      toT: v.target.clone(),
      from,
      to,
      bump: clamp(travel / Math.max(from.radius, to.radius) - 1, 0, 1.5) * 0.35,
    };
    this.controls.enabled = false;
  }

  private stepFlight(now: number) {
    const f = this.flight;
    if (!f) return;
    const t = clamp((now - f.t0) / f.dur, 0, 1);
    const e = easeInOut(t);
    const target = this.controls.target.lerpVectors(f.fromT, f.toT, e);
    const radius = Math.exp(THREE.MathUtils.lerp(Math.log(f.from.radius), Math.log(f.to.radius), e)) * (1 + f.bump * Math.sin(Math.PI * e));
    const s = new THREE.Spherical(radius, THREE.MathUtils.lerp(f.from.phi, f.to.phi, e), THREE.MathUtils.lerp(f.from.theta, f.to.theta, e));
    this.camera.position.copy(target).add(this.tmp.setFromSpherical(s));
    this.camera.lookAt(target);
    if (t >= 1) this.endFlight();
  }

  private endFlight() {
    this.flight = null;
    this.controls.enabled = true;
    this.controls.update();
  }

  private cancelFlight = () => {
    if (this.flight) this.endFlight();
  };

  // ---------- picking ----------

  private pick(clientX: number, clientY: number): HouseHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    let best: HouseHit | null = null;
    let bestD = Infinity;
    const p = new THREE.Vector3();
    for (const { hit, box } of this.boxes) {
      if (this.ray.ray.intersectBox(box, p)) {
        const d = p.distanceToSquared(this.ray.ray.origin);
        if (d < bestD) {
          bestD = d;
          best = hit;
        }
      }
    }
    return best;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.cancelFlight();
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons !== 0) return;
    this.hovered = this.pick(e.clientX, e.clientY);
    this.renderer.domElement.style.cursor = this.hovered ? "pointer" : "";
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved < 6 && performance.now() - d.t < 450) this.selected = this.pick(e.clientX, e.clientY);
  };

  private onPointerLeave = () => {
    this.hovered = null;
    this.renderer.domElement.style.cursor = "";
  };

  // ---------- frame ----------

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 55 : 42;
    const inset = clamp(this.opts.leftInset(), 0, w * 0.6);
    // Shift the image right by half the covered strip so the focus sits centred in the open area.
    if (inset > 0) this.camera.setViewOffset(w, h, -inset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private placeTag(tag: { el: HTMLDivElement }, x: number, y: number, z: number, show: boolean) {
    if (!show) {
      tag.el.style.opacity = "0";
      return;
    }
    const v = this.tmp.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) {
      tag.el.style.opacity = "0";
      return;
    }
    const px = ((v.x + 1) / 2) * this.width;
    const py = ((1 - v.y) / 2) * this.height;
    tag.el.style.opacity = "1";
    tag.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    if (!this.visible) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);

    if (this.flight) {
      if (now >= this.flight.t0) this.stepFlight(now);
    } else {
      this.controls.update();
    }

    // Keep the view over the city.
    const data = this.data;
    const target = this.controls.target;
    if (data) {
      const cx = clamp(target.x, -data.half.x, data.half.x);
      const cz = clamp(target.z, -data.half.z, data.half.z);
      const cy = clamp(target.y, 0, 30);
      const dx = cx - target.x;
      const dy = cy - target.y;
      const dz = cz - target.z;
      if (dx || dy || dz) {
        target.set(cx, cy, cz);
        this.camera.position.x += dx;
        this.camera.position.y += dy;
        this.camera.position.z += dz;
      }
    }

    // Near plane, fog and road-paint detail follow the camera distance (stops far-away flicker).
    const d = this.camera.position.distanceTo(target);
    const near = clamp(d * 0.04, 0.5, 30);
    if (Math.abs(near - this.camera.near) > 0.01 * near) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    this.fog.near = d * 1.6 + 60;
    this.fog.far = d * 7 + 900;
    this.sky.position.copy(this.camera.position);
    const far = d > 200;
    this.dash.visible = d < 520;
    this.xw.visible = !far;
    this.xwFar.visible = far;

    // Sun shadow box follows the view, sized in sqrt(2) steps and snapped to texels so shadows don't swim.
    const half = Math.min(905, 45 * 2 ** (Math.ceil(2 * Math.log2(Math.max(1, (d * 1.05) / 45))) / 2));
    const texel = (2 * half) / this.shadowRes;
    const sv = this.tmp.set(target.x, 0, target.z).applyMatrix4(L_INV);
    sv.x = Math.round(sv.x / texel) * texel;
    sv.y = Math.round(sv.y / texel) * texel;
    sv.applyMatrix4(L_ROT);
    this.sun.target.position.copy(sv);
    this.sun.position.set(sv.x + SUN.x * 1000, sv.y + SUN.y * 1000, sv.z + SUN.z * 1000);
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) {
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.updateProjectionMatrix();
      this.sun.shadow.normalBias = 0.03 + half * 0.0018;
    }

    // Your house rises out of the ground the moment you join.
    if (this.growStart >= 0) {
      const t = clamp((now - this.growStart) / 900, 0, 1);
      const s = t <= 0 ? 0.001 : backOut(t);
      this.own.scale.set(0.6 + 0.4 * Math.min(1, s), Math.max(0.001, s), 0.6 + 0.4 * Math.min(1, s));
      if (t >= 1) {
        this.growStart = -1;
        this.own.scale.set(1, 1, 1);
      }
    }

    // Pin bob + glow pulse on the focus plot.
    const f = this.focus;
    const secs = now / 1000;
    if (f) {
      const bob = this.reduced ? 0 : Math.sin(secs * 2.4) * 0.35;
      const lift = this.growStart >= 0 ? clamp((now - this.growStart) / 900, 0, 1) : 1;
      const baseY = f.own ? Y0 + (f.baseY - Y0) * lift : f.baseY;
      this.pin.position.set(f.lot.x, baseY + bob, f.lot.z);
      this.glow.position.set(f.lot.x, Y0 + 0.1, f.lot.z);
      const pulse = this.reduced ? 1 : 1 + Math.sin(secs * 2) * 0.05;
      this.glow.scale.set(pulse, pulse, 1);
      const typed = getPreviewName();
      this.focusTag.pill.textContent = f.own
        ? `@${this.mineName ?? "you"} · House #${f.n}`
        : `@${typed || "???"} · House #${f.n}`;
      this.placeTag(this.focusTag, f.lot.x, baseY + bob + PIN_HEIGHT + 0.8, f.lot.z, true);
    }

    // Hover (mouse) or tapped house tag.
    const h = this.hovered ?? this.selected;
    const showHover = Boolean(h && (!f?.own || h.n !== f.n));
    if (h && showHover) this.hoverTag.pill.textContent = `@${h.name} · #${h.n}`;
    this.placeTag(this.hoverTag, h?.lot.x ?? 0, (h?.top ?? 0) + 1.2, h?.lot.z ?? 0, showHover);

    this.renderer.render(this.scene, this.camera);
  };
}
