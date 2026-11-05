// The 3D world: renderer, camera moves, the yellow pin + PLOT sign, name tags, house picking, and
// switching which town is drawn in full detail as you move around.
// Plain three.js driven by its own animation loop; React only mounts it and passes data in.
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { getChosenPlot, setChosenPlot, subscribeChosenPlot } from "@/lib/plot-choice";
import { getPreviewName } from "@/lib/preview-name";
import { site } from "@/lib/site";
import { TOWN_SIZE, housesInTown, isOpenPlot, townOf, type MyHouse, type WorldView } from "@/lib/world";
import {
  HOOK_Y,
  LANDMARKS,
  LOAD_DROP,
  addCraneCable,
  addCraneLoad,
  addCraneMast,
  addCraneTop,
  addCraneTrolley,
  buildTown,
  craneHeight,
  craneSpot,
  placed,
  siteTop,
  specForPlot,
  type HouseHit,
  type OwnBuild,
  type TownBuild,
} from "./build";
import { SHAPES, buildCountry, buildFarTowns, extentOf, type Extent, type Inst, type Trees } from "./country";
import { Builder, rot } from "./geo";
import {
  BZ,
  LW,
  SEA_Z,
  TOWN_HALF,
  Y0,
  lastTownOfRing,
  lotAtPoint,
  lotForPlot,
  townAtPoint,
  townCenter,
  townRing,
  type Lot,
} from "./layout";

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, "Helvetica Neue", Arial, sans-serif';
const SKY_FOG = "#DDE8EE";
const SKY_R = 7000;
const SUN = new THREE.Vector3(-0.45, 1, 0.6).normalize();
// Light-space basis of the sun's shadow camera, used to snap its centre to whole shadow texels.
const L_ROT = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), SUN.clone().negate(), new THREE.Vector3(0, 1, 0));
const L_INV = L_ROT.clone().invert();
const PIN_SCALE = 1.15;
const PIN_HEIGHT = (7.4 + 2.2) * PIN_SCALE;
const SIGN = { w: 4.4, h: 2.7 };
const REVEAL_MS = 2600;
// Past this camera distance you're looking at the world, not a street: town labels show up.
const LABEL_D = 950;
// Closer than this, the town under the camera gets drawn in full detail.
const DETAIL_D = 1700;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const fmt = (n: number) => n.toLocaleString("en");

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

// A white board with a red frame and up to four lines of text (sizes in canvas pixels).
const boardTex = (lines: [string, number][], band = false) =>
  canvasTex(880, 540, (g) => {
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, 880, 540);
    let top = 0;
    if (band) {
      // Yellow and black hazard stripes across the top: a building site.
      g.save();
      g.beginPath();
      g.rect(0, 0, 880, 92);
      g.clip();
      g.fillStyle = "#F2B705";
      g.fillRect(0, 0, 880, 92);
      g.fillStyle = "#2A2A2A";
      for (let x = -120; x < 900; x += 92) {
        g.beginPath();
        g.moveTo(x, 92);
        g.lineTo(x + 46, 92);
        g.lineTo(x + 138, 0);
        g.lineTo(x + 92, 0);
        g.closePath();
        g.fill();
      }
      g.restore();
      top = 92;
    }
    g.strokeStyle = "#C24038";
    g.lineWidth = 22;
    g.strokeRect(11, 11, 858, 518);
    g.fillStyle = "#2A2A2A";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const total = lines.reduce((a, [, sz]) => a + sz * 1.1, 0);
    let y = top + (540 - top - total) / 2;
    for (const [txt, sz] of lines) {
      g.font = `900 ${sz}px ${FONT}`;
      g.fillText(txt, 440, y + (sz * 1.1) / 2, 790);
      y += sz * 1.1;
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

type Tag = { el: HTMLDivElement; pill: HTMLDivElement; arrow: HTMLDivElement; title: HTMLSpanElement; sub: HTMLSpanElement };

// HTML tag that follows a point in the 3D scene (same look as the tags in the reel).
const makeTag = (bg: string, color: string): Tag => {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity .2s ease;";
  const pill = document.createElement("div");
  pill.style.cssText = `background:${bg};color:${color};border-radius:16px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.22);max-width:72vw;overflow:hidden;text-overflow:ellipsis;text-align:center;`;
  const title = document.createElement("span");
  title.style.cssText = "display:block;overflow:hidden;text-overflow:ellipsis;";
  const sub = document.createElement("span");
  sub.style.cssText = "display:none;margin-top:3px;font:700 11px/1.1 " + FONT + ";opacity:.72;letter-spacing:.02em;";
  pill.append(title, sub);
  const arrow = document.createElement("div");
  arrow.style.cssText = `background:${bg};transform:rotate(45deg);margin:-6px auto 0;border-radius:2px;`;
  el.append(pill, arrow);
  const tag = { el, pill, arrow, title, sub };
  sizeTag(tag, false);
  return tag;
};

// Phones get smaller, one-line tags so the map isn't buried under text.
const sizeTag = (tag: Tag, compact: boolean) => {
  tag.pill.style.padding = compact ? "5px 10px" : "7px 14px";
  tag.pill.style.font = `800 ${compact ? 12 : 15}px/1.1 ${FONT}`;
  tag.arrow.style.width = tag.arrow.style.height = compact ? "9px" : "12px";
};

const setTagText = (tag: Tag, title: string, sub = "") => {
  if (tag.title.textContent !== title) tag.title.textContent = title;
  if (tag.sub.textContent !== sub) {
    tag.sub.textContent = sub;
    tag.sub.style.display = sub ? "block" : "none";
  }
};

const setTagColor = (tag: Tag, bg: string) => {
  if (tag.pill.style.background === bg) return;
  tag.pill.style.background = bg;
  tag.arrow.style.background = bg;
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

export type ViewInfo = {
  town: number; // the town under the camera
  houses: number; // houses in it
  open: number; // the town where the next house goes
  towns: number; // towns drawn on the map
  zoomedOut: boolean; // looking at the world rather than one town
  loading: boolean;
};

export type LandEngineOptions = {
  // Pixels on the left edge covered by the page's card (desktop), so focused things are centred in the free space.
  leftInset: () => number;
  // Fetches one town's houses (and fresh world numbers).
  loadTown: (town: number) => Promise<WorldView | null>;
  onView?: (info: ViewInfo) => void;
};

export class LandEngine {
  private host: HTMLElement;
  private opts: LandEngineOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.5, 16000);
  private controls: MapControls;
  private sun = new THREE.DirectionalLight("#FFF4E0", 2.1);
  private fog = new THREE.Fog(SKY_FOG, 100, 3000);
  private sky: THREE.Mesh;
  private lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  private inst = new THREE.MeshLambertMaterial({ color: "#FFFFFF" });
  private revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
  private ownMat = new THREE.MeshLambertMaterial({ vertexColors: true, clippingPlanes: [this.revealPlane], clipShadows: true });
  private pinMat = new THREE.MeshLambertMaterial({ color: "#F7C631", emissive: "#8A6400", emissiveIntensity: 0.7 });
  private glowMat: THREE.MeshBasicMaterial;
  private signMat = new THREE.MeshLambertMaterial();
  private ownSignMat = new THREE.MeshLambertMaterial();

  // The town drawn in detail.
  private city = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private dash = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private xw = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private xwFar = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  // Your house: the site (built up from the ground), its crane and its sign.
  private own = new THREE.Group();
  private ownSite = new THREE.Mesh(new THREE.BufferGeometry(), this.ownMat);
  private mast = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private craneTop = new THREE.Group();
  private craneArm = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private hook = new THREE.Group();
  private trolley = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private cable = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private load = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private ownSign = new THREE.Group();
  private crane: { H: number; base: number; reach: number; top: number } | null = null;
  // Countryside and the other towns.
  private country = new THREE.Group();
  private far = new THREE.Group();

  private pin = new THREE.Group();
  private glow: THREE.Mesh;
  private sign = new THREE.Group();
  // White wash over the empty plot under the mouse, when you can pick one.
  private pickMark = new THREE.Mesh(
    new THREE.PlaneGeometry(LW - 0.8, BZ / 2 - 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.38, depthWrite: false }),
  );
  private unsubChoice: () => void;
  private labels: HTMLDivElement;
  private focusTag = makeTag("#F7C631", "#2C2F34");
  private hoverTag = makeTag("#FFFFFF", "#2C2F34");
  private townTags: { t: number; tag: Tag }[] = [];

  private view: WorldView | null = null;
  private me: MyHouse | null = null;
  private towns = new Map<number, Map<number, string>>(); // town -> house number -> username
  private failed = new Map<number, number>(); // town -> when loading it last failed
  private active = 0;
  private loading = 0;
  private maxTown = 0;
  private ext: Extent = extentOf(1);
  private underTown = 0;
  private underSince = 0;
  private lastInfo = "";
  private built: TownBuild | null = null;
  private boxes: { hit: HouseHit; box: THREE.Box3 }[] = [];
  private focus: { lot: Lot; n: number; baseY: number; own: boolean } | null = null;
  private flight: Flight | null = null;
  private revealStart = -1;
  private hovered: HouseHit | null = null;
  private selected: HouseHit | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private raf = 0;
  private visible = true;
  private disposed = false;
  private reduced: boolean;
  private shadowRes: number;
  // Phones and tablets: lighter town, fewer pixels, 30 fps and fewer shadow redraws while nothing moves.
  private lowPower: boolean;
  private compact = false;
  private idle = 0;
  private lastCam = new THREE.Vector3();
  private lastTarget = new THREE.Vector3();
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private width = 1;
  private height = 1;
  private inset = -1; // pixels of the left edge covered by the card, eased towards insetGoal
  private insetGoal = 0;
  private tmp = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(host: HTMLElement, opts: LandEngineOptions) {
    this.host = host;
    this.opts = opts;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.lowPower = coarse;
    this.shadowRes = coarse ? 1024 : 2048;

    // Throws if WebGL is unavailable; the caller shows a fallback.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = !coarse;
    this.renderer.localClippingEnabled = true;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;outline:none;";
    canvas.setAttribute("aria-label", "3D map of the towns. Drag to move around, scroll or pinch to zoom.");
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
      new THREE.SphereGeometry(SKY_R, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    // Town meshes
    for (const m of [this.city, this.ownSite, this.mast, this.craneArm, this.trolley, this.cable, this.load]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.dash.receiveShadow = true;
    this.xw.receiveShadow = true;
    this.xwFar.receiveShadow = true;
    this.hook.add(this.trolley, this.cable, this.load);
    this.craneTop.add(this.craneArm, this.hook);
    this.own.add(this.ownSite, this.mast, this.craneTop);
    this.own.visible = false;
    this.scene.add(this.country, this.far, this.city, this.dash, this.xw, this.xwFar, this.own);

    // Yellow pin + ground glow
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 20), this.pinMat);
    ball.position.y = 7.4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.86, 4.3, 32), this.pinMat);
    tip.position.y = 4.75;
    tip.rotation.x = Math.PI;
    // On phones the shadows are redrawn only now and then, so the bobbing pin would leave a stepping shadow.
    ball.castShadow = !coarse;
    tip.castShadow = !coarse;
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

    // PLOT #N AVAILABLE sign on the next free plot, and the BEING BUILT sign on your house.
    this.makeSignBoard(this.sign, this.signMat);
    this.makeSignBoard(this.ownSign, this.ownSignMat);
    this.ownSign.visible = false;
    this.pickMark.visible = false;
    this.pickMark.renderOrder = 1;
    this.scene.add(this.sign, this.ownSign, this.pickMark);
    this.unsubChoice = subscribeChosenPlot(this.onChoice);

    // Controls: drag to pan, right-drag / two fingers to rotate, wheel / pinch to zoom.
    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 22;
    this.controls.maxDistance = 3000;
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

    // Start high above Town 1 until the first data arrives.
    this.camera.position.set(0, 520, 620);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.raf = requestAnimationFrame(this.loop);
  }

  // New data from the page (first load, after joining, or a refresh).
  setData(view: WorldView) {
    const first = this.view === null;
    const justJoined = !first && view.me !== null && this.me === null;
    this.view = view;
    this.me = view.me;
    this.towns.set(view.town, new Map(view.plots));
    if (view.me) setChosenPlot(null);
    if (first || justJoined) this.active = view.town;

    this.updateWorld();
    this.rebuildTown();

    const now = performance.now();
    if (first) {
      this.intro();
      if (this.me && townOf(this.me.plot) === this.active) this.startReveal(now + 300 + 2800 * 0.55);
    } else if (justJoined) {
      this.flyTo(this.focusView(), 1600);
      this.startReveal(now + 700);
    }
    this.emitInfo(true);
  }

  // Fly to your house, or to the next free plot if you don't have one yet.
  async flyToFocus() {
    this.selected = null;
    const f = this.focus;
    if (!f) return;
    await this.activate(f.lot.town);
    if (this.disposed) return;
    this.flyTo(this.focusView(), 1300);
    if (f.own) this.startReveal(performance.now() + 700);
  }

  // Zoom out over every town.
  flyToWorld() {
    this.flyTo(this.worldView(), 1700);
  }

  // Look at one whole town from above.
  async flyToTown(town: number) {
    this.selected = null;
    await this.activate(town);
    if (this.disposed) return;
    this.flyTo(this.townView(town), 1500);
  }

  dispose() {
    this.disposed = true;
    this.unsubChoice();
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
        // Instanced meshes share their shapes (SHAPES); only their per-instance data is theirs.
        if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
        else m.geometry?.dispose();
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

  // ---------- data -> scene ----------

  private next() {
    return this.view?.next ?? 1;
  }

  private openTown() {
    return this.view?.open ?? 1;
  }

  // The plot the visitor picked, if it can still be had (null: they get the next free one).
  private chosen(): number | null {
    const c = getChosenPlot();
    if (!c || !this.view || this.me || !isOpenPlot(this.view, c)) return null;
    return this.towns.get(townOf(c))?.has(c) ? null : c;
  }

  // An empty plot you could pick under a screen point: in the town drawn in detail, in an open town.
  private freeLotAt(clientX: number, clientY: number): Lot | null {
    if (!this.view || this.me) return null;
    this.setRay(clientX, clientY);
    const p = this.ray.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    const lot = p ? lotAtPoint(p.x, p.z) : null;
    if (!lot || lot.town !== this.active || !isOpenPlot(this.view, lot.plot)) return null;
    return this.towns.get(lot.town)?.has(lot.plot) ? null : lot;
  }

  private onChoice = () => {
    if (!this.view) return;
    this.updateFocus();
    this.wake();
  };

  // Something changed that the next frame must show.
  private wake() {
    this.idle = 0;
  }

  private houses(t: number) {
    return this.view ? housesInTown(this.view, t) : 0;
  }

  // Everything that depends on the world's numbers: which towns are drawn, the far towns, the
  // PLOT sign, the pin, town labels.
  private updateWorld() {
    // Draw every town up to the next ring of the grid past the one being filled, so there's always
    // fresh empty land around.
    const maxTown = lastTownOfRing(townRing(this.openTown()) + 1);
    if (maxTown !== this.maxTown) {
      this.maxTown = maxTown;
      this.ext = extentOf(maxTown);
      this.rebuildCountry();
      this.rebuildTownTags();
      this.controls.maxDistance = this.worldView().radius * 1.3;
    }
    this.rebuildFar();
    this.updateTownTags();
    // A picked plot that someone else has taken meanwhile goes back to "next free plot".
    const c = getChosenPlot();
    if (c !== null && (this.me || this.chosen() === null)) setChosenPlot(null);
    this.updateFocus();
  }

  // Focus: your house, the plot you picked, or the next free plot. The PLOT sign stands on the
  // plot you'd get.
  private updateFocus() {
    const me = this.me;
    if (me) {
      const { lot, spec } = specForPlot(me.plot);
      this.focus = { lot, n: me.plot, baseY: siteTop(spec) - 1.6, own: true };
    } else {
      const n = this.chosen() ?? this.next();
      this.focus = { lot: lotForPlot(n), n, baseY: Y0, own: false };
    }

    const nl = lotForPlot(me ? this.next() : this.focus.n);
    const [sx, sz] = rot(-3.4, 6.6, nl.rot);
    this.sign.position.set(nl.x + sx, Y0, nl.z + sz);
    this.sign.rotation.y = nl.rot + 0.25;
    this.signMat.map?.dispose();
    this.signMat.map = boardTex([
      [`PLOT #${fmt(nl.plot)}`, nl.plot >= 10000 ? 130 : 160],
      ["AVAILABLE", 96],
      [site.townName(nl.town).toUpperCase(), 70],
    ]);
    this.signMat.needsUpdate = true;
  }

  private addInst(group: THREE.Group, list: Inst, geo: THREE.BufferGeometry, cast = false) {
    if (!list.count) return;
    const m = list.mesh(geo, this.inst);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
  }

  private addTrees(group: THREE.Group, t: Trees) {
    this.addInst(group, t.crowns, SHAPES.ico);
    this.addInst(group, t.pines, SHAPES.cone);
    this.addInst(group, t.trunks, SHAPES.cyl);
  }

  private clearGroup(group: THREE.Group) {
    for (const o of [...group.children]) {
      const m = o as THREE.Mesh;
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      else m.geometry?.dispose();
      group.remove(o);
    }
  }

  private rebuildCountry() {
    this.clearGroup(this.country);
    const c = buildCountry(this.ext);
    const ground = new THREE.Mesh(c.ground, this.lam);
    ground.receiveShadow = true;
    this.country.add(ground);
    this.addInst(this.country, c.fields, SHAPES.quad);
    this.addTrees(this.country, c.trees);
  }

  private rebuildFar() {
    this.wake();
    this.clearGroup(this.far);
    const f = buildFarTowns(this.maxTown, this.active, (t) => this.houses(t));
    const ground = new THREE.Mesh(f.ground, this.lam);
    ground.receiveShadow = true;
    this.far.add(ground);
    this.addInst(this.far, f.bodies, SHAPES.box);
    this.addInst(this.far, f.roofs, SHAPES.roof);
    this.addInst(this.far, f.cranes, SHAPES.box);
    this.addTrees(this.far, f.trees);
  }

  private rebuildTown() {
    if (!this.active) return;
    this.wake();
    const plots = this.towns.get(this.active) ?? new Map<number, string>();
    const mine = this.me && townOf(this.me.plot) === this.active ? this.me.plot : null;
    const prev = this.built;
    const built = buildTown(this.active, plots, mine, this.focus?.n ?? this.next(), this.lowPower);
    this.built = built;
    this.city.geometry = built.city;
    this.dash.geometry = built.dash;
    this.xw.geometry = built.xw;
    this.xwFar.geometry = built.xwFar;
    if (prev) for (const g of [prev.city, prev.dash, prev.xw, prev.xwFar]) g.dispose();
    this.boxes = built.houses.map((hit) => ({ hit, box: new THREE.Box3(hit.min, hit.max) }));
    this.hovered = null;
    this.selected = null;
    this.setOwn(built.own);
  }

  // Your house site, its tower crane and its BEING BUILT sign.
  private setOwn(o: OwnBuild | null) {
    for (const m of [this.ownSite, this.mast, this.craneArm, this.trolley, this.cable, this.load]) {
      m.geometry.dispose();
      m.geometry = new THREE.BufferGeometry();
    }
    this.own.visible = Boolean(o);
    this.ownSign.visible = Boolean(o);
    this.crane = null;
    if (!o) return;

    this.own.position.set(o.lot.x, 0, o.lot.z);
    this.ownSite.geometry = o.site;

    const side = o.n % 2 ? 1 : -1;
    const [mx, mz] = craneSpot(o.spec, side);
    const H = Math.max(craneHeight(o.spec.floors), o.top - Y0 + 11);
    const geo = (fill: (b: Builder) => void) => {
      const b = new Builder();
      fill(b);
      return b.geometry();
    };
    this.mast.geometry = geo((b) => addCraneMast(placed(b, mx, Y0, mz, 1), H));
    this.craneArm.geometry = geo((b) => addCraneTop(b));
    this.trolley.geometry = geo((b) => addCraneTrolley(b));
    this.cable.geometry = geo((b) => addCraneCable(b));
    this.load.geometry = geo((b) => addCraneLoad(b));
    this.craneTop.position.set(mx, Y0 + H, mz);
    // The hook works over the house's side wall on the crane's side, clear of the pin in the middle.
    const [hx, hz] = rot(side * 4.3, 0.3, o.lot.rot);
    this.crane = { H, base: Math.atan2(-(hz - mz), hx - mx), reach: Math.hypot(hx - mx, hz - mz), top: o.top };
    this.poseCrane(0);

    const [sx, sz] = rot(-3.4, o.spec.d / 2 + 2.6, o.lot.rot);
    this.ownSign.position.set(o.lot.x + sx, Y0, o.lot.z + sz);
    this.ownSign.rotation.y = o.lot.rot + 0.25;
    this.ownSign.scale.setScalar(1.25);
    const name = `@${this.me?.username ?? "you"}`;
    this.ownSignMat.map?.dispose();
    this.ownSignMat.map = boardTex(
      [
        ["BEING BUILT", 104],
        [name, name.length > 16 ? 56 : 72],
        [`HOUSE #${fmt(o.n)} · ${site.townName(o.lot.town).toUpperCase()}`, 52],
      ],
      true,
    );
    this.ownSignMat.needsUpdate = true;
  }

  private poseCrane(secs: number) {
    const c = this.crane;
    if (!c) return;
    const s = this.reduced ? 0 : secs;
    this.craneTop.rotation.y = c.base + 0.12 * Math.sin(s * 0.23);
    this.hook.position.set(c.reach + 1.6 * Math.sin(s * 0.31), HOOK_Y, 0);
    const lift = 2.4 + 1.3 * Math.sin(s * 0.41);
    const len = Math.max(1, Y0 + c.H + HOOK_Y - LOAD_DROP - (c.top + lift));
    this.cable.scale.set(1, len, 1);
    this.load.position.set(0, -len, 0);
  }

  private startReveal(at: number) {
    if (this.reduced || !this.built?.own) return;
    this.revealStart = at;
    this.revealPlane.constant = Y0;
  }

  // Load a town's houses (if needed) and draw it in full detail.
  private async activate(t: number) {
    if (!this.view || t < 1 || t > this.maxTown || t === this.active || t === this.loading) return;
    this.loading = t;
    this.emitInfo();
    if (!this.towns.has(t) && t <= this.openTown() && this.houses(t) > 0) {
      const v = await this.opts.loadTown(t).catch(() => null);
      if (this.disposed) return;
      if (!v) {
        this.failed.set(t, performance.now());
        if (this.loading === t) this.loading = 0;
        this.emitInfo();
        return;
      }
      this.towns.set(v.town, new Map(v.plots));
      if (v.last !== this.view.last) {
        this.view = { ...this.view, houses: v.houses, last: v.last, towns: v.towns };
        this.updateWorld();
      }
    }
    if (this.loading !== t) return; // another town was asked for meanwhile
    this.loading = 0;
    this.active = t;
    this.rebuildFar();
    this.rebuildTown();
    this.emitInfo();
  }

  private emitInfo(force = false) {
    if (!this.view || !this.opts.onView) return;
    const t = this.underTown || this.active || 1;
    const info: ViewInfo = {
      town: t,
      houses: this.houses(t),
      open: this.openTown(),
      towns: this.maxTown,
      zoomedOut: this.camera.position.distanceTo(this.controls.target) > LABEL_D * 1.4,
      loading: this.loading !== 0,
    };
    const key = `${info.town}|${info.houses}|${info.open}|${info.towns}|${info.zoomedOut}|${info.loading}`;
    if (!force && key === this.lastInfo) return;
    this.lastInfo = key;
    this.opts.onView(info);
  }

  // ---------- town labels (shown when zoomed out) ----------

  private rebuildTownTags() {
    for (const { tag } of this.townTags) tag.el.remove();
    this.townTags = [];
    for (let t = 1; t <= this.maxTown; t++) {
      const tag = makeTag("#FFFFFF", "#2C2F34");
      sizeTag(tag, this.compact);
      this.labels.insertBefore(tag.el, this.hoverTag.el);
      this.townTags.push({ t, tag });
    }
  }

  private updateTownTags() {
    const open = this.openTown();
    const mine = this.me ? townOf(this.me.plot) : 0;
    for (const { t, tag } of this.townTags) {
      const n = this.houses(t);
      const sub =
        t === mine
          ? "Your house is here"
          : t < open
            ? `Full · ${fmt(n)} houses`
            : t === open
              ? `${fmt(n)} / ${fmt(TOWN_SIZE)} · filling now`
              : t === open + 1
                ? "Opens next"
                : "Empty land";
      // Phones: just the name; your town is yellow, the town filling now is solid white.
      setTagText(tag, site.townName(t), this.compact ? "" : sub);
      setTagColor(tag, t === mine ? "#F7C631" : t === open ? "#FFFFFF" : "rgba(255,255,255,0.78)");
    }
  }

  // ---------- camera ----------

  private portrait() {
    return this.width / this.height < 0.9;
  }

  // Look at the plot from its street side, choosing an angle the plaza's tall landmarks don't block.
  private focusView(): View {
    const f = this.focus;
    if (!f) return this.townView(1);
    const front = f.lot.rot === 0 ? 0 : Math.PI;
    const target = new THREE.Vector3(f.lot.x, Y0 + (f.own ? 3 : 1.5), f.lot.z);
    const radius = f.own ? (this.portrait() ? 74 : 80) : this.portrait() ? 64 : 70;
    const [ox, oz] = townCenter(f.lot.town);
    const tries: [number, number][] = [];
    for (const phi of [0.98, 0.8]) for (const off of [0.42, -0.42, 0.9, -0.9, 1.3, -1.3]) tries.push([phi, front + off]);
    const clear = tries.find(([phi, theta]) => !this.blocked(target, radius, phi, theta, ox, oz)) ?? [0.62, front + 0.42];
    return { target, radius, phi: clear[0], theta: clear[1] };
  }

  // True if a plaza landmark would sit in the middle of the shot. The test widens towards the camera,
  // because things close to the lens fill more of the frame.
  private blocked(target: THREE.Vector3, radius: number, phi: number, theta: number, ox: number, oz: number) {
    const cam = new THREE.Vector3().copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta)));
    for (let s = 0; s <= 24; s++) {
      const t = s / 24;
      const x = THREE.MathUtils.lerp(target.x, cam.x, t);
      const y = THREE.MathUtils.lerp(target.y, cam.y, t);
      const z = THREE.MathUtils.lerp(target.z, cam.z, t);
      for (const lm of LANDMARKS) {
        if (y > lm.h) continue;
        if (Math.hypot(x - ox - lm.x, z - oz - lm.z) < lm.r + 0.32 * radius * t) return true;
      }
    }
    return false;
  }

  private townView(t: number): View {
    const [x, z] = townCenter(t);
    return {
      target: new THREE.Vector3(x, 0, z),
      radius: Math.max(TOWN_HALF.x, TOWN_HALF.z) * (this.portrait() ? 2.9 : 2.2),
      phi: 0.82,
      theta: 0.35,
    };
  }

  // Every drawn town in frame: fit the wider of the grid's width and depth to the open part of the screen.
  private worldView(): View {
    const e = this.ext;
    const hx = (e.maxX - e.minX) / 2;
    const hz = (e.maxZ - e.minZ) / 2;
    const free = Math.max(0.35, 1 - clamp(this.opts.leftInset(), 0, this.width * 0.6) / this.width);
    const aspect = (this.width * free) / this.height;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fitX = hx / (tanV * aspect);
    const fitZ = (hz * 0.95) / tanV; // depth looks shorter from this tilted angle
    return {
      target: new THREE.Vector3((e.minX + e.maxX) / 2, 0, (e.minZ + e.maxZ) / 2),
      radius: Math.max(fitX, fitZ) * 1.04,
      phi: 0.7,
      theta: 0.08,
    };
  }

  private intro() {
    const v = this.focusView();
    if (this.reduced) {
      this.applyView(v);
      return;
    }
    const start = this.townView(this.focus?.lot.town ?? 1);
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

  private setRay(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
  }

  private pick(clientX: number, clientY: number): HouseHit | null {
    this.setRay(clientX, clientY);
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

  // The town under a screen point (0 if none).
  private pickTown(clientX: number, clientY: number) {
    this.setRay(clientX, clientY);
    const p = this.ray.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    if (!p) return 0;
    const t = townAtPoint(p.x, p.z);
    if (t < 1 || t > this.maxTown) return 0;
    const [x, z] = townCenter(t);
    return Math.abs(p.x - x) < TOWN_HALF.x + 40 && Math.abs(p.z - z) < TOWN_HALF.z + 40 ? t : 0;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.cancelFlight();
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons !== 0) return;
    this.hovered = this.pick(e.clientX, e.clientY);
    const far = this.camera.position.distanceTo(this.controls.target) > LABEL_D;
    const lot = !this.hovered && !far ? this.freeLotAt(e.clientX, e.clientY) : null;
    this.markLot(lot && lot.plot !== this.focus?.n ? lot : null);
    this.renderer.domElement.style.cursor =
      this.hovered || lot || (far && this.pickTown(e.clientX, e.clientY)) ? "pointer" : "";
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved >= 6 || performance.now() - d.t >= 450) return;
    this.wake();
    this.selected = this.pick(e.clientX, e.clientY);
    if (this.selected) return;
    if (this.camera.position.distanceTo(this.controls.target) > LABEL_D) {
      // Zoomed out, a tap on a town flies there.
      const t = this.pickTown(e.clientX, e.clientY);
      if (t) void this.flyToTown(t);
      return;
    }
    // A tap on an empty plot picks it.
    const lot = this.freeLotAt(e.clientX, e.clientY);
    if (lot) this.choose(lot);
  };

  private onPointerLeave = () => {
    this.hovered = null;
    this.markLot(null);
    this.renderer.domElement.style.cursor = "";
  };

  private markLot(lot: Lot | null) {
    this.pickMark.visible = Boolean(lot);
    if (!lot) return;
    this.pickMark.position.set(lot.x, Y0 + 0.09, lot.row === "S" ? lot.cz + 9.3 : lot.cz - 9.3);
  }

  // Pick a plot: the pin, tag and PLOT sign move there and the camera glides over, keeping its zoom.
  private choose(lot: Lot) {
    setChosenPlot(lot.plot === this.next() ? null : lot.plot);
    this.markLot(null);
    const from = new THREE.Spherical().setFromVector3(this.tmp.copy(this.camera.position).sub(this.controls.target));
    this.flyTo(
      { target: new THREE.Vector3(lot.x, Y0 + 1.5, lot.z), radius: clamp(from.radius, 50, 420), phi: from.phi, theta: from.theta },
      700,
    );
  }

  // ---------- frame ----------

  // The page layout changed (e.g. the card was collapsed): re-measure.
  relayout() {
    this.resize();
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 55 : 42;
    const compact = w < 640;
    if (compact !== this.compact) {
      this.compact = compact;
      for (const tag of [this.focusTag, this.hoverTag, ...this.townTags.map((t) => t.tag)]) sizeTag(tag, compact);
      this.updateTownTags();
    }
    this.wake();
    this.insetGoal = clamp(this.opts.leftInset(), 0, w * 0.6);
    // The first measurement applies at once; later changes ease in from the frame loop.
    if (this.inset < 0) this.inset = this.insetGoal;
    this.applyInset();
    if (this.maxTown) this.controls.maxDistance = this.worldView().radius * 1.3;
  }

  // Shift the image right by half the covered strip so the focus sits centred in the open area.
  private applyInset() {
    const { width: w, height: h } = this;
    if (this.inset > 0.5) this.camera.setViewOffset(w, h, -this.inset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private placeTag(tag: { el: HTMLDivElement }, x: number, y: number, z: number, show: boolean, opacity = 1) {
    if (!show || opacity <= 0.01) {
      if (tag.el.style.opacity !== "0") tag.el.style.opacity = "0";
      return;
    }
    const v = this.tmp.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) {
      tag.el.style.opacity = "0";
      return;
    }
    const px = ((v.x + 1) / 2) * this.width;
    const py = ((1 - v.y) / 2) * this.height;
    tag.el.style.opacity = opacity.toFixed(2);
    tag.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    if (!this.visible) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);

    if (Math.abs(this.insetGoal - this.inset) > 0.5) {
      this.inset = this.reduced ? this.insetGoal : this.inset + (this.insetGoal - this.inset) * 0.14;
      if (Math.abs(this.insetGoal - this.inset) <= 0.5) this.inset = this.insetGoal;
      this.applyInset();
    }

    if (this.flight) {
      if (now >= this.flight.t0) this.stepFlight(now);
    } else {
      this.controls.update();
    }

    // Keep the view over the land.
    const target = this.controls.target;
    const e = this.ext;
    const cx = clamp(target.x, e.minX - 300, e.maxX + 300);
    const cz = clamp(target.z, SEA_Z + 60, e.maxZ + 300);
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

    // Near/far planes, sky, fog and road-paint detail follow the camera distance (stops far-away flicker).
    const d = this.camera.position.distanceTo(target);
    const near = clamp(d * 0.04, 0.5, 400);
    const farPlane = Math.max(16000, d * 4);
    if (Math.abs(near - this.camera.near) > 0.01 * near || Math.abs(farPlane - this.camera.far) > 0.02 * farPlane) {
      this.camera.near = near;
      this.camera.far = farPlane;
      this.camera.updateProjectionMatrix();
    }
    this.sky.scale.setScalar((farPlane * 0.45) / SKY_R);
    this.fog.near = d * 1.6 + 60;
    this.fog.far = d * 7 + 900;
    this.sky.position.copy(this.camera.position);
    const farView = d > 200;
    this.dash.visible = d < 520;
    this.xw.visible = !farView;
    this.xwFar.visible = farView;

    // The town under the camera: draw it in detail once you've settled over it.
    if (this.view) {
      const t = townAtPoint(target.x, target.z);
      const under = t >= 1 && t <= this.maxTown ? t : this.active;
      if (under !== this.underTown) {
        this.underTown = under;
        this.underSince = now;
      }
      const failedAt = this.failed.get(under) ?? -Infinity;
      if (!this.flight && under !== this.active && d < DETAIL_D && now - this.underSince > 350 && now - failedAt > 10000) {
        void this.activate(under);
      }
      this.emitInfo();
    }

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

    // Phones: while nothing moves, draw every other frame and redraw shadows only now and then.
    const camMoved = this.camera.position.distanceToSquared(this.lastCam) > 1e-6 || target.distanceToSquared(this.lastTarget) > 1e-6;
    this.lastCam.copy(this.camera.position);
    this.lastTarget.copy(target);
    if (camMoved || this.flight || this.revealStart >= 0 || Math.abs(this.insetGoal - this.inset) > 0.5) this.idle = 0;
    else this.idle++;
    if (this.lowPower) {
      if (this.idle % 2 === 1) return;
      this.renderer.shadowMap.needsUpdate = this.idle === 0 || this.idle % 16 === 0;
    }

    const secs = now / 1000;

    // Your house goes up from the ground, layer by layer; the crane keeps working.
    const own = this.built?.own;
    let lift = 1;
    if (own && this.revealStart >= 0) {
      const t = clamp((now - this.revealStart) / REVEAL_MS, 0, 1);
      lift = easeOut(t);
      this.revealPlane.constant = Y0 + (own.top + 0.6 - Y0) * lift;
      if (t >= 1) {
        this.revealStart = -1;
        this.revealPlane.constant = 1e5;
      }
    }
    if (this.own.visible) this.poseCrane(secs);

    // Pin bob + glow pulse on the focus plot.
    const f = this.focus;
    if (f) {
      const bob = this.reduced ? 0 : Math.sin(secs * 2.4) * 0.35;
      const baseY = f.own ? Y0 + (f.baseY - Y0) * lift : f.baseY;
      this.pin.position.set(f.lot.x, baseY + bob, f.lot.z);
      this.glow.position.set(f.lot.x, Y0 + 0.1, f.lot.z);
      const pulse = this.reduced ? 1 : 1 + Math.sin(secs * 2) * 0.05;
      this.glow.scale.set(pulse, pulse, 1);
      const who = f.own ? this.me?.username ?? "you" : getPreviewName() || "???";
      const house = this.compact ? `#${fmt(f.n)}` : `House #${fmt(f.n)}`;
      const sub = this.compact
        ? ""
        : f.own
          ? `Being built · ${site.townName(f.lot.town)}`
          : `${site.townName(f.lot.town)} · ${getChosenPlot() === f.n ? "your pick" : "available"}`;
      setTagText(this.focusTag, `@${who} · ${house}`, sub);
      // Fade it out as the camera pulls up into the world view, so town labels take over.
      const op = clamp(1 - (d - LABEL_D * 1.6) / 600, 0, 1);
      this.placeTag(this.focusTag, f.lot.x, baseY + bob + PIN_HEIGHT + 0.8, f.lot.z, true, op);
    }

    // Hover (mouse) or tapped house tag.
    const h = this.hovered ?? this.selected;
    const showHover = Boolean(h && (!f?.own || h.n !== f.n) && d < LABEL_D);
    if (h && showHover) setTagText(this.hoverTag, `@${h.name} · #${fmt(h.n)}`);
    this.placeTag(this.hoverTag, h?.lot.x ?? 0, (h?.top ?? 0) + 1.2, h?.lot.z ?? 0, showHover);

    // Town labels when zoomed out.
    const labelOp = clamp((d - LABEL_D) / 350, 0, 1);
    for (const { t, tag } of this.townTags) {
      const [x, z] = townCenter(t);
      this.placeTag(tag, x, 60, z, labelOp > 0, labelOp);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private makeSignBoard(group: THREE.Group, mat: THREE.MeshLambertMaterial) {
    const postMat = new THREE.MeshLambertMaterial({ color: "#7A4E2D" });
    const frameMat = new THREE.MeshLambertMaterial({ color: "#C24038" });
    for (const x of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.22), postMat);
      post.position.set(x, 1.6, 0);
      post.castShadow = true;
      group.add(post);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(SIGN.w + 0.2, SIGN.h + 0.2, 0.12), frameMat);
    frame.position.set(0, 3.0, 0);
    frame.castShadow = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), mat);
    board.position.set(0, 3.0, 0.07);
    group.add(frame, board);
  }
}
