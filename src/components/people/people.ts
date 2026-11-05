// The people of the town drawn in detail: everyone who owns a house there, each with their own
// look. Their owners can walk them around (play mode); everyone else lives their life on the
// event list from the database (timeline.ts), and people being played by someone else move as that
// player's screen tells us (Supabase Realtime, src/lib/game-live.ts).
// The nearest people get a full animated body; the rest of the town is drawn as simple shapes.
// The tags over their heads show their @username, income and job (everyone's waiting for one).
import * as THREE from "three";
import { incomeText, jobText, type GameEvent } from "@/lib/game";
import type { TownFeed } from "@/lib/game-api";
import type { LiveLink, LiveState } from "@/lib/game-live";
import type { House } from "@/lib/world";
import { Builder, C, T } from "../land/geo";
import { jungleObstacles, walkClamp } from "../land/jungle";
import { townCenter } from "../land/layout";
import { decodeLook, lookForPlot, type Look } from "./look";
import { KIOSK, groundY, homeOf, obstaclesOf, type Home, type Obstacle } from "./nav";
import { actCode, actOf, buildRig, disposeRig, poseRig, type Act, type Anim, type Gait, type Rig } from "./rig";
import { evalPose, newPose, plansFor, type Plan, type PlanContext, type Pose } from "./timeline";

type Remote = { x: number; z: number; r: number; g: number; a: number; s: number; at: number; rx: number; rz: number; rr: number; dist: number };

type Person = {
  plot: number;
  house: House;
  look: Look;
  home: Home;
  plans: Plan[];
  sig: string; // the events the plans were made from
  pose: Pose;
  rig: Rig | null;
  remote: Remote | null;
  handoff: { x: number; z: number } | null; // walking back from where a player left them
  d2: number; // squared distance to the camera's target
  shown: boolean;
};

type Label = { el: HTMLDivElement; name: HTMLSpanElement; money: HTMLSpanElement; doing: HTMLSpanElement; plot: number };

export type Near = { plot: number; username: string } | null;

export type PeopleOptions = {
  scene: THREE.Scene;
  labels: HTMLElement;
  font: string;
  lowPower: boolean;
  fetchFeed: (town: number) => Promise<TownFeed | null>;
  link: LiveLink | null;
  onNear?: (n: Near) => void;
};

// What the map's card shows about a person.
export type PersonInfo = {
  plot: number;
  username: string;
  look: Look;
  age: number;
  trait: string;
  job: string | null;
  income: number;
  doing: string;
  online: boolean;
  mine: boolean;
};

const MAX_EVENT_AGE = 20 * 60;
const FEED_EVERY = 40_000;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const angleTo = (from: number, to: number, k: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
};

const blobTex = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(0,0,0,0.42)");
  rg.addColorStop(0.6, "rgba(0,0,0,0.2)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// The Job Centre in the plaza: a booth with a sign, where everyone queues for the jobs to come.
const kioskSignTex = (font: string) => {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 192;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#1F5FA8";
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = "#F7C631";
  g.fillRect(0, 150, 512, 42);
  g.fillStyle = "#FFFFFF";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 78px ${font}`;
  g.fillText("JOB CENTRE", 256, 78, 480);
  g.fillStyle = "#2A2A2A";
  g.font = `900 30px ${font}`;
  g.fillText("JOBS OPENING SOON · QUEUE HERE", 256, 172, 490);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

const kioskGeo = () => {
  const b = new Builder();
  const { hx, hz, h } = KIOSK;
  b.add(T.box, 0, 0.5 + 0.06, 0, hx * 2, 0.12, hz * 2, 0, C("#CFC6B5"));
  b.add(T.box, 0, 0.6 + h / 2, -0.15, hx * 2 - 0.2, h, hz * 2 - 0.5, 0, C("#F4EEE2"));
  b.add(T.box, 0, 0.6 + h + 0.18, 0, hx * 2 + 0.5, 0.36, hz * 2 + 0.4, 0, C("#1F5FA8"));
  // Counter window on the front (+z), with a little awning.
  b.add(T.box, 0, 0.6 + 1.55, hz - 0.38, hx * 1.3, 1.1, 0.05, 0, C("#A9C3D3"));
  b.add(T.box, 0, 0.6 + 1.0, hz - 0.2, hx * 1.5, 0.12, 0.5, 0, C("#9A6A43"));
  b.addE(T.box, 0, 0.6 + 2.3, hz + 0.1, hx * 1.6, 0.08, 0.8, 0.3, 0, 0, C("#F7C631"));
  // Queue posts and a rope along the first line.
  for (let k = 0; k <= 5; k++) {
    const x = -0.2 - k * 1.9;
    b.add(T.cyl, x, 0.5 + 0.5, hz + 2.3, 0.05, 1.0, 0.05, 0, C("#C9A43A"));
    if (k < 5) b.add(T.box, x - 0.95, 0.5 + 0.92, hz + 2.3, 1.9, 0.05, 0.05, 0, C("#B23A48"));
  }
  // The sign on the roof: two posts and a frame (the writing goes on both faces).
  for (const s of [-1, 1]) b.add(T.box, s * (hx - 0.5), 0.6 + h + 0.55, 0, 0.12, 0.5, 0.12, 0, C("#2A2A2A"));
  b.add(T.box, 0, SIGN_Y, 0, hx * 2 - 0.05, 1.18, 0.08, 0, C("#1F2226"));
  return b.geometry();
};

const SIGN_Y = 0.6 + KIOSK.h + 1.35;

// Simple shapes for people further away: legs, body, head, and a soft shadow under everyone.
const farShapes = () => ({
  legs: new THREE.BoxGeometry(0.3, 0.88, 0.2).translate(0, 0.44, 0),
  body: new THREE.BoxGeometry(0.42, 0.62, 0.24).translate(0, 1.2, 0),
  head: new THREE.BoxGeometry(0.2, 0.25, 0.22).translate(0, 1.65, 0),
});

export class People {
  readonly group = new THREE.Group();
  private o: PeopleOptions;
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private farMat = new THREE.MeshLambertMaterial({ color: "#FFFFFF" });
  private shapes = farShapes();
  private cap = 1000;
  private farLegs: THREE.InstancedMesh;
  private farBody: THREE.InstancedMesh;
  private farHead: THREE.InstancedMesh;
  private blobs: THREE.InstancedMesh;
  private blobMat: THREE.MeshBasicMaterial;
  private kiosk: THREE.Group | null = null;
  private kioskSign: THREE.MeshBasicMaterial | null = null;

  private town = 0;
  private persons = new Map<number, Person>();
  private list: Person[] = [];
  private events = new Map<number, GameEvent>();
  private faceTo = new Map<number, { x: number; z: number }>(); // live events: where the player stood
  private boxes: { x: number; z: number; hx: number; hz: number }[] = [];
  private obstacles: Obstacle[] = [];
  private online = new Set<number>();

  private owner: number | null = null; // the signed-in player's house
  private controlled = false; // in the game: the owner's person follows the owner, not the event list
  private player: {
    x: number;
    z: number;
    ry: number;
    vx: number;
    vz: number;
    dist: number;
    act: Act;
    actAt: number; // server seconds
    actDur: number;
    lockUntil: number;
    side: number;
  } | null = null;
  private lastSent = 0;
  private sendSoon = false; // just stopped or started something: tell the others at once
  private nearPlot: number | null = null;
  private nearAt = 0;

  private rigs: Rig[] = [];
  private rigCache = new Map<number, Rig>();
  private maxRigs: number;
  private labelPool: Label[] = [];
  private maxLabels = 12;
  private lodAt = 0;
  private feedAt = -Infinity;
  private feedBusy = false;
  private offset = 0; // server clock - local clock, seconds
  private rtt = Infinity;
  private frame = 0;
  private unsub: (() => void)[] = [];
  private tmp = new THREE.Vector3();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private box3 = new THREE.Box3();
  private anim: Anim = { gait: 0, phase: 0, act: "none", actT: 0, actDur: 0, t: 0, seed: 0, side: 0 };
  private disposed = false;

  constructor(o: PeopleOptions) {
    this.o = o;
    this.maxRigs = o.lowPower ? 34 : 80;
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, mat, this.cap);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
      return m;
    };
    this.farLegs = inst(this.shapes.legs, this.farMat);
    this.farBody = inst(this.shapes.body, this.farMat);
    this.farHead = inst(this.shapes.head, this.farMat);
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
    this.blobs = inst(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), this.blobMat);
    this.blobs.renderOrder = 1;
    for (const m of [this.farLegs, this.farBody, this.farHead]) m.receiveShadow = true;
    o.scene.add(this.group);
    if (o.link) {
      this.unsub.push(o.link.onState((s) => this.onRemote(s)));
      this.unsub.push(o.link.onEvent((e) => this.addEvents([e], true)));
    }
  }

  // ---------- data ----------

  // The server's clock now (Unix seconds). Everyone's timeline runs on it.
  now() {
    return Date.now() / 1000 + this.offset;
  }

  // A server time seen with a request that took rttMs; the quickest request sets the clock.
  syncClock(serverNow: number, rttMs = 300) {
    const rtt = Math.max(1, rttMs);
    if (rtt > this.rtt * 1.5 && this.rtt < Infinity) return;
    this.rtt = Math.min(this.rtt, rtt);
    this.offset = serverNow - (Date.now() - rtt / 2) / 1000;
  }

  // The town drawn in detail changed (or its houses did).
  setTown(town: number, houses: ReadonlyMap<number, House>) {
    const changed = town !== this.town;
    if (changed) {
      for (const p of this.persons.values()) this.dropRig(p);
      this.persons.clear();
      this.events.clear();
      this.faceTo.clear();
      this.online.clear();
      this.player = null;
      this.town = town;
      this.feedAt = -Infinity;
      this.obstacles = [...obstaclesOf(town), ...jungleObstacles(town)];
      this.buildKiosk();
      if (this.o.link && this.owner) this.o.link.join(town);
    }
    const seen = new Set<number>();
    for (const h of houses.values()) {
      seen.add(h.plot);
      const p = this.persons.get(h.plot);
      if (p) {
        p.house = h;
        if (h.online) this.online.add(h.plot);
        continue;
      }
      const look = decodeLook(h.look >= 0 ? h.look : lookForPlot(h.plot));
      this.persons.set(h.plot, {
        plot: h.plot,
        house: h,
        look,
        home: homeOf(h.plot),
        plans: [],
        sig: "",
        pose: newPose(),
        rig: null,
        remote: null,
        handoff: null,
        d2: Infinity,
        shown: false,
      });
      if (h.online) this.online.add(h.plot);
    }
    for (const [plot, p] of this.persons) {
      if (seen.has(plot)) continue;
      this.dropRig(p);
      this.persons.delete(plot);
    }
    this.list = [...this.persons.values()];
    this.boxes = this.list.map((p) => p.home.box);
    this.replan();
  }

  // The signed-in player (null: a visitor). controlled: they're in the game, so their person is
  // theirs to walk around.
  setOwner(plot: number | null, controlled: boolean) {
    const was = this.owner;
    this.owner = plot;
    this.controlled = controlled && plot !== null;
    if (!this.controlled) this.player = null;
    if (this.o.link && plot && !was && this.town) this.o.link.join(this.town);
    if (this.o.link && !plot && was) this.o.link.leave();
  }

  // New events (from the town feed, a player's own action, or another player's screen).
  addEvents(list: GameEvent[], fromPeer = false) {
    let any = false;
    for (const e of list) {
      if (fromPeer && this.events.has(e.id)) continue;
      if (fromPeer && this.persons.has(e.actor)) {
        const p = this.persons.get(e.actor);
        if (p) this.faceTo.set(e.id, { x: p.pose.x, z: p.pose.z });
      }
      if (e.live && e.actor === this.owner && this.player) this.faceTo.set(e.id, { x: this.player.x, z: this.player.z });
      this.events.set(e.id, e);
      any = true;
      // Someone else's screen says your person was hit or robbed: react.
      if (fromPeer && e.target === this.owner && this.player) {
        const fell = e.kind === "fight" && e.winner !== this.owner;
        this.player.act = e.kind === "fight" ? (fell ? "fall" : "flinch") : "flinch";
        this.player.actAt = this.now();
        this.player.actDur = fell ? 3 : 1.2;
        this.player.lockUntil = this.now() + (fell ? 3 : 0.6);
      }
    }
    if (any) this.replan();
  }

  private async pollFeed() {
    if (this.feedBusy || !this.town) return;
    this.feedBusy = true;
    const town = this.town;
    const t0 = Date.now();
    const feed = await this.o.fetchFeed(town).catch(() => null);
    this.feedBusy = false;
    if (this.disposed || !feed || town !== this.town) return;
    this.syncClock(feed.now, Date.now() - t0);
    // The feed is the truth for its window: drop events it no longer has (called off), keep newer
    // live ones it hasn't caught up with.
    const ids = new Set(feed.events.map((e) => e.id));
    const now = this.now();
    for (const [id, e] of this.events) if (!ids.has(id) && !(e.live && now - e.at < 60)) this.events.delete(id);
    for (const e of feed.events) this.events.set(e.id, e);
    this.online = new Set(feed.online);
    this.replan();
  }

  // Rebuilds the plans of everyone whose events changed.
  private replan() {
    const now = this.now();
    const byPerson = new Map<number, GameEvent[]>();
    const queue: GameEvent[] = [];
    for (const [id, e] of this.events) {
      if (e.at + e.dur + MAX_EVENT_AGE < now) {
        this.events.delete(id);
        this.faceTo.delete(id);
        continue;
      }
      for (const who of [e.actor, e.target]) {
        if (who === null || !this.persons.has(who)) continue;
        let l = byPerson.get(who);
        if (!l) byPerson.set(who, (l = []));
        l.push(e);
      }
      if (e.kind === "task" && e.detail === "jobqueue") queue.push(e);
    }
    queue.sort((a, b) => a.at - b.at || a.id - b.id);
    // Places in the Job Centre queue: each newcomer takes the first place nobody's standing in.
    const slots = new Map<number, number>();
    const standing: { end: number; slot: number }[] = [];
    for (const q of queue) {
      for (let i = standing.length - 1; i >= 0; i--) if (standing[i].end <= q.at) standing.splice(i, 1);
      let k = 0;
      while (standing.some((s) => s.slot === k)) k++;
      slots.set(q.id, k);
      standing.push({ end: q.at + q.dur, slot: k });
    }
    const ctx: PlanContext = {
      name: (plot) => {
        const p = this.persons.get(plot);
        return p ? `@${p.house.username}` : "a neighbour";
      },
      queueIndex: (ev) => slots.get(ev.id) ?? 0,
      basePose: (plot, t) => {
        const p = this.persons.get(plot);
        const out = newPose();
        return p ? evalPose(plot, p.plans.filter((x) => !this.events.get(x.id)?.live), t, out) : out;
      },
    };
    for (const p of this.list) {
      const evs = (byPerson.get(p.plot) ?? []).sort((a, b) => a.at - b.at || a.id - b.id);
      const sig = evs.map((e) => e.id).join(",");
      if (sig === p.sig) continue;
      p.sig = sig;
      const keep = new Map(p.plans.map((x) => [x.id, x]));
      const plans: Plan[] = [];
      for (const e of evs) {
        const old = keep.get(e.id);
        const plan = old ?? plansFor(p.plot, e, ctx, this.faceTo.get(e.id) ?? null);
        if (plan) plans.push(plan);
      }
      p.plans = plans.sort((a, b) => a.t0 - b.t0);
    }
  }

  // ---------- players ----------

  private onRemote(s: LiveState) {
    if (s.p === this.owner) return;
    const p = this.persons.get(s.p);
    if (!p) return;
    const [x, z] = walkClamp(this.town, s.x, s.z);
    const r = p.remote;
    if (r) Object.assign(r, { x, z, r: s.r, g: s.g, a: s.a, s: s.s, at: performance.now() });
    else p.remote = { x, z, r: s.r, g: s.g, a: s.a, s: s.s, at: performance.now(), rx: p.pose.x, rz: p.pose.z, rr: p.pose.ry, dist: 0 };
    p.handoff = null;
    this.online.add(s.p);
  }

  // Where your person is (null if they aren't in the town drawn).
  playerPos(out: THREE.Vector3): THREE.Vector3 | null {
    const pl = this.player;
    if (!pl) return null;
    return out.set(pl.x, groundY(this.town, pl.x, pl.z), pl.z);
  }

  playerFacing() {
    return this.player?.ry ?? 0;
  }

  hasPlayer() {
    return this.player !== null;
  }

  // Your person does something (after the database decided how a fight or theft went).
  playAct(kind: "fight" | "steal" | "wave", ev: GameEvent | null) {
    const pl = this.player;
    if (!pl) return;
    const now = this.now();
    if (kind === "wave") {
      pl.act = "wave";
      pl.actDur = 2.4;
    } else if (kind === "fight") {
      pl.act = "fight";
      pl.actDur = 4;
      pl.side = 0;
    } else {
      pl.act = "grab";
      pl.actDur = 2;
    }
    pl.actAt = now;
    pl.lockUntil = now + pl.actDur;
    if (ev && this.persons.has(ev.target ?? -1)) {
      const target = this.persons.get(ev.target as number)!;
      pl.ry = Math.atan2(target.pose.x - pl.x, target.pose.z - pl.z);
      this.addEvents([ev]);
      this.o.link?.sendEvent(ev);
      if (kind === "fight") {
        // After the punches: cheer, or end up on the ground.
        const won = ev.winner === this.owner;
        window.setTimeout(() => {
          if (!this.player) return;
          this.player.act = won ? "cheer" : "fall";
          this.player.actAt = this.now();
          this.player.actDur = won ? 2.5 : 4;
          this.player.lockUntil = this.now() + this.player.actDur;
        }, 4000);
      }
    }
    this.sendSoon = true;
  }

  // Your person jumps somewhere (the jungle gate, back home), facing ry.
  teleportPlayer(x: number, z: number, ry: number) {
    const pl = this.player;
    if (!pl) return;
    pl.x = x;
    pl.z = z;
    pl.ry = ry;
    pl.vx = pl.vz = 0;
    this.sendSoon = true;
  }

  // Bump into houses, the plaza's things, the jungle's rocks and waterhole, and the edge of the
  // walkable land (town, trail, clearing).
  private collide(x: number, z: number): [number, number] {
    const push = (bx: number, bz: number, hx: number, hz: number) => {
      const dx = x - bx;
      const dz = z - bz;
      if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) return;
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) x = bx + Math.sign(dx || 1) * hx;
      else z = bz + Math.sign(dz || 1) * hz;
    };
    for (const b of this.boxes) {
      if (Math.abs(x - b.x) > 8 || Math.abs(z - b.z) > 8) continue;
      push(b.x, b.z, b.hx, b.hz);
    }
    for (const ob of this.obstacles) {
      if ("rx" in ob) {
        const dx = (x - ob.x) / ob.rx;
        const dz = (z - ob.z) / ob.rz;
        const dd = Math.hypot(dx, dz);
        if (dd < 1) {
          const k = 1 / Math.max(1e-4, dd);
          x = ob.x + (dd < 1e-4 ? ob.rx : dx * k * ob.rx);
          z = ob.z + (dd < 1e-4 ? 0 : dz * k * ob.rz);
        }
      } else if ("r" in ob) {
        const dx = x - ob.x;
        const dz = z - ob.z;
        const dd = Math.hypot(dx, dz);
        if (dd < ob.r) {
          const k = ob.r / Math.max(1e-4, dd);
          x = ob.x + (dd < 1e-4 ? ob.r : dx * k);
          z = ob.z + (dd < 1e-4 ? 0 : dz * k);
        }
      } else push(ob.x, ob.z, ob.hx, ob.hz);
    }
    return walkClamp(this.town, x, z);
  }

  // Moves your person by the controls (dir: world direction, length up to 1). Returns how far.
  stepPlayer(dt: number, dir: { x: number; z: number } | null, run: boolean, delta: THREE.Vector3) {
    delta.set(0, 0, 0);
    const pl = this.player;
    if (!pl) return delta;
    const now = this.now();
    const locked = now < pl.lockUntil;
    const want = locked || !dir ? 0 : Math.min(1, Math.hypot(dir.x, dir.z));
    const speed = run ? 4.6 : 1.8;
    const tx = want ? (dir!.x / Math.max(1e-6, Math.hypot(dir!.x, dir!.z))) * want * speed : 0;
    const tz = want ? (dir!.z / Math.max(1e-6, Math.hypot(dir!.x, dir!.z))) * want * speed : 0;
    const k = Math.min(1, dt * 9);
    pl.vx += (tx - pl.vx) * k;
    pl.vz += (tz - pl.vz) * k;
    const sp = Math.hypot(pl.vx, pl.vz);
    if (sp < 0.02) {
      pl.vx = pl.vz = 0;
      return delta;
    }
    const [nx, nz] = this.collide(pl.x + pl.vx * dt, pl.z + pl.vz * dt);
    delta.set(nx - pl.x, 0, nz - pl.z);
    pl.dist += Math.hypot(delta.x, delta.z);
    pl.x = nx;
    pl.z = nz;
    if (sp > 0.15) pl.ry = angleTo(pl.ry, Math.atan2(pl.vx, pl.vz), Math.min(1, dt * 12));
    if (pl.act !== "none" && pl.act !== "fall" && now > pl.actAt + 0.3 && sp > 0.5) pl.act = "none";
    return delta;
  }

  private playerPose(out: Pose) {
    const pl = this.player!;
    const now = this.now();
    const sp = Math.hypot(pl.vx, pl.vz);
    out.x = pl.x;
    out.z = pl.z;
    out.ry = pl.ry;
    out.gait = (sp > 3.2 ? 3 : sp > 0.25 ? 1 : 0) as Gait;
    out.dist = pl.dist;
    const s = now - pl.actAt;
    if (pl.act !== "none" && s <= pl.actDur) {
      out.act = pl.act;
      out.actT = pl.act === "fight" ? s + 1.3 : s;
      out.actDur = pl.actDur;
    } else {
      out.act = "none";
      out.actT = 0;
      out.actDur = 0;
      if (pl.act !== "none" && s > pl.actDur) pl.act = "none";
    }
    out.side = pl.side;
    out.label = "";
  }

  // ---------- frame ----------

  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    camDist: number,
    width: number,
    height: number,
    compact: boolean,
  ) {
    if (!this.town) return;
    this.frame++;
    const nowMs = performance.now();
    const t = this.now();
    const visible = camDist < 1900;
    this.group.visible = visible;
    if (visible && nowMs - this.feedAt > FEED_EVERY && document.visibilityState === "visible") {
      this.feedAt = nowMs;
      void this.pollFeed();
    }
    if (!visible) {
      this.hideLabels(0);
      return;
    }

    // Spawn your person where they are on their timeline, the moment you're in the game.
    if (this.controlled && this.owner && !this.player) {
      const p = this.persons.get(this.owner);
      if (p) {
        evalPose(p.plot, p.plans, t, p.pose);
        this.player = { x: p.pose.x, z: p.pose.z, ry: p.pose.ry, vx: 0, vz: 0, dist: 0, act: "none", actAt: 0, actDur: 0, lockUntil: 0, side: 0 };
      }
    }

    // Poses: everyone near every frame, the far ones every third frame.
    const near = camDist < 700;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      const dx = p.pose.x - target.x;
      const dz = p.pose.z - target.z;
      p.d2 = dx * dx + dz * dz;
      if (!p.rig && (i + this.frame) % 3 !== 0 && p.shown) continue;
      this.poseOf(p, t, dt);
    }

    // Who gets a full body: the nearest people, a few times a second.
    if (nowMs - this.lodAt > 250) {
      this.lodAt = nowMs;
      const reach = near ? Math.max(90, camDist * 1.1) : 0;
      const want = this.list
        .filter((p) => p.d2 < reach * reach || p.plot === this.owner)
        .sort((a, b) => a.d2 - b.d2)
        .slice(0, near ? this.maxRigs : 0);
      const keep = new Set(want.map((p) => p.plot));
      for (const p of this.list) if (p.rig && !keep.has(p.plot)) this.dropRig(p);
      let built = 0;
      for (const p of want) {
        if (p.rig) continue;
        if (built >= 6) break;
        this.giveRig(p);
        built++;
      }
    }

    // Draw: full bodies, simple shapes, shadows.
    let nf = 0;
    let nb = 0;
    for (const p of this.list) {
      const y = groundY(this.town, p.pose.x, p.pose.z);
      p.shown = true;
      if (p.rig) {
        const r = p.rig;
        r.mesh.position.set(p.pose.x, y, p.pose.z);
        r.mesh.rotation.y = p.pose.ry;
        const a = this.anim;
        a.gait = p.pose.gait;
        a.phase = p.pose.dist / (p.pose.gait >= 2 ? 2.2 : 1.45);
        a.act = p.pose.act;
        a.actT = p.pose.actT;
        a.actDur = p.pose.actDur;
        a.t = t;
        a.seed = (p.plot % 97) / 13;
        a.side = p.pose.side;
        poseRig(r, a);
      } else if (nf < this.cap) {
        const sc = p.look.height / 1.75;
        this.q.setFromAxisAngle(this.tmp.set(0, 1, 0), p.pose.ry);
        this.m4.compose(this.tmp.set(p.pose.x, y, p.pose.z), this.q, this.s.set(1, sc, 1));
        this.farLegs.setMatrixAt(nf, this.m4);
        this.farBody.setMatrixAt(nf, this.m4);
        this.farHead.setMatrixAt(nf, this.m4);
        this.farLegs.setColorAt(nf, this.col.set(p.look.bottomColor));
        this.farBody.setColorAt(nf, this.col.set(p.look.topColor));
        this.farHead.setColorAt(nf, this.col.set(p.look.hair === "buzz" ? p.look.skin : p.look.hairColor));
        nf++;
      }
      if (nb < this.cap && p.pose.act !== "fall") {
        this.m4.makeTranslation(p.pose.x, y + 0.03, p.pose.z);
        this.blobs.setMatrixAt(nb++, this.m4);
      }
    }
    for (const m of [this.farLegs, this.farBody, this.farHead]) {
      m.count = nf;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.blobs.count = nb;
    this.blobs.instanceMatrix.needsUpdate = true;

    this.placeLabels(camera, camDist, width, height, compact);
    this.share(t);
    this.checkNear(nowMs);
  }

  private poseOf(p: Person, t: number, dt: number) {
    if (this.controlled && p.plot === this.owner && this.player) return this.playerPose(p.pose);
    const r = p.remote;
    if (r) {
      if (performance.now() - r.at > 9000) {
        // The player left: walk back from where they were.
        p.remote = null;
        p.handoff = { x: r.rx, z: r.rz };
      } else {
        const k = Math.min(1, dt * 7);
        const ox = r.rx;
        const oz = r.rz;
        r.rx += (r.x - r.rx) * k;
        r.rz += (r.z - r.rz) * k;
        r.rr = angleTo(r.rr, r.r, k);
        r.dist += Math.hypot(r.rx - ox, r.rz - oz);
        const o = p.pose;
        o.x = r.rx;
        o.z = r.rz;
        o.ry = r.rr;
        o.gait = (r.g === 3 ? 3 : r.g > 0 ? 1 : 0) as Gait;
        o.dist = r.dist;
        o.act = actOf(r.a);
        o.actT = Math.max(0, this.now() - r.s) + (o.act === "fight" ? 1.3 : 0);
        o.actDur = o.act === "fall" ? 4 : o.act === "fight" ? 4 : 2.5;
        o.side = 1;
        o.label = "";
        return;
      }
    }
    if (p.handoff) {
      const h = p.handoff;
      const goal = evalPose(p.plot, p.plans, t, newPose());
      const dx = goal.x - h.x;
      const dz = goal.z - h.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 0.4) p.handoff = null;
      else {
        const step = Math.min(dd, 1.4 * dt);
        h.x += (dx / dd) * step;
        h.z += (dz / dd) * step;
        const o = p.pose;
        o.x = h.x;
        o.z = h.z;
        o.ry = Math.atan2(dx, dz);
        o.gait = 1;
        o.dist += step;
        o.act = "none";
        o.label = "";
        return;
      }
    }
    evalPose(p.plot, p.plans, t, p.pose);
  }

  private giveRig(p: Person) {
    let rig = this.rigCache.get(p.plot);
    if (rig) this.rigCache.delete(p.plot);
    else rig = buildRig(p.look, this.mat, p.plot);
    this.group.add(rig.mesh);
    p.rig = rig;
    this.rigs.push(rig);
  }

  private dropRig(p: Person) {
    const r = p.rig;
    if (!r) return;
    p.rig = null;
    r.mesh.removeFromParent();
    this.rigs = this.rigs.filter((x) => x !== r);
    // Keep a few recent bodies, so walking back and forth doesn't rebuild them.
    this.rigCache.set(p.plot, r);
    if (this.rigCache.size > this.maxRigs) {
      const [first] = this.rigCache.keys();
      const old = this.rigCache.get(first);
      this.rigCache.delete(first);
      if (old) disposeRig(old);
    }
  }

  // ---------- tags over heads ----------

  private makeLabel(): Label {
    const el = document.createElement("div");
    el.style.cssText =
      "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity .18s ease;text-align:center;white-space:nowrap;";
    const pill = document.createElement("div");
    pill.style.cssText = `display:inline-block;background:rgba(24,27,32,.82);color:#fff;border-radius:10px;padding:4px 8px 5px;box-shadow:0 4px 12px rgba(0,0,0,.25);font:800 12px/1.15 ${this.o.font};`;
    const name = document.createElement("span");
    name.style.cssText = "display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;";
    const money = document.createElement("span");
    money.style.cssText = `display:block;margin-top:2px;font:800 10.5px/1.1 ${this.o.font};color:#F7C631;`;
    const doing = document.createElement("span");
    doing.style.cssText = `display:none;margin-top:2px;font:700 10px/1.1 ${this.o.font};color:rgba(255,255,255,.75);`;
    pill.append(name, money, doing);
    el.append(pill);
    this.o.labels.append(el);
    return { el, name, money, doing, plot: 0 };
  }

  private hideLabels(from: number) {
    for (let i = from; i < this.labelPool.length; i++) {
      const l = this.labelPool[i];
      if (l.el.style.opacity !== "0") l.el.style.opacity = "0";
      l.plot = 0;
    }
  }

  private placeLabels(camera: THREE.PerspectiveCamera, camDist: number, width: number, height: number, compact: boolean) {
    this.maxLabels = compact ? 6 : 12;
    if (camDist > 260) return this.hideLabels(0);
    const cam = camera.position;
    const reach = compact ? 55 : 75;
    const cands: { p: Person; d: number }[] = [];
    for (const p of this.list) {
      if (!p.rig) continue;
      const d = Math.hypot(p.pose.x - cam.x, p.pose.z - cam.z);
      if (d < reach || p.plot === this.owner) cands.push({ p, d: p.plot === this.owner ? -1 : d });
    }
    cands.sort((a, b) => a.d - b.d);
    const shown = cands.slice(0, this.maxLabels);
    while (this.labelPool.length < shown.length) this.labelPool.push(this.makeLabel());
    // Nearest first; a tag that would sit on top of a nearer one waits until there's room.
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    shown.forEach(({ p, d }, i) => {
      const l = this.labelPool[i];
      const mine = p.plot === this.owner;
      const name = `${mine ? "You · " : ""}@${p.house.username}`;
      if (l.name.textContent !== name) l.name.textContent = name;
      const money = `${incomeText(p.house.income)} · ${jobText(p.house.job)}`;
      if (l.money.textContent !== money) l.money.textContent = money;
      const doing = p.pose.label || (this.online.has(p.plot) && !mine ? "In the game now" : "");
      if (l.doing.textContent !== doing) {
        l.doing.textContent = doing;
        l.doing.style.display = doing ? "block" : "none";
      }
      const pill = l.el.firstElementChild as HTMLDivElement;
      const bg = mine ? "rgba(247,198,49,.95)" : "rgba(24,27,32,.82)";
      if (pill.style.background !== bg) {
        pill.style.background = bg;
        pill.style.color = mine ? "#2C2F34" : "#FFFFFF";
        l.money.style.color = mine ? "#7A4E00" : "#F7C631";
      }
      const r = p.rig!;
      const headY = groundY(this.town, p.pose.x, p.pose.z) + r.dims.H + (p.pose.act === "fall" ? -1.2 : p.pose.act.startsWith("sit") ? -0.35 : 0.32);
      const v = this.tmp.set(p.pose.x, headY, p.pose.z).project(camera);
      const fade = mine ? 1 : clamp(1 - (d - reach * 0.75) / (reach * 0.25), 0, 1);
      if (v.z > 1 || v.z < -1 || fade <= 0.01) {
        l.el.style.opacity = "0";
        return;
      }
      const px = ((v.x + 1) / 2) * width;
      const py = ((1 - v.y) / 2) * height;
      const w = l.el.offsetWidth || 150;
      const h = l.el.offsetHeight || 40;
      const rect = { x0: px - w / 2, x1: px + w / 2, y0: py - h, y1: py };
      const covered = placed.some((q) => {
        const ox = Math.min(rect.x1, q.x1) - Math.max(rect.x0, q.x0);
        const oy = Math.min(rect.y1, q.y1) - Math.max(rect.y0, q.y0);
        return ox > w * 0.25 && oy > h * 0.3;
      });
      if (covered && !mine) {
        l.el.style.opacity = "0";
        l.plot = 0;
        return;
      }
      placed.push(rect);
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
      l.plot = p.plot;
    });
    this.hideLabels(shown.length);
  }

  // ---------- sharing your moves ----------

  private share(t: number) {
    const link = this.o.link;
    const pl = this.player;
    if (!link || !pl || !this.owner) return;
    const now = performance.now();
    const sp = Math.hypot(pl.vx, pl.vz);
    const acting = pl.act !== "none";
    // 4 times a second while moving or doing something, otherwise every 3 s so others know you're here.
    const every = sp > 0.05 || acting || this.sendSoon ? 250 : 3000;
    if (now - this.lastSent < every) return;
    this.lastSent = now;
    this.sendSoon = false;
    link.send({
      p: this.owner,
      x: Math.round(pl.x * 100) / 100,
      z: Math.round(pl.z * 100) / 100,
      r: Math.round(pl.ry * 100) / 100,
      g: sp > 3.2 ? 3 : sp > 0.25 ? 1 : 0,
      a: acting ? actCode(pl.act) : 0,
      s: Math.round(pl.actAt * 100) / 100 || Math.round(t),
    });
  }

  // Someone within reach of your person (for the fight / steal / wave buttons).
  private checkNear(nowMs: number) {
    if (nowMs - this.nearAt < 200) return;
    this.nearAt = nowMs;
    const pl = this.player;
    let best: Person | null = null;
    if (pl) {
      let bd = 2.6;
      for (const p of this.list) {
        if (p.plot === this.owner) continue;
        const d = Math.hypot(p.pose.x - pl.x, p.pose.z - pl.z);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    const plot = best?.plot ?? null;
    if (plot === this.nearPlot) return;
    this.nearPlot = plot;
    this.o.onNear?.(best ? { plot: best.plot, username: best.house.username } : null);
  }

  // ---------- picking and cards ----------

  // The person under a ray, and how far along the ray.
  pick(ray: THREE.Ray): { plot: number; dist: number } | null {
    let best: { plot: number; dist: number } | null = null;
    const hit = this.tmp;
    for (const p of this.list) {
      if (!p.shown) continue;
      const y = groundY(this.town, p.pose.x, p.pose.z);
      const w = p.rig ? 0.5 : 0.9;
      const h = p.pose.act === "fall" ? 0.6 : p.look.height;
      this.box3.min.set(p.pose.x - w, y, p.pose.z - w);
      this.box3.max.set(p.pose.x + w, y + h + 0.2, p.pose.z + w);
      if (!ray.intersectBox(this.box3, hit)) continue;
      const d = hit.distanceTo(ray.origin);
      if (!best || d < best.dist) best = { plot: p.plot, dist: d };
    }
    return best;
  }

  // The point above someone's head (for their card), or null if they're not here.
  anchor(plot: number, out: THREE.Vector3): THREE.Vector3 | null {
    const p = this.persons.get(plot);
    if (!p) return null;
    return out.set(p.pose.x, groundY(this.town, p.pose.x, p.pose.z) + p.look.height + 0.5, p.pose.z);
  }

  info(plot: number): PersonInfo | null {
    const p = this.persons.get(plot);
    if (!p) return null;
    return {
      plot,
      username: p.house.username,
      look: p.look,
      age: p.house.age,
      trait: p.house.trait,
      job: p.house.job,
      income: p.house.income,
      doing: p.pose.label,
      online: this.online.has(plot) || p.remote !== null,
      mine: plot === this.owner,
    };
  }

  // ---------- the Job Centre ----------

  private buildKiosk() {
    if (this.kiosk) {
      this.kiosk.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      this.kiosk.removeFromParent();
    }
    const [ox, oz] = townCenter(this.town);
    const g = new THREE.Group();
    const body = new THREE.Mesh(kioskGeo(), this.mat);
    body.castShadow = !this.o.lowPower;
    body.receiveShadow = true;
    g.add(body);
    if (!this.kioskSign) this.kioskSign = new THREE.MeshBasicMaterial({ map: kioskSignTex(this.o.font) });
    for (const side of [1, -1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(KIOSK.hx * 2 - 0.2, 1.05), this.kioskSign);
      sign.position.set(0, SIGN_Y, side * 0.045);
      if (side < 0) sign.rotation.y = Math.PI;
      g.add(sign);
    }
    g.position.set(ox + KIOSK.x, 0, oz + KIOSK.z);
    this.group.add(g);
    this.kiosk = g;
  }

  dispose() {
    this.disposed = true;
    for (const u of this.unsub) u();
    this.o.link?.leave();
    for (const p of this.persons.values()) this.dropRig(p);
    for (const r of this.rigCache.values()) disposeRig(r);
    this.rigCache.clear();
    for (const l of this.labelPool) l.el.remove();
    for (const g of Object.values(this.shapes)) g.dispose();
    for (const m of [this.farLegs, this.farBody, this.farHead, this.blobs]) m.dispose();
    this.blobs.geometry.dispose();
    this.blobMat.map?.dispose();
    this.blobMat.dispose();
    this.kioskSign?.map?.dispose();
    this.kioskSign?.dispose();
    this.mat.dispose();
    this.farMat.dispose();
    this.group.removeFromParent();
  }

  // For debugging in the browser console.
  get stats() {
    return { people: this.list.length, rigs: this.rigs.length, events: this.events.size, offset: this.offset };
  }
}
