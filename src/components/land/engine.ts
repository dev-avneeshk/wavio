// The 3D world: renderer, camera moves, the yellow pin + PLOT sign, name tags, house picking, and
// switching which town is drawn in full detail as you move around.
// Plain three.js driven by its own animation loop; React only mounts it and passes data in.
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { nowSec, percentText, progressOf, timeLeftText } from "@/lib/house";
import { getChosenPlot, setChosenPlot, subscribeChosenPlot } from "@/lib/plot-choice";
import { getPreviewName } from "@/lib/preview-name";
import { site } from "@/lib/site";
import { subscribeSkyPicks } from "@/lib/sky";
import { TOWN_SIZE, housesInTown, isOpenPlot, townOf, type House, type MyHouse, type WorldView } from "@/lib/world";
import { NameBoards } from "./boards";
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
  type HouseHit,
  type OwnBuild,
  type TownBuild,
} from "./build";
import type { GameEvent } from "@/lib/game";
import type { TownFeed } from "@/lib/game-api";
import type { LiveLink } from "@/lib/game-live";
import { homeOf, tallThings } from "../people/nav";
import { People, type Near, type PersonInfo } from "../people/people";
import { Wildlife, type AnimalNote } from "../wild/animals";
import { JUNGLE, buildJungle, gateSignTex, jungleOf, zoneAt, type JungleBuild, type Zone } from "./jungle";
import { SkySystem, patchWorld } from "./sky";
import { siteTop, specForPlot } from "./spec";
import { SHAPES, buildCountry, buildFarTowns, extentOf, type Extent, type Inst, type Trees } from "./country";
import { canopyGap } from "./jungle";
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
  townAtCell,
  townAtPoint,
  townCenter,
  townRing,
  type Lot,
} from "./layout";

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, "Helvetica Neue", Arial, sans-serif';
const SKY_FOG = "#DDE8EE";
const SKY_R = 7000;
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3(0, 0, 0);
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

// A town's houses by house number. The engine keeps its own copies, so it can update waves in place.
const houseMap = (list: readonly House[]) => new Map(list.map((h) => [h.plot, { ...h }]));

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

// The house someone tapped (the page shows its card above it).
export type Selection = { house: House; town: number; mine: boolean };

export type LandEngineOptions = {
  // Pixels on the left edge covered by the page's card (desktop), so focused things are centred in the free space.
  leftInset: () => number;
  // Fetches one town's houses (and fresh world numbers).
  loadTown: (town: number) => Promise<WorldView | null>;
  onView?: (info: ViewInfo) => void;
  onSelect?: (sel: Selection | null) => void;
  // A house to open the map on (from a shared link), instead of your own house.
  startAt?: number | null;
  // What's going on in a town (public.town_events), for its people to act out.
  loadFeed?: (town: number) => Promise<TownFeed | null>;
  // Live positions of other players (players in the game only).
  live?: LiveLink | null;
  // The person someone tapped (their card), refreshed every second while it's open.
  onSelectPerson?: (info: PersonInfo | null) => void;
  // Someone within reach of your person while you play.
  onNear?: (near: Near) => void;
  // Your person walked into the jungle (trail, clearing) or back into town.
  onZone?: (zone: Zone) => void;
  // An animal reacted to you (you got close, or tapped it).
  onAnimal?: (note: AnimalNote) => void;
  // Play mode started or ended (also when it can't start yet).
  onPlay?: (on: boolean) => void;
};

// Keys that walk your person (arrows or WASD), and Shift to run.
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

// How long a message bubble stays over the sender's house.
const BUBBLE_MS = 9000;

export class LandEngine {
  private host: HTMLElement;
  private opts: LandEngineOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.5, 16000);
  private controls: MapControls;
  private sun = new THREE.DirectionalLight("#FFF4E0", 2.1);
  private fog = new THREE.Fog(SKY_FOG, 100, 3000);
  private hemi = new THREE.HemisphereLight("#EAF4FF", "#A3B57F", 1.5);
  // Time of day and weather on India's clock (sky.ts, src/lib/sky.ts).
  private sky: SkySystem;
  private unsubSky: () => void;
  // Light-space basis of the key light's shadow camera, used to snap its centre to whole shadow texels.
  private lRot = new THREE.Matrix4();
  private lInv = new THREE.Matrix4();
  private lDir = new THREE.Vector3();
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
  // The jungle next to the town drawn in detail, and its animals.
  private jungleMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.lam);
  private jungleSign = new THREE.Group();
  private jungleSignMats: THREE.MeshLambertMaterial[] = [];
  private jungle: JungleBuild | null = null;
  private jungleKey = "";
  private gap = 11; // spacing of the jungle canopy
  private wild: Wildlife;
  private zone: Zone = "town";

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
  // Speech bubbles over houses whose owner just sent you a message.
  private bubbles = new Map<number, { tag: Tag; until: number }>();
  // The page's card for the tapped house; the engine keeps it above the house.
  private popup: HTMLElement | null = null;
  private boards: NameBoards;
  private ownSignAt = 0;

  private view: WorldView | null = null;
  private me: MyHouse | null = null;
  private towns = new Map<number, Map<number, House>>(); // town -> house number -> house
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
  private selectedPlot = 0; // kept across rebuilds of the town, so the card stays open
  private nudgedPlot = 0; // the tapped house the view was last moved for, so its card fits above it
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

  // The people living in the town drawn in detail, and you walking yours around (play mode).
  private people: People;
  private inGame = false; // the signed-in player is in the game (their person follows them)
  private playing = false; // play mode: camera behind your person, keys / stick walk them
  private playWanted = false; // asked for play mode before your person was ready
  private playStarting = false;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0, run: false };
  private running = false; // Shift, or the run button
  private lastFrame = 0;
  private peopleAt = 0;
  private stepDelta = new THREE.Vector3();
  private playerAt = new THREE.Vector3();
  private personSel = 0; // the tapped person's house number
  private personPopup: HTMLElement | null = null;
  private personEmitAt = 0;

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
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.shadowRes, this.shadowRes);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.sky = new SkySystem({
      scene: this.scene,
      sun: this.sun,
      hemi: this.hemi,
      fog: this.fog,
      lowPower: coarse,
      reduced: this.reduced,
      radius: SKY_R,
    });
    for (const m of [this.lam, this.inst, this.ownMat]) patchWorld(m, this.sky.world);
    this.unsubSky = subscribeSkyPicks(() => {
      this.sky.refresh(true);
      this.wake();
    });

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
    this.jungleMesh.castShadow = !coarse;
    this.jungleMesh.receiveShadow = true;
    this.scene.add(this.country, this.far, this.city, this.dash, this.xw, this.xwFar, this.own, this.jungleMesh, this.jungleSign);

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

    // Names on the boards in front of the houses nearest the camera.
    this.boards = new NameBoards(coarse ? 18 : 36, FONT);
    this.scene.add(this.boards.group);

    this.people = new People({
      scene: this.scene,
      labels: this.labels,
      font: FONT,
      lowPower: coarse,
      fetchFeed: opts.loadFeed ?? (async () => null),
      link: opts.live ?? null,
      onNear: opts.onNear,
    });

    this.wild = new Wildlife({ scene: this.scene, labels: this.labels, font: FONT, lowPower: coarse, onNote: opts.onAnimal });

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
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

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
    this.people.setOwner(this.me?.plot ?? null, this.inGame && this.me !== null);
    this.towns.set(view.town, houseMap(view.plots));
    if (view.me) setChosenPlot(null);
    if (first || justJoined) this.active = view.town;

    this.updateWorld();
    this.rebuildTown();

    const now = performance.now();
    const start = this.opts.startAt;
    if (first && start && start >= 1 && start <= this.maxTown * TOWN_SIZE) {
      // Opened from a link to a house: start over its town and fly down to it.
      this.applyView(this.townView(townOf(start)));
      void this.flyToHouse(start);
    } else if (first) {
      this.intro();
      if (this.me && townOf(this.me.plot) === this.active) this.startReveal(now + 300 + 2800 * 0.55);
    } else if (justJoined) {
      this.flyTo(this.focusView(), 1600);
      this.startReveal(now + 700);
    }
    this.emitInfo(true);
  }

  // Fly to a house (in any town) and open its card. An empty plot is just shown.
  async flyToHouse(plot: number, open = true) {
    if (!Number.isInteger(plot) || plot < 1) return;
    const town = townOf(plot);
    this.select(null);
    await this.activate(town);
    if (this.disposed) return;
    this.flyTo(this.lotView(lotForPlot(plot), false), 1400);
    if (open) this.select(plot);
  }

  // Open (or close, with null) the card of a house in the town drawn in detail.
  select(plot: number | null) {
    const hit = plot ? (this.boxes.find((b) => b.hit.n === plot)?.hit ?? null) : null;
    if (hit === this.selected) return;
    if (hit && this.personSel) {
      this.personSel = 0;
      this.emitPerson();
    }
    this.selected = hit;
    this.selectedPlot = hit?.n ?? 0;
    this.nudgedPlot = 0;
    this.wake();
    this.emitSelect();
  }

  // The page's card for the tapped house; it's moved to sit above the house every frame.
  setPopup(el: HTMLElement | null) {
    this.popup = el;
  }

  // Someone changed a house (for example, waved at it): update the map without rebuilding it.
  patchHouse(plot: number, patch: Partial<Pick<House, "waves">>) {
    const houses = this.towns.get(townOf(plot));
    const h = houses?.get(plot);
    if (!h) return;
    Object.assign(h, patch);
    if (this.me?.plot === plot) Object.assign(this.me, patch);
    this.boards.invalidate();
    if (this.selected?.n === plot) this.emitSelect();
  }

  // A speech bubble over a house for a few seconds (a neighbour's new message).
  showBubble(plot: number, text: string) {
    if (townOf(plot) !== this.active || !this.boxes.some((b) => b.hit.n === plot)) return;
    let b = this.bubbles.get(plot);
    if (!b) {
      const tag = makeTag("#FFFFFF", "#2C2F34");
      sizeTag(tag, this.compact);
      tag.pill.style.maxWidth = this.compact ? "56vw" : "260px";
      this.labels.insertBefore(tag.el, this.focusTag.el);
      b = { tag, until: 0 };
      this.bubbles.set(plot, b);
    }
    const short = text.length > 70 ? `${text.slice(0, 68)}…` : text;
    setTagText(b.tag, short);
    b.until = performance.now() + BUBBLE_MS;
    this.wake();
  }

  private emitSelect() {
    const h = this.selected;
    this.opts.onSelect?.(h ? { house: { ...h.house }, town: h.lot.town, mine: this.me?.plot === h.n } : null);
  }

  // ---------- people and play mode ----------

  // You're in the game (or not): your person stops living on their own and follows you.
  setInGame(on: boolean) {
    this.inGame = on && this.me !== null;
    this.people.setOwner(this.me?.plot ?? null, this.inGame);
    if (!this.inGame && this.playing) this.setPlay(false);
  }

  // The server's clock, from a game call (keeps everyone's people in step).
  syncClock(serverNow: number, rttMs: number) {
    this.people.syncClock(serverNow, rttMs);
  }

  serverNow() {
    return this.people.now();
  }

  // Play mode: the camera goes behind your person; arrows / WASD (or the stick) walk them.
  async setPlay(on: boolean) {
    if (on === this.playing || (on && this.playStarting)) return;
    if (!on) {
      this.playWanted = false;
      this.playing = false;
      this.keys.clear();
      this.stick = { x: 0, y: 0, run: false };
      this.mapControls();
      this.opts.onPlay?.(false);
      this.wake();
      return;
    }
    if (!this.me || !this.inGame) return;
    this.select(null);
    this.selectPerson(null);
    this.playWanted = true;
    this.playStarting = true;
    await this.activate(townOf(this.me.plot));
    this.playStarting = false;
    if (this.disposed || !this.playWanted) return;
    if (!this.people.hasPlayer()) return; // tried again once your person has appeared (frame loop)
    this.playWanted = false;
    this.playing = true;
    this.playControls();
    const p = this.people.playerPos(this.playerAt);
    if (p) {
      // At home: look from the street, so you see your person with the house behind them.
      // Anywhere else: from behind them.
      const lot = lotForPlot(this.me.plot);
      const home = Math.hypot(p.x - lot.x, p.z - lot.z) < 14;
      const theta = home ? lot.rot + 0.55 : this.people.playerFacing() + Math.PI;
      this.flyTo({ target: p.clone().setY(p.y + 1.4), radius: this.compact ? 10 : 11.5, phi: 1.1, theta }, 1100);
    }
    this.opts.onPlay?.(true);
  }

  // The on-screen stick (phones): x right, y forward, each -1..1.
  setStick(x: number, y: number) {
    this.stick.x = clamp(x, -1, 1);
    this.stick.y = clamp(y, -1, 1);
  }

  setRun(on: boolean) {
    this.running = on;
  }

  // Your person waves, or acts out a fight / theft the database has decided (ev).
  playAct(kind: "fight" | "steal" | "wave", ev: GameEvent | null) {
    this.people.playAct(kind, ev);
  }

  // Open (or close) the card of a person in the town drawn in detail.
  selectPerson(plot: number | null) {
    const next = plot ?? 0;
    if (next === this.personSel) return;
    this.personSel = next;
    if (next) this.select(null);
    this.emitPerson();
  }

  setPersonPopup(el: HTMLElement | null) {
    this.personPopup = el;
  }

  private emitPerson() {
    this.personEmitAt = performance.now();
    this.opts.onSelectPerson?.(this.personSel ? this.people.info(this.personSel) : null);
  }

  private mapControls() {
    const c = this.controls;
    c.enablePan = true;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.minDistance = 22;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = 1.22;
    c.zoomToCursor = true;
    if (this.maxTown) c.maxDistance = this.worldView().radius * 1.3;
  }

  private playControls() {
    const c = this.controls;
    c.enablePan = false;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.minDistance = 4;
    c.maxDistance = 70;
    c.minPolarAngle = 0.3;
    c.maxPolarAngle = 1.48;
    c.zoomToCursor = false;
  }

  private typing(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.playing || this.typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.running = true;
    if (KEYS[e.code]) {
      this.keys.add(e.code);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.running = false;
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.running = false;
  };

  // Which way to walk, in the world: keys and stick, turned to the camera's heading.
  private moveDir(): { x: number; z: number } | null {
    let fx = this.stick.y;
    let rx = this.stick.x;
    for (const k of this.keys) {
      const [r, f] = KEYS[k] ?? [0, 0];
      rx += r;
      fx += f;
    }
    const len = Math.hypot(rx, fx);
    if (len < 0.08) return null;
    if (len > 1) {
      rx /= len;
      fx /= len;
    }
    const fwd = this.tmp.copy(this.controls.target).sub(this.camera.position).setY(0);
    if (fwd.lengthSq() < 1e-6) return null;
    fwd.normalize();
    // Right of the camera's heading is (-fwd.z, fwd.x).
    return { x: fwd.x * fx - fwd.z * rx, z: fwd.z * fx + fwd.x * rx };
  }

  // Your person moves; the camera comes along, keeping its angle.
  private followPlayer(dt: number) {
    const dir = this.playing && !this.flight ? this.moveDir() : null;
    this.people.stepPlayer(dt, dir, this.running || this.stick.run, this.stepDelta);
    if (!this.playing || this.flight) return;
    const p = this.people.playerPos(this.playerAt);
    if (!p) return;
    const want = this.tmp.copy(p).setY(p.y + 1.4).sub(this.controls.target);
    if (want.lengthSq() < 1e-8) return;
    this.controls.target.add(want);
    this.camera.position.add(want);
    this.idle = 0;
  }

  // Play mode: if a house or a tall thing is between the camera and your person, draw this frame
  // from just in front of it. The camera goes back afterwards, so your zoom isn't lost.
  private unblockCamera() {
    const t = this.controls.target;
    const cam = this.camera.position;
    const dir = this.camDir.copy(cam).sub(t);
    const len = dir.length();
    if (len < 2) return false;
    dir.divideScalar(len);
    this.camRay.set(t, dir);
    const b = this.camBox;
    const p = this.camHit;
    let best = len;
    const test = (x: number, z: number, hx: number, hz: number, top: number) => {
      if (Math.abs(x - t.x) > len + hx + 2 || Math.abs(z - t.z) > len + hz + 2) return;
      b.min.set(x - hx, 0, z - hz);
      b.max.set(x + hx, top, z + hz);
      if (b.containsPoint(t)) return;
      if (this.camRay.intersectBox(b, p)) best = Math.min(best, p.distanceTo(t));
    };
    for (const { hit } of this.boxes) test(hit.lot.x, hit.lot.z, hit.spec.w / 2 + 0.25, hit.spec.d / 2 + 0.25, hit.top + 0.2);
    for (const o of tallThings(this.active)) test(o.x, o.z, o.hx, o.hz, o.top);
    if (this.zone !== "town") for (const o of this.jungle?.blockers ?? []) test(o.x, o.z, o.hx, o.hz, o.top);
    if (best >= len - 0.05) return false;
    this.camSaved.copy(cam);
    cam.copy(t).addScaledVector(dir, Math.max(1.6, best - 0.4));
    this.camera.updateMatrixWorld();
    return true;
  }

  private camDir = new THREE.Vector3();
  private camRay = new THREE.Ray();
  private camBox = new THREE.Box3();
  private camHit = new THREE.Vector3();
  private camSaved = new THREE.Vector3();

  private placePersonPopup(d: number) {
    const el = this.personPopup;
    if (!el) return;
    const hide = () => {
      if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
    };
    if (!this.personSel || d > LABEL_D) return hide();
    const a = this.people.anchor(this.personSel, this.tmp);
    if (!a) return hide();
    const v = a.project(this.camera);
    if (v.z > 1 || v.z < -1) return hide();
    const px = ((v.x + 1) / 2) * this.width;
    const py = ((1 - v.y) / 2) * this.height;
    if (px < -40 || px > this.width + 40 || py < -40 || py > this.height + 40) return hide();
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    const minX = 8 + (this.insetGoal > 0.5 ? this.insetGoal : 0);
    const left = clamp(px - w / 2, minX, Math.max(minX, this.width - w - 8));
    const top = clamp(py - ht - 14, 56, Math.max(56, this.height - ht - 64));
    el.style.visibility = "visible";
    el.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    el.style.setProperty("--arrow-x", `${clamp(px - left, 18, w - 18).toFixed(1)}px`);
    el.dataset.arrow = Math.abs(top - (py - ht - 14)) < 2 ? "down" : "none";
  }

  // Fly to your house, or to the next free plot if you don't have one yet.
  async flyToFocus() {
    this.select(null);
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
    this.select(null);
    await this.activate(town);
    if (this.disposed) return;
    this.flyTo(this.townView(town), 1500);
  }

  // The jungle next to the town you're looking at: down over the trail to the waterhole.
  async flyToJungle() {
    this.select(null);
    this.selectPerson(null);
    const town = this.underTown || this.active || (this.me ? townOf(this.me.plot) : 1);
    await this.activate(town);
    if (this.disposed) return;
    const j = jungleOf(this.active);
    this.flyTo({ target: new THREE.Vector3(j.cx - 8, 1.5, j.cz), radius: this.portrait() ? 92 : 80, phi: 0.98, theta: -Math.PI / 2 + 0.6 }, 1700);
  }

  // Play mode: your person goes to the jungle gate, or back home to their front gate.
  travel(where: "jungle" | "home") {
    if (!this.playing || !this.me) return;
    let x: number;
    let z: number;
    let ry: number;
    if (where === "jungle") {
      const j = jungleOf(this.active);
      x = j.gateX + 2.5;
      z = j.tz;
      ry = Math.PI / 2;
    } else {
      const h = homeOf(this.me.plot);
      x = h.gate.x;
      z = h.gate.z;
      ry = h.in;
    }
    this.people.teleportPlayer(x, z, ry);
    const y = this.people.playerPos(this.playerAt)?.y ?? 0.3;
    this.flyTo({ target: new THREE.Vector3(x, y + 1.4, z), radius: this.compact ? 10 : 11.5, phi: 1.1, theta: ry + Math.PI }, 700);
  }

  // Where your person is (play mode): town, the jungle trail or the clearing.
  get playerZone(): Zone {
    return this.zone;
  }

  dispose() {
    this.disposed = true;
    this.unsubChoice();
    this.unsubSky();
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.people.dispose();
    this.wild.dispose();
    this.sky.dispose();
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
    this.boards.dispose();
    this.popup = null;
    this.personPopup = null;
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
      if (!this.playing) this.controls.maxDistance = this.worldView().radius * 1.3;
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
      const { lot, spec } = specForPlot(me.plot, progressOf(me));
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
    const c = buildCountry(this.ext, this.maxTown, this.lowPower);
    this.gap = canopyGap(this.ext, this.lowPower);
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
    this.sky.setFarLights(f.lights);
  }

  // The jungle next to the town drawn in detail: its trail, clearing, gate sign and fireflies.
  private rebuildJungle() {
    const key = `${this.active}|${this.gap.toFixed(3)}|${this.maxTown}`;
    if (key === this.jungleKey) return;
    this.jungleKey = key;
    const j = buildJungle(this.active, this.lowPower, this.ext, this.gap);
    this.jungleMesh.geometry.dispose();
    this.jungleMesh.geometry = j.geo;
    this.jungle = j;
    for (const o of [...this.jungleSign.children]) {
      (o as THREE.Mesh).geometry.dispose();
      o.removeFromParent();
    }
    for (const m of this.jungleSignMats) {
      m.map?.dispose();
      m.dispose();
    }
    this.jungleSignMats = [];
    for (const side of ["town", "jungle"] as const) {
      const map = gateSignTex(this.active, FONT, side);
      const mat = new THREE.MeshLambertMaterial({ map, emissive: "#FFFFFF", emissiveMap: map, emissiveIntensity: 0 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.42), mat);
      sign.position.set(j.sign.x + (side === "town" ? -0.09 : 0.09), j.sign.y, j.sign.z);
      sign.rotation.y = side === "town" ? -Math.PI / 2 : Math.PI / 2;
      this.jungleSign.add(sign);
      this.jungleSignMats.push(mat);
    }
    this.sky.setFireflies(j.flies);
  }

  private rebuildTown() {
    if (!this.active) return;
    this.wake();
    const plots = this.towns.get(this.active) ?? new Map<number, House>();
    const mine = this.me && townOf(this.me.plot) === this.active ? this.me.plot : null;
    const prev = this.built;
    const built = buildTown(this.active, plots, mine, this.focus?.n ?? this.next(), this.lowPower, nowSec());
    this.built = built;
    this.city.geometry = built.city;
    this.dash.geometry = built.dash;
    this.xw.geometry = built.xw;
    this.xwFar.geometry = built.xwFar;
    if (prev) for (const g of [prev.city, prev.dash, prev.xw, prev.xwFar]) g.dispose();
    this.boxes = built.houses.map((hit) => ({ hit, box: new THREE.Box3(hit.min, hit.max) }));
    this.hovered = null;
    this.boards.invalidate();
    this.rebuildJungle();
    this.sky.setLamps([...built.lamps, ...(this.jungle?.lamps ?? [])]);
    this.wild.setTown(this.active);
    this.people.setTown(this.active, plots);
    if (this.personSel && !this.people.info(this.personSel)) this.selectPerson(null);
    // Keep the tapped house's card open if it's still in this town.
    const sel = this.selectedPlot ? (this.boxes.find((b) => b.hit.n === this.selectedPlot)?.hit ?? null) : null;
    const changed = sel !== this.selected;
    this.selected = sel;
    if (!sel) this.selectedPlot = 0;
    if (changed) this.emitSelect();
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

    // The crane stays until the house is finished.
    this.mast.visible = this.craneTop.visible = o.spec.stage < 3;
    if (o.spec.stage < 3) {
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
    }

    const [sx, sz] = rot(-3.4, o.spec.d / 2 + 2.6, o.lot.rot);
    this.ownSign.position.set(o.lot.x + sx, Y0, o.lot.z + sz);
    this.ownSign.rotation.y = o.lot.rot + 0.25;
    this.ownSign.scale.setScalar(1.25);
    this.drawOwnSign();
  }

  // Your big sign: how far your house is, your name, and when it's done. Redrawn now and then.
  private drawOwnSign() {
    const o = this.built?.own;
    const me = this.me;
    if (!o || !me) return;
    this.ownSignAt = performance.now();
    const now = nowSec();
    const p = progressOf(me, now);
    const name = `@${me.username}`;
    const nameLine: [string, number] = [name, name.length > 16 ? 56 : 72];
    const where = `HOUSE #${fmt(o.n)} · ${site.townName(o.lot.town).toUpperCase()}`;
    this.ownSignMat.map?.dispose();
    this.ownSignMat.map =
      p >= 1
        ? boardTex([["MOVE-IN READY", 96], nameLine, [where, 50]])
        : boardTex(
            [
              [`BEING BUILT · ${percentText(p)}`, 84],
              nameLine,
              [`${timeLeftText(me.done, now).toUpperCase()} · ${where}`, 40],
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
      this.towns.set(v.town, houseMap(v.plots));
      if (v.last !== this.view.last || v.next !== this.view.next || v.open !== this.view.open) {
        this.view = { ...this.view, houses: v.houses, last: v.last, next: v.next, open: v.open, towns: v.towns };
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

  // The town whose jungle trail or clearing is under a point (0 if none).
  private jungleTownAt(x: number, z: number) {
    const gx = Math.round((x - JUNGLE.cx) / 1000);
    const gz = Math.round((z - JUNGLE.cz) / 800);
    const t = townAtCell(gx, gz);
    if (t < 1 || t > this.maxTown) return 0;
    const j = jungleOf(t);
    if (Math.hypot(x - j.cx, z - j.cz) < JUNGLE.r + 70) return t;
    return x > j.x0 - 4 && x < j.cx && Math.abs(z - j.tz) < 40 ? t : 0;
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
    return this.lotView(f.lot, f.own);
  }

  // big: frame a whole house with its crane (your own); otherwise a bit closer, for a plot or a
  // neighbour's house with its name board.
  private lotView(lot: Lot, big: boolean): View {
    const front = lot.rot === 0 ? 0 : Math.PI;
    const target = new THREE.Vector3(lot.x, Y0 + (big ? 3 : 1.5), lot.z);
    const radius = big ? (this.portrait() ? 74 : 80) : this.portrait() ? 64 : 70;
    const [ox, oz] = townCenter(lot.town);
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
    this.pickDist = Math.sqrt(bestD);
    return best;
  }

  private pickDist = Infinity; // how far along the ray the last picked house was

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
    const person = far ? null : this.people.pick(this.ray.ray);
    if (person && person.dist <= this.pickDist + 0.5) this.hovered = null;
    const lot = !this.hovered && !person && !far ? this.freeLotAt(e.clientX, e.clientY) : null;
    this.markLot(lot && lot.plot !== this.focus?.n ? lot : null);
    this.renderer.domElement.style.cursor =
      this.hovered || person || lot || (far && this.pickTown(e.clientX, e.clientY)) ? "pointer" : "";
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved >= 6 || performance.now() - d.t >= 450) return;
    this.wake();
    const far = this.camera.position.distanceTo(this.controls.target) > LABEL_D;
    // A tap on an animal makes it react (it has no card).
    if (!far) {
      this.setRay(e.clientX, e.clientY);
      if (this.wild.poke(this.ray.ray, this.camera.position, performance.now() / 1000)) return;
    }
    // A tap on a person or a house opens their card (the nearer one wins); anywhere else closes it.
    const hit = far ? null : this.pick(e.clientX, e.clientY);
    const person = far ? null : this.people.pick(this.ray.ray);
    if (person && (!hit || person.dist <= this.pickDist + 0.5)) {
      this.select(null);
      this.selectPerson(person.plot);
      return;
    }
    this.selectPerson(null);
    this.select(hit?.n ?? null);
    if (hit) return;
    if (far) {
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
    if (this.maxTown && !this.playing) this.controls.maxDistance = this.worldView().radius * 1.3;
  }

  // Shift the image right by half the covered strip so the focus sits centred in the open area.
  private applyInset() {
    const { width: w, height: h } = this;
    if (this.inset > 0.5) this.camera.setViewOffset(w, h, -this.inset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  // The tapped house's card sits above the house, kept on screen (clear of the header, the map
  // buttons and the page's card). --arrow-x tells it where to point its little arrow.
  private placePopup(d: number) {
    const el = this.popup;
    if (!el) return;
    const h = this.selected;
    const hide = () => {
      if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
    };
    if (!h || d > LABEL_D * 1.2) return hide();
    const v = this.tmp.set(h.lot.x, h.top + 0.8, h.lot.z).project(this.camera);
    if (v.z > 1 || v.z < -1) return hide();
    const px = ((v.x + 1) / 2) * this.width;
    const py = ((1 - v.y) / 2) * this.height;
    if (px < -40 || px > this.width + 40 || py < -40 || py > this.height + 40) return hide();
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    // No room above the house (common on phones): glide the view so the house sits lower, once
    // per tap, rather than covering the house with its own card.
    if (ht > 0 && py - ht - 16 < 60 && !this.flight && this.nudgedPlot !== h.n) {
      this.nudgedPlot = h.n;
      this.nudgeDown(h, Math.min(ht + 16 + 72, this.height - 96));
    }
    const minX = 8 + (this.insetGoal > 0.5 ? this.insetGoal : 0);
    const left = clamp(px - w / 2, minX, Math.max(minX, this.width - w - 8));
    const top = clamp(py - ht - 16, 60, Math.max(60, this.height - ht - 64));
    el.style.visibility = "visible";
    el.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    el.style.setProperty("--arrow-x", `${clamp(px - left, 18, w - 18).toFixed(1)}px`);
    el.dataset.arrow = Math.abs(top - (py - ht - 16)) < 2 ? "down" : "none";
  }

  // Move the view straight ahead (same zoom and angle) until the top of house h is at screen
  // height needY, found by trying positions on a copy of the camera.
  private nudgeDown(h: HouseHit, needY: number) {
    const target = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(target);
    const fwd = target.clone().sub(this.camera.position).setY(0);
    if (fwd.lengthSq() < 1e-6) return;
    fwd.normalize();
    const cam = this.camera.clone();
    const point = new THREE.Vector3(h.lot.x, h.top + 0.8, h.lot.z);
    const t = new THREE.Vector3();
    const yAt = (s: number) => {
      t.copy(target).addScaledVector(fwd, s);
      cam.position.copy(t).add(offset);
      cam.lookAt(t);
      cam.updateMatrixWorld();
      const v = point.clone().project(cam);
      return ((1 - v.y) / 2) * this.height;
    };
    let lo = 0;
    let hi = offset.length() * 0.8;
    if (yAt(hi) < needY) lo = hi;
    else
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (yAt(mid) < needY) lo = mid;
        else hi = mid;
      }
    const s = new THREE.Spherical().setFromVector3(offset);
    this.flyTo({ target: target.addScaledVector(fwd, hi), radius: s.radius, phi: s.phi, theta: s.theta }, 600);
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
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;

    // Your person walks (and the camera follows) before the controls settle the view.
    if (this.playWanted && !this.playing && !this.playStarting && this.people.hasPlayer()) void this.setPlay(true);
    this.followPlayer(dt);

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
    this.sky.dome.scale.setScalar((farPlane * 0.45) / SKY_R);
    this.sky.dome.position.copy(this.camera.position);
    // The sky, the light and the weather for this moment in India (also sets the fog).
    const skyChanging = this.sky.update(dt, now / 1000, this.camera, target, d, this.height, this.renderer.getPixelRatio());
    const night = this.sky.world.uNight.value;
    for (const m of this.jungleSignMats) m.emissiveIntensity = night * 0.55;
    const farView = d > 200;
    this.dash.visible = d < 520;
    this.xw.visible = !farView;
    this.xwFar.visible = farView;

    // The town under the camera: draw it in detail once you've settled over it. Over a town's
    // jungle trail or clearing (which can sit closer to the next town), that town stays.
    if (this.view) {
      const t = this.jungleTownAt(target.x, target.z) || townAtPoint(target.x, target.z);
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
    const key = this.sky.keyDir;
    if (this.lDir.distanceToSquared(key) > 1e-8) {
      this.lDir.copy(key);
      this.lRot.lookAt(ORIGIN, this.tmp.copy(key).negate(), UP);
      this.lInv.copy(this.lRot).invert();
    }
    const sv = this.tmp.set(target.x, 0, target.z).applyMatrix4(this.lInv);
    sv.x = Math.round(sv.x / texel) * texel;
    sv.y = Math.round(sv.y / texel) * texel;
    sv.applyMatrix4(this.lRot);
    this.sun.target.position.copy(sv);
    this.sun.position.set(sv.x + key.x * 1000, sv.y + key.y * 1000, sv.z + key.z * 1000);
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
    if (camMoved || skyChanging || this.flight || this.revealStart >= 0 || Math.abs(this.insetGoal - this.inset) > 0.5) this.idle = 0;
    else this.idle++;
    if (this.lowPower) {
      if (this.idle % 2 === 1) return;
      this.renderer.shadowMap.needsUpdate = this.idle === 0 || this.idle % 16 === 0;
    }

    const secs = now / 1000;
    const moved = this.playing && !this.flight ? this.unblockCamera() : false;

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
      const myP = f.own && this.me ? progressOf(this.me) : 0;
      const sub = this.compact
        ? ""
        : f.own
          ? myP >= 1
            ? `Move-in ready · ${site.townName(f.lot.town)}`
            : `${percentText(myP)} built · ${timeLeftText(this.me?.done ?? 0)}`
          : `${site.townName(f.lot.town)} · ${getChosenPlot() === f.n ? "your pick" : "available"}`;
      setTagText(this.focusTag, `@${who} · ${house}`, sub);
      // Fade it out as the camera pulls up into the world view, so town labels take over.
      const op = clamp(1 - (d - LABEL_D * 1.6) / 600, 0, 1);
      this.placeTag(this.focusTag, f.lot.x, baseY + bob + PIN_HEIGHT + 0.8, f.lot.z, true, op);
    }

    // Name tag over the house under the mouse (the tapped house has its card instead).
    const h = this.hovered && this.hovered !== this.selected ? this.hovered : null;
    const showHover = Boolean(h && (!f?.own || h.n !== f.n) && d < LABEL_D);
    if (h && showHover) setTagText(this.hoverTag, `@${h.name} · #${fmt(h.n)}`);
    this.placeTag(this.hoverTag, h?.lot.x ?? 0, (h?.top ?? 0) + 1.2, h?.lot.z ?? 0, showHover);

    // The tapped house's card, kept above the house and inside the free part of the screen.
    this.placePopup(d);

    // The people: everyone's pose for this moment, their tags, and the tapped person's card.
    const pdt = this.peopleAt ? Math.min(0.1, (now - this.peopleAt) / 1000) : 1 / 60;
    this.peopleAt = now;
    this.people.update(pdt, this.camera, target, d, this.width, this.height, this.compact);
    this.placePersonPopup(d);

    // The jungle's animals (they keep away from your person while you play), and where you are.
    const player = this.playing ? this.people.playerPos(this.playerAt) : null;
    this.wild.update(pdt, this.people.now(), this.camera, target, d, player, night, this.width, this.height);
    const zone = player ? zoneAt(this.active, player.x, player.z) : "town";
    if (zone !== this.zone) {
      this.zone = zone;
      if (player) this.opts.onZone?.(zone);
    }
    if (this.personSel && now - this.personEmitAt > 1000) this.emitPerson();

    // Message bubbles over neighbours' houses.
    for (const [plot, b] of this.bubbles) {
      const hit = this.boxes.find((x) => x.hit.n === plot)?.hit;
      const left = b.until - now;
      if (!hit || left <= 0) {
        b.tag.el.remove();
        this.bubbles.delete(plot);
        continue;
      }
      const op = Math.min(1, left / 600) * clamp(1 - (d - LABEL_D) / 300, 0, 1);
      this.placeTag(b.tag, hit.lot.x, hit.top + (this.selected?.n === plot ? 1.2 : 2.6), hit.lot.z, true, op);
    }
    if (this.bubbles.size) this.idle = 0;

    // Writing on the name boards near the camera; your own sign is refreshed once a minute.
    this.boards.update(this.built?.houses ?? [], this.camera.position, target, d, now);
    if (this.built?.own && now - this.ownSignAt > 60_000) this.drawOwnSign();

    // Town labels when zoomed out.
    const labelOp = clamp((d - LABEL_D) / 350, 0, 1);
    for (const { t, tag } of this.townTags) {
      const [x, z] = townCenter(t);
      this.placeTag(tag, x, 60, z, labelOp > 0, labelOp);
    }

    this.renderer.render(this.scene, this.camera);
    if (moved) {
      this.camera.position.copy(this.camSaved);
      this.camera.updateMatrixWorld();
    }
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
