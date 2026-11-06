// Where someone is and what they're doing at any moment. Between things, people potter about in
// their front garden. For each thing they do (public.character_events: a chore, a trip to the Job
// Centre, a chat, a fight, a theft) they walk there, do it, and walk back home. Everything follows
// from the event list and the clock, with nothing random, so every screen shows the same person in
// the same place at the same time.
import { TASKS, type GameEvent } from "@/lib/game";
import {
  Path,
  blockLoop,
  homeOf,
  homeSpot,
  join,
  mailboxApproach,
  hospitalShift,
  oddJobSpot,
  parkSeat,
  plazaEntry,
  queueSpot,
  route,
  siteFor,
  toGate,
  type Home,
  type Pt,
} from "./nav";
import type { Act, Gait } from "./rig";

export type Pose = {
  x: number;
  z: number;
  ry: number;
  gait: Gait;
  dist: number; // metres walked, for the stride
  act: Act;
  actT: number;
  actDur: number;
  side: number;
  label: string; // what they're doing, in words ("" when they're just at home)
};

export const newPose = (): Pose => ({ x: 0, z: 0, ry: 0, gait: 0, dist: 0, act: "none", actT: 0, actDur: 0, side: 0, label: "" });

// A quick integer hash (no strings, so it's cheap every frame).
export const ih = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
};

// ---------- at home ----------

const SLOT = 22; // seconds at each spot in the garden
const IDLE_ACTS: Act[] = ["none", "phone", "look", "crossed", "none", "stretch", "phone", "look"];

// Pottering about the front garden: a spot every 22 s, a short walk between spots.
export const idlePose = (h: Home, t: number, out: Pose) => {
  const seed = h.plot;
  const u = t + (ih(seed, 7) % 1000) * (SLOT / 1000);
  const k = Math.floor(u / SLOT);
  const tt = u - k * SLOT;
  const spots = h.idle;
  const A = spots[ih(seed, k - 1) % spots.length];
  const Bp = spots[ih(seed, k) % spots.length];
  const dd = Math.hypot(Bp.x - A.x, Bp.z - A.z);
  const wt = dd / 0.85;
  out.label = "";
  out.side = 0;
  out.actDur = 0;
  if (dd > 0.05 && tt < wt) {
    const f = tt / wt;
    out.x = A.x + (Bp.x - A.x) * f;
    out.z = A.z + (Bp.z - A.z) * f;
    out.ry = Math.atan2(Bp.x - A.x, Bp.z - A.z);
    out.gait = 1;
    out.dist = k * 7.7 + tt * 0.85;
    out.act = "none";
    out.actT = 0;
    return out;
  }
  out.x = Bp.x;
  out.z = Bp.z;
  const r = ih(seed, k * 3 + 1);
  out.ry = (r & 3) === 0 ? h.in : (r & 3) === 1 ? h.out + 0.6 : h.out - ((r >> 2) & 1 ? 0.4 : 0);
  out.gait = 0;
  out.dist = k * 7.7;
  out.act = IDLE_ACTS[(r >>> 4) % IDLE_ACTS.length];
  out.actT = tt - wt;
  return out;
};

// ---------- plans ----------

type ActFn = (t: number, out: Pose) => void;

export type Plan = {
  id: number;
  t0: number; // starts walking there
  t1: number; // gets there, starts doing it
  t2: number; // done
  t3: number; // back home
  go: Path | null;
  goGait: Gait;
  back: Path | null;
  backGait: Gait;
  act: ActFn;
  label: string;
  goLabel: string;
};

export type PlanContext = {
  name: (plot: number) => string; // @username for a house
  queueIndex: (ev: GameEvent) => number; // place in the Job Centre queue
  basePose: (plot: number, t: number) => Pose; // where someone is without this event
};

const walkSpeed = (len: number) => Math.min(2.7, Math.max(1.25, len / 150));
const gaitFor = (speed: number): Gait => (speed > 2.9 ? 3 : speed > 1.9 ? 2 : 1);
const tmpP = newPose();

// A trip from home: start from wherever the person is in their garden when they set off, so there's
// no jump; and back to wherever they'd be in the garden when they arrive.
const trip = (
  h: Home,
  arrive: number,
  leave: number,
  toThere: (from: Pt) => Pt[],
  fromThere: (to: Pt) => Pt[],
  backSpeed = 1.25,
) => {
  const nominal = new Path(toThere(h.gate)).len + 4;
  const speed0 = walkSpeed(nominal);
  const t0 = arrive - nominal / speed0;
  const start = idlePose(h, t0, tmpP);
  const go = new Path(toThere({ x: start.x, z: start.z }));
  const backNominal = new Path(fromThere(h.gate)).len + 4;
  const t3 = leave + backNominal / backSpeed;
  const end = idlePose(h, t3, tmpP);
  const back = new Path(fromThere({ x: end.x, z: end.z }));
  return { t0, t3, go, back, goGait: gaitFor(go.len / Math.max(1, arrive - t0)), backGait: gaitFor(back.len / Math.max(1, t3 - leave)) };
};

const fromGate = (h: Home, to: Pt) => toGate(h, to).reverse();

const still = (act: Act, p: Pt, ry: number, t1: number, dur = 0): ActFn => (t, o) => {
  o.x = p.x;
  o.z = p.z;
  o.ry = ry;
  o.gait = 0;
  o.act = act;
  o.actT = t - t1;
  o.actDur = dur;
};

const tmpAt = { x: 0, z: 0, ry: 0 };

// Moving while doing it (sweeping up and down the path, jogging round the block).
const along = (act: Act, path: Path, speed: number, t1: number, gait: Gait, loop = false): ActFn => (t, o) => {
  const s = (t - t1) * speed;
  let d = s;
  if (loop) d = s % Math.max(1, path.len);
  else {
    const L = Math.max(0.01, path.len);
    const m = s % (2 * L);
    d = m <= L ? m : 2 * L - m;
  }
  path.at(d, tmpAt);
  o.x = tmpAt.x;
  o.z = tmpAt.z;
  o.ry = loop || (s % (2 * Math.max(0.01, path.len))) <= path.len ? tmpAt.ry : tmpAt.ry + Math.PI;
  o.gait = gait;
  o.dist = s;
  o.act = act;
  o.actT = t - t1;
  o.actDur = 0;
};

// Something someone does on their own.
const taskPlan = (ev: GameEvent, ctx: PlanContext): Plan | null => {
  const h = homeOf(ev.actor);
  const t1 = ev.at;
  const t2 = ev.at + ev.dur;
  const words = TASKS[ev.detail];
  const label = words?.now ?? "";
  const goLabel = words?.going ?? "";
  const yardTrip = (spot: Pt) =>
    trip(
      h,
      t1,
      t2,
      (from) => [from, spot],
      (to) => [spot, to],
    );
  const make = (tr: ReturnType<typeof trip>, act: ActFn): Plan => ({
    id: ev.id,
    t0: tr.t0,
    t1,
    t2,
    t3: tr.t3,
    go: tr.go,
    goGait: tr.goGait,
    back: tr.back,
    backGait: tr.backGait,
    act,
    label,
    goLabel,
  });
  switch (ev.detail) {
    case "sweep": {
      const a = homeSpot(h, "sweepA");
      const b = homeSpot(h, "sweepB");
      return make(yardTrip(a), along("sweep", new Path([a, b]), 0.32, t1, 1));
    }
    case "water": {
      const p = homeSpot(h, "water");
      return make(yardTrip(p), still("water", p, h.out, t1));
    }
    case "build": {
      const p = homeSpot(h, "build");
      return make(yardTrip(p), still("watch", p, h.in, t1));
    }
    case "rest": {
      const p = homeSpot(h, "rest");
      return make(yardTrip(p), still("sitGround", p, h.out, t1));
    }
    case "mailbox": {
      const p = homeSpot(h, "mailbox");
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), mailboxApproach(h).slice(1)),
        (to) => join(mailboxApproach(h).reverse(), fromGate(h, to).slice(1)),
      );
      return make(tr, still("mailbox", p, h.in, t1));
    }
    case "jog": {
      const loop = new Path(blockLoop(h));
      const tr = trip(
        h,
        t1,
        t2,
        (from) => toGate(h, from),
        (to) => fromGate(h, to),
      );
      return make(tr, along("none", loop, Math.max(2.2, (loop.len * 3) / ev.dur), t1, 2, true));
    }
    case "park": {
      const seat = parkSeat(h, ih(ev.actor, ev.id));
      if (!seat) return null;
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), route(h.town, h.gate, seat.entry, ih(ev.id, 1)).slice(1), [seat.p]),
        (to) => join([seat.p], route(h.town, seat.entry, h.gate, ih(ev.id, 2)), fromGate(h, to).slice(1)),
      );
      return make(tr, still("sitBench", seat.p, seat.ry, t1));
    }
    case "work_hospital": {
      // A shift at the hospital: out front with the other doctors.
      const s = hospitalShift(h.town, ev.actor);
      const [entry] = s.path;
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), route(h.town, h.gate, entry, ih(ev.id, 1)).slice(1), s.path.slice(1)),
        (to) => join([...s.path].reverse(), route(h.town, entry, h.gate, ih(ev.id, 2)).slice(1), fromGate(h, to).slice(1)),
      );
      return make(tr, still("crossed", s.p, s.ry, t1));
    }
    case "work_labour": {
      // On the building site next door, hard at work on the house.
      const n = homeOf(siteFor(ev.actor, ev.id));
      const spot = homeSpot(n, "build");
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), route(h.town, h.gate, n.gate, ih(ev.id, 1)).slice(1), [spot]),
        (to) => join([spot], route(h.town, n.gate, h.gate, ih(ev.id, 2)), fromGate(h, to).slice(1)),
      );
      return make(tr, still("mailbox", spot, n.in, t1));
    }
    case "work_odd": {
      // Odd jobs in the plaza: selling, or sweeping up.
      const s = oddJobSpot(h.town, ih(ev.actor, ev.id));
      const entry = plazaEntry(h.town, s.p);
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), route(h.town, h.gate, entry, ih(ev.id, 1)).slice(1), [s.p]),
        (to) => join([s.p], route(h.town, entry, h.gate, ih(ev.id, 2)), fromGate(h, to).slice(1)),
      );
      const sweep = new Path([s.p, { x: s.p.x + 3, z: s.p.z }]);
      return make(tr, ev.id % 2 ? along("sweep", sweep, 0.3, t1, 1) : still("look", s.p, s.ry, t1));
    }
    default: {
      // The Job Market in the plaza, in line with everyone else looking for work.
      const q = queueSpot(h.town, ctx.queueIndex(ev), ev.id);
      const entry = plazaEntry(h.town, q.p);
      const tr = trip(
        h,
        t1,
        t2,
        (from) => join(toGate(h, from), route(h.town, h.gate, entry, ih(ev.id, 1)).slice(1), [q.p]),
        (to) => join([q.p], route(h.town, entry, h.gate, ih(ev.id, 2)), fromGate(h, to).slice(1)),
      );
      return make(tr, still("queue", q.p, q.ry, t1));
    }
  }
};

// The garden path between a spot in the garden and the gate (inside it).
const toMeet = (h: Home, from: Pt) => {
  const path = toGate(h, from);
  path[path.length - 1] = homeSpot(h, "meetIn");
  return path;
};

// A fight's last 10 seconds: the loser goes down, the winner celebrates.
const fightAct = (p: Pt, ry: number, t1: number, dur: number, side: number, lost: boolean): ActFn => {
  const end = Math.max(3, dur - 10);
  return (t, o) => {
    o.x = p.x;
    o.z = p.z;
    o.ry = ry;
    o.gait = 0;
    o.side = side;
    const s = t - t1;
    if (s < end) {
      o.act = "fight";
      o.actT = s;
      o.actDur = end;
    } else if (lost) {
      o.act = "fall";
      o.actT = s - end;
      o.actDur = dur - end;
    } else {
      o.act = s - end < 4 ? "cheer" : "none";
      o.actT = s - end;
      o.actDur = 4;
    }
  };
};

const chatAct = (p: Pt, ry: number, t1: number, first: boolean): ActFn => (t, o) => {
  o.x = p.x;
  o.z = p.z;
  o.ry = ry;
  o.gait = 0;
  const turn = Math.floor((t - t1) / 6) % 2 === 0;
  o.act = turn === first ? "chat" : "listen";
  o.actT = t - t1;
  o.actDur = 0;
};

// The one who goes over to a neighbour's (to chat, fight or steal).
const visitPlan = (ev: GameEvent, ctx: PlanContext): Plan | null => {
  if (ev.target === null) return null;
  const h = homeOf(ev.actor);
  const th = homeOf(ev.target);
  const t1 = ev.at;
  const t2 = ev.at + ev.dur;
  const other = ctx.name(ev.target);
  const steal = ev.kind === "steal";
  const spot = steal ? homeSpot(th, "mailbox") : homeSpot(th, "meetOut");
  const into = steal ? mailboxApproach(th).slice(1) : [spot];
  const fled = steal && ev.detail !== "empty";
  const tr = trip(
    h,
    t1,
    t2,
    (from) => join(toGate(h, from), route(h.town, h.gate, th.gate, ih(ev.id, 1)).slice(1), into),
    (to) => join(steal ? [...into].reverse() : [spot], route(h.town, th.gate, h.gate, ih(ev.id, 2)), fromGate(h, to).slice(1)),
    fled ? 3.4 : 1.25,
  );
  let act: ActFn;
  let label: string;
  let goLabel: string;
  if (ev.kind === "chat") {
    act = chatAct(spot, th.in, t1, true);
    label = `Chatting with ${other}`;
    goLabel = `Going to see ${other}`;
  } else if (ev.kind === "fight") {
    act = fightAct(spot, th.in, t1, ev.dur, 0, ev.winner !== ev.actor);
    label = `Fighting ${other}!`;
    goLabel = `Going after ${other}`;
  } else {
    act = still("grab", spot, th.in, t1);
    label = ev.detail === "caught" ? "Caught stealing!" : "Up to no good";
    goLabel = "Sneaking about";
  }
  return { id: ev.id, t0: tr.t0, t1, t2, t3: tr.t3, go: tr.go, goGait: tr.goGait, back: tr.back, backGait: fled ? 3 : tr.backGait, act, label, goLabel };
};

// The neighbour someone came to: out to the gate to chat or fight, or after a thief who got caught.
const hostPlan = (ev: GameEvent, ctx: PlanContext): Plan | null => {
  if (ev.target === null) return null;
  const h = homeOf(ev.target);
  const other = ctx.name(ev.actor);
  const meet = homeSpot(h, "meetIn");
  if (ev.kind === "steal") {
    if (ev.detail !== "caught") return null; // they never noticed
    const t0 = ev.at + 8;
    const start = idlePose(h, t0, tmpP);
    const go = new Path(toMeet(h, { x: start.x, z: start.z }));
    const t1 = t0 + go.len / 3;
    const t2 = ev.at + ev.dur + 6;
    const end = idlePose(h, t2 + 8, tmpP);
    const back = new Path(toMeet(h, { x: end.x, z: end.z }).reverse());
    return {
      id: ev.id,
      t0,
      t1,
      t2,
      t3: t2 + Math.max(4, back.len / 1.1),
      go,
      goGait: 3,
      back,
      backGait: 1,
      act: still("shakeFist", meet, h.out, t1),
      label: `Caught ${other} stealing!`,
      goLabel: "Hey! Thief!",
    };
  }
  const t1 = ev.at;
  const t2 = ev.at + ev.dur;
  const lead = 7;
  const start = idlePose(h, t1 - lead, tmpP);
  const go = new Path(toMeet(h, { x: start.x, z: start.z }));
  const t0 = t1 - Math.max(lead, go.len / 1.1);
  const realStart = idlePose(h, t0, tmpP);
  const go2 = new Path(toMeet(h, { x: realStart.x, z: realStart.z }));
  const t3 = t2 + 8;
  const end = idlePose(h, t3, tmpP);
  const back = new Path(toMeet(h, { x: end.x, z: end.z }).reverse());
  const act =
    ev.kind === "chat" ? chatAct(meet, h.out, t1, false) : fightAct(meet, h.out, t1, ev.dur, 1, ev.winner !== ev.target);
  return {
    id: ev.id,
    t0,
    t1,
    t2,
    t3,
    go: go2,
    goGait: 1,
    back,
    backGait: 1,
    act,
    label: ev.kind === "chat" ? `Chatting with ${other}` : `Fighting ${other}!`,
    goLabel: ev.kind === "chat" ? `${other} is at the gate` : `${other} wants a fight`,
  };
};

// A player (in the game) did something to this person: they react where they stand.
const reactPlan = (ev: GameEvent, ctx: PlanContext, faceTo: Pt | null): Plan | null => {
  if (ev.target === null) return null;
  const base = ctx.basePose(ev.target, ev.at);
  const p = { x: base.x, z: base.z };
  const ry = faceTo ? Math.atan2(faceTo.x - p.x, faceTo.z - p.z) : base.ry;
  const other = ctx.name(ev.actor);
  const t1 = ev.at;
  let act: ActFn;
  let t2: number;
  let label: string;
  if (ev.kind === "fight") {
    const lost = ev.winner !== ev.target;
    t2 = t1 + 4 + (lost ? 5 : 2.5);
    act = (t, o) => {
      const s = t - t1;
      o.x = p.x;
      o.z = p.z;
      o.ry = ry;
      o.gait = 0;
      o.side = 1;
      if (s < 4) {
        o.act = "fight";
        o.actT = s + 1.3;
        o.actDur = 4;
      } else if (lost) {
        o.act = "fall";
        o.actT = s - 4;
        o.actDur = 5;
      } else {
        o.act = "cheer";
        o.actT = s - 4;
        o.actDur = 2.5;
      }
    };
    label = `Fighting ${other}!`;
  } else {
    t2 = t1 + 4;
    act = still(ev.detail === "caught" ? "shakeFist" : "look", p, ry, t1);
    label = ev.detail === "caught" ? `Caught ${other} stealing!` : "";
  }
  return { id: ev.id, t0: t1, t1, t2, t3: t2, go: null, goGait: 0, back: null, backGait: 0, act, label, goLabel: label };
};

// The plans someone has for an event (as the one doing it, or the one it's done to).
export const plansFor = (plot: number, ev: GameEvent, ctx: PlanContext, faceTo: Pt | null = null): Plan | null => {
  if (ev.live) return ev.target === plot ? reactPlan(ev, ctx, faceTo) : null;
  if (ev.actor === plot) return ev.kind === "task" ? taskPlan(ev, ctx) : visitPlan(ev, ctx);
  if (ev.target === plot) return hostPlan(ev, ctx);
  return null;
};

// Where someone is at time t, given their plans (sorted by start).
export const evalPose = (plot: number, plans: readonly Plan[] | undefined, t: number, out: Pose): Pose => {
  if (plans)
    for (let i = plans.length - 1; i >= 0; i--) {
      const p = plans[i];
      if (t < p.t0 || t > p.t3) continue;
      out.side = 0;
      out.actDur = 0;
      if (t < p.t1 && p.go) {
        const span = Math.max(0.01, p.t1 - p.t0);
        const s = ((t - p.t0) / span) * p.go.len;
        p.go.at(s, tmpAt);
        out.x = tmpAt.x;
        out.z = tmpAt.z;
        out.ry = tmpAt.ry;
        out.gait = p.go.len > 0.05 ? p.goGait : 0;
        out.dist = s;
        out.act = "none";
        out.actT = 0;
        out.label = p.goLabel;
        return out;
      }
      if (t <= p.t2 || !p.back) {
        p.act(Math.min(t, p.t2), out);
        if (t > p.t2) {
          out.act = out.act === "fall" ? "fall" : "none";
        }
        out.label = p.label;
        return out;
      }
      const span = Math.max(0.01, p.t3 - p.t2);
      const s = ((t - p.t2) / span) * p.back.len;
      p.back.at(s, tmpAt);
      out.x = tmpAt.x;
      out.z = tmpAt.z;
      out.ry = tmpAt.ry;
      out.gait = p.back.len > 0.05 ? p.backGait : 0;
      out.dist = s;
      out.act = "none";
      out.actT = 0;
      out.label = p.backGait === 3 ? "Running off" : "";
      return out;
    }
  return idlePose(homeOf(plot), t, out);
};
