// Sound effects and the town's ambience, made in the browser with Web Audio (no sound files).
// Nothing plays until the first tap or key press (browsers require it). On/off is remembered on
// this device. One-shots: sfx("coin"), or sfx("siren", { x, z }) for a sound somewhere in the
// world (louder when you're near, panned left or right). The ambience (birds, crickets, rain, the
// fountain, each workplace's sounds, building sites) is driven by updateAmbience() several times
// a second with where you are (src/components/game/sound-director.tsx).
import { useSyncExternalStore } from "react";

export type SfxName =
  | "tick"
  | "open"
  | "close"
  | "coin"
  | "hire"
  | "good"
  | "bad"
  | "info"
  | "pop"
  | "whoosh"
  | "punch"
  | "thud"
  | "swish"
  | "whistle"
  | "cheer"
  | "stepHard"
  | "stepSoft"
  | "schoolBell"
  | "fireBell"
  | "policeSiren"
  | "ambulance"
  | "monitor"
  | "clapper"
  | "clink"
  | "bleeps"
  | "hammer"
  | "horn"
  | "radio"
  | "bird"
  | "cricket"
  | "tiger"
  | "elephant"
  | "monkey"
  | "peacock"
  | "deer";

// Where you hear from: the place, which way is "right" (the camera's right on the ground) and how
// high above it the camera is (sounds get quieter when you're zoomed out).
export type Ears = { x: number; z: number; rx: number; rz: number; height: number };
export type At = { x: number; z: number; range?: number; vol?: number };

// ---------- on / off ----------

const KEY = "wavio:sound";
let enabled = true;
let loaded = false;
const listeners = new Set<() => void>();
const readEnabled = () => {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      enabled = window.localStorage.getItem(KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
};

export const soundOn = () => readEnabled();
export const setSoundOn = (on: boolean) => {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode: just for this visit.
  }
  if (master && ctx) master.gain.setTargetAtTime(on ? MASTER : 0, ctx.currentTime, 0.05);
  if (on) unlock();
  for (const fn of listeners) fn();
};
export const useSoundOn = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    readEnabled,
    () => true,
  );

// ---------- the audio graph ----------

const MASTER = 0.9;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ears: Ears = { x: 0, z: 0, rx: 1, rz: 0, height: 0 };

// Called on the first tap / key press (and again after the tab comes back).
export const unlock = () => {
  if (typeof window === "undefined" || !readEnabled()) return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC({ latencyHint: "interactive" });
    } catch {
      return;
    }
    // iPhones: play even with the ring switch on silent (there's an off button for that).
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = "playback";
      } catch {
        // Older Safari: ignore.
      }
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = MASTER;
    sfxBus = ctx.createGain();
    ambBus = ctx.createGain();
    ambBus.gain.value = 0;
    sfxBus.connect(master);
    ambBus.connect(master);
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startBeds();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
};

// The tab is hidden: stop the sound (and its CPU) until it's back.
export const pauseAudio = (paused: boolean) => {
  if (!ctx) return;
  if (paused) void ctx.suspend().catch(() => undefined);
  else if (readEnabled()) void ctx.resume().catch(() => undefined);
};

const live = () => ctx !== null && ctx.state === "running" && readEnabled();

// ---------- building blocks ----------

// A voice: gain -> pan -> the bus. Returns its input.
const voice = (bus: GainNode, vol: number, pan = 0) => {
  const c = ctx!;
  const g = c.createGain();
  g.gain.value = vol;
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(bus);
  } else g.connect(bus);
  return g;
};

// An envelope on a gain: up to peak in a, down to nothing over d (exponential).
const env = (g: AudioParam, t: number, a: number, peak: number, d: number) => {
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + a);
  g.exponentialRampToValueAtTime(0.0001, t + a + d);
};

const tone = (out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, a: number, d: number, peak = 1, glide = d) => {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + glide);
  const g = c.createGain();
  env(g.gain, t, a, peak, d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
  return o;
};

const hiss = (
  out: AudioNode,
  t: number,
  a: number,
  d: number,
  peak: number,
  filter: { type: BiquadFilterType; f: number; q?: number; f1?: number },
) => {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.f, t);
  if (filter.f1) f.frequency.exponentialRampToValueAtTime(filter.f1, t + a + d);
  f.Q.value = filter.q ?? 0.8;
  const g = c.createGain();
  env(g.gain, t, a, peak, d);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + d + 0.05);
};

// A bell: a few inharmonic partials ringing down.
const bellHit = (out: AudioNode, f: number, t: number, d: number, peak: number) => {
  [1, 2.01, 2.43, 3.0, 4.17].forEach((m, k) => tone(out, "sine", f * m, f * m, t, 0.002, d / (1 + k * 0.6), peak / (1 + k * 0.9)));
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------- the sounds ----------

const RECIPES: Record<SfxName, (o: AudioNode, t: number) => void> = {
  tick: (o, t) => tone(o, "sine", 1900, 1300, t, 0.002, 0.035, 0.35),
  open: (o, t) => {
    tone(o, "sine", 420, 880, t, 0.005, 0.12, 0.5, 0.08);
    hiss(o, t, 0.01, 0.12, 0.08, { type: "bandpass", f: 900, f1: 3000, q: 1.2 });
  },
  close: (o, t) => tone(o, "sine", 760, 360, t, 0.004, 0.1, 0.4, 0.07),
  coin: (o, t) => {
    tone(o, "square", 988, 988, t, 0.002, 0.07, 0.18);
    tone(o, "square", 1319, 1319, t + 0.075, 0.002, 0.32, 0.18);
  },
  hire: (o, t) => {
    hiss(o, t, 0.004, 0.09, 0.5, { type: "bandpass", f: 4500, q: 0.9 });
    hiss(o, t + 0.11, 0.004, 0.07, 0.35, { type: "bandpass", f: 5200, q: 0.9 });
    bellHit(o, 1568, t + 0.16, 0.9, 0.35);
    bellHit(o, 2093, t + 0.2, 1.1, 0.3);
    tone(o, "square", 1319, 1319, t + 0.36, 0.002, 0.07, 0.12);
    tone(o, "square", 1760, 1760, t + 0.43, 0.002, 0.4, 0.12);
  },
  good: (o, t) => [1047, 1319, 1568].forEach((f, k) => tone(o, "sine", f, f, t + k * 0.075, 0.004, 0.32, 0.4)),
  bad: (o, t) => {
    const lp = ctx!.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.connect(o);
    tone(lp, "square", 233, 233, t, 0.004, 0.13, 0.35);
    tone(lp, "square", 196, 185, t + 0.15, 0.004, 0.28, 0.35);
  },
  info: (o, t) => tone(o, "sine", 880, 1100, t, 0.004, 0.16, 0.3, 0.05),
  pop: (o, t) => {
    tone(o, "sine", 300, 1100, t, 0.002, 0.09, 0.6, 0.05);
    tone(o, "sine", 1400, 1400, t + 0.06, 0.002, 0.12, 0.2);
  },
  whoosh: (o, t) => hiss(o, t, 0.12, 0.35, 1.1, { type: "bandpass", f: 300, f1: 2600, q: 1.6 }),
  punch: (o, t) => {
    tone(o, "sine", 150, 45, t, 0.002, 0.16, 1.0, 0.12);
    hiss(o, t, 0.001, 0.06, 0.7, { type: "lowpass", f: 2200 });
    hiss(o, t, 0.001, 0.025, 0.4, { type: "highpass", f: 3000 });
  },
  thud: (o, t) => {
    tone(o, "sine", 95, 38, t, 0.004, 0.4, 1.0, 0.3);
    hiss(o, t, 0.004, 0.3, 0.6, { type: "lowpass", f: 500 });
  },
  swish: (o, t) => hiss(o, t, 0.03, 0.2, 0.55, { type: "highpass", f: 900, f1: 6500, q: 0.7 }),
  whistle: (o, t) => {
    const a = tone(o, "sine", 1350, 2150, t, 0.02, 0.18, 0.4, 0.12);
    const b = tone(o, "sine", 2100, 1250, t + 0.24, 0.02, 0.32, 0.4, 0.26);
    for (const x of [a, b]) {
      const lfo = ctx!.createOscillator();
      const lg = ctx!.createGain();
      lfo.frequency.value = 7;
      lg.gain.value = 25;
      lfo.connect(lg).connect(x.frequency);
      lfo.start(t);
      lfo.stop(t + 0.7);
    }
  },
  cheer: (o, t) => {
    for (const f of [700, 1100, 1600, 2300]) hiss(o, t + rnd(0, 0.1), 0.25, 1.1, 0.5, { type: "bandpass", f, q: 2.2 });
    for (let k = 0; k < 4; k++) {
      const f = rnd(380, 650);
      tone(o, "sawtooth", f, f * rnd(1.25, 1.5), t + rnd(0, 0.4), 0.08, 0.6, 0.06, 0.4);
    }
  },
  stepHard: (o, t) => {
    hiss(o, t, 0.002, 0.045, 0.6, { type: "bandpass", f: rnd(1300, 2100), q: 1.4 });
    tone(o, "sine", rnd(140, 180), 70, t, 0.001, 0.05, 0.4, 0.04);
  },
  stepSoft: (o, t) => hiss(o, t, 0.006, 0.08, 1.3, { type: "lowpass", f: rnd(700, 1000), q: 0.6 }),
  schoolBell: (o, t) => {
    // An electric bell: the hammer hits the dome about 18 times a second for two seconds.
    for (let k = 0; k < 36; k++) bellHit(o, 1180, t + k * 0.055, 0.25, 0.22);
    bellHit(o, 1180, t + 36 * 0.055, 1.2, 0.3);
  },
  fireBell: (o, t) => {
    for (let k = 0; k < 6; k++) bellHit(o, 620, t + k * 0.42, 1.0, 0.45);
  },
  policeSiren: (o, t) => {
    // A wail: up and down, three times.
    const c = ctx!;
    const s = c.createOscillator();
    s.type = "sawtooth";
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.6);
    g.gain.setValueAtTime(0.28, t + 4.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
    s.frequency.setValueAtTime(620, t);
    for (let k = 0; k < 3; k++) {
      s.frequency.exponentialRampToValueAtTime(1450, t + k * 1.8 + 0.9);
      s.frequency.exponentialRampToValueAtTime(620, t + k * 1.8 + 1.8);
    }
    s.connect(lp).connect(g).connect(o);
    s.start(t);
    s.stop(t + 5.7);
  },
  ambulance: (o, t) => {
    // Hi-lo: two notes taking turns.
    const c = ctx!;
    const s = c.createOscillator();
    s.type = "triangle";
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.3);
    g.gain.setValueAtTime(0.45, t + 3.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
    for (let k = 0; k < 10; k++) s.frequency.setValueAtTime(k % 2 ? 740 : 960, t + k * 0.44);
    s.connect(g).connect(o);
    s.start(t);
    s.stop(t + 4.5);
  },
  monitor: (o, t) => tone(o, "sine", 1046, 1046, t, 0.004, 0.11, 0.35),
  clapper: (o, t) => {
    hiss(o, t, 0.0005, 0.02, 1.0, { type: "highpass", f: 1500 });
    hiss(o, t, 0.0005, 0.07, 0.6, { type: "bandpass", f: 2600, q: 6 });
    tone(o, "sine", 900, 400, t, 0.001, 0.05, 0.3, 0.04);
  },
  clink: (o, t) => {
    for (let k = 0; k < 3; k++) {
      const f = rnd(3200, 5200);
      tone(o, "sine", f, f, t + k * rnd(0.06, 0.12), 0.001, 0.18, 0.18);
    }
  },
  bleeps: (o, t) => {
    const notes = [784, 988, 1175, 1319, 1568, 1976];
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const f = notes[Math.floor(Math.random() * notes.length)];
      tone(o, "square", f, f, t + k * 0.085, 0.002, 0.06, 0.07);
    }
  },
  hammer: (o, t) => {
    for (let k = 0; k < 3; k++) {
      const at = t + k * rnd(0.32, 0.4);
      hiss(o, at, 0.0005, 0.03, 0.9, { type: "bandpass", f: 2200, q: 1.5 });
      tone(o, "sine", rnd(430, 520), 380, at, 0.001, 0.09, 0.45, 0.06);
    }
  },
  horn: (o, t) => {
    const lp = ctx!.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1300;
    lp.connect(o);
    for (const f of [233, 294]) {
      tone(lp, "sawtooth", f, f, t, 0.03, 0.55, 0.25);
      tone(lp, "sawtooth", f, f, t + 0.7, 0.03, 0.9, 0.25);
    }
  },
  radio: (o, t) => {
    hiss(o, t, 0.01, 0.35, 0.18, { type: "bandpass", f: 1800, q: 3 });
    tone(o, "square", 1250, 1250, t + 0.38, 0.002, 0.06, 0.08);
  },
  bird: (o, t) => {
    const f = rnd(2600, 4200);
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) tone(o, "sine", f * rnd(0.9, 1.05), f * rnd(1.15, 1.45), t + k * rnd(0.09, 0.15), 0.006, 0.07, 0.25, 0.05);
  },
  cricket: (o, t) => {
    for (let k = 0; k < 3; k++) tone(o, "sine", 4600, 4600, t + k * 0.045, 0.004, 0.025, 0.12);
  },
  tiger: (o, t) => {
    const c = ctx!;
    const s = c.createOscillator();
    s.type = "sawtooth";
    s.frequency.setValueAtTime(95, t);
    s.frequency.linearRampToValueAtTime(140, t + 0.35);
    s.frequency.exponentialRampToValueAtTime(60, t + 1.5);
    const am = c.createOscillator();
    const amg = c.createGain();
    am.frequency.value = 28;
    amg.gain.value = 0.35;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 1.5);
    const g = c.createGain();
    env(g.gain, t, 0.12, 0.9, 1.4);
    am.connect(amg).connect(g.gain);
    s.connect(lp).connect(g).connect(o);
    s.start(t);
    am.start(t);
    s.stop(t + 1.6);
    am.stop(t + 1.6);
    hiss(o, t, 0.1, 1.3, 0.5, { type: "lowpass", f: 700, f1: 200 });
  },
  elephant: (o, t) => {
    const c = ctx!;
    const s = c.createOscillator();
    s.type = "sawtooth";
    s.frequency.setValueAtTime(420, t);
    s.frequency.exponentialRampToValueAtTime(720, t + 0.25);
    s.frequency.setValueAtTime(720, t + 0.8);
    s.frequency.exponentialRampToValueAtTime(520, t + 1.3);
    const vib = c.createOscillator();
    const vg = c.createGain();
    vib.frequency.value = 9;
    vg.gain.value = 18;
    vib.connect(vg).connect(s.frequency);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1300;
    bp.Q.value = 2.5;
    const g = c.createGain();
    env(g.gain, t, 0.08, 0.7, 1.3);
    s.connect(bp).connect(g).connect(o);
    s.start(t);
    vib.start(t);
    s.stop(t + 1.45);
    vib.stop(t + 1.45);
  },
  monkey: (o, t) => {
    for (let k = 0; k < 4; k++) tone(o, "triangle", 520 + k * 90, 900 + k * 120, t + k * 0.16, 0.01, 0.12, 0.35, 0.06);
  },
  peacock: (o, t) => {
    tone(o, "sawtooth", 850, 1500, t, 0.02, 0.35, 0.36, 0.15);
    tone(o, "sawtooth", 1400, 900, t + 0.38, 0.02, 0.5, 0.36, 0.4);
  },
  deer: (o, t) => tone(o, "triangle", 700, 480, t, 0.01, 0.25, 0.35, 0.2),
};

// Play a sound now (or at an offset in seconds). With a place, it's quieter the further away it is
// (silent past range metres) and panned to its side; vol scales it.
export const sfx = (name: SfxName, at?: At | null, delay = 0, vol = 1) => {
  if (!live()) return;
  let gain = vol;
  let pan = 0;
  if (at) {
    const m = mix(at.x, at.z, at.range ?? 60);
    if (m.gain <= 0.01) return;
    gain *= m.gain * (at.vol ?? 1);
    pan = m.pan;
  }
  const out = voice(sfxBus!, gain * 0.9, pan);
  RECIPES[name](out, ctx!.currentTime + 0.01 + delay);
  // Let the voice go once it's done.
  window.setTimeout(() => out.disconnect(), (delay + 7) * 1000);
};

// How loud and which side a sound at (x, z) is for the ears.
const mix = (x: number, z: number, range: number) => {
  const dx = x - ears.x;
  const dz = z - ears.z;
  const flat = Math.hypot(dx, dz);
  const d = Math.hypot(flat, ears.height * 0.55);
  const k = Math.max(0, 1 - d / range);
  const pan = flat > 0.5 ? ((dx * ears.rx + dz * ears.rz) / flat) * 0.8 : 0;
  return { gain: k * k, pan };
};

// ---------- ambience ----------

type Bed = { gain: GainNode; pan: StereoPannerNode | null };
const beds: Record<string, Bed> = {};

// A looping noise through a filter, for wind, rain, the fountain and the crowd at the Job Market.
const noiseBed = (name: string, filters: { type: BiquadFilterType; f: number; q?: number }[], wobble = 0) => {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  let node: AudioNode = s;
  for (const f of filters) {
    const b = c.createBiquadFilter();
    b.type = f.type;
    b.frequency.value = f.f;
    b.Q.value = f.q ?? 0.7;
    node.connect(b);
    node = b;
  }
  const g = c.createGain();
  g.gain.value = 0;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (wobble) {
    // A slow swell, so it doesn't sound like a hiss.
    const w = c.createGain();
    w.gain.value = 1;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = wobble;
    lg.gain.value = 0.35;
    lfo.connect(lg).connect(w.gain);
    lfo.start();
    node.connect(w);
    node = w;
  }
  node.connect(g);
  if (pan) g.connect(pan).connect(ambBus!);
  else g.connect(ambBus!);
  s.start(0, Math.random() * 1.5);
  beds[name] = { gain: g, pan };
};

const startBeds = () => {
  noiseBed("wind", [{ type: "lowpass", f: 380 }], 0.11);
  noiseBed("rain", [
    { type: "highpass", f: 500 },
    { type: "lowpass", f: 7000 },
  ]);
  noiseBed("fountain", [
    { type: "bandpass", f: 1400, q: 0.5 },
    { type: "highpass", f: 350 },
  ]);
  noiseBed("crowd", [
    { type: "bandpass", f: 520, q: 1.2 },
    { type: "lowpass", f: 1400 },
  ], 0.6);
  noiseBed("insects", [{ type: "bandpass", f: 6200, q: 4 }], 2.7);
};

const setBed = (name: string, gain: number, pan = 0) => {
  const b = beds[name];
  if (!b || !ctx) return;
  b.gain.gain.setTargetAtTime(Math.max(0, gain), ctx.currentTime, 0.35);
  b.pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime, 0.35);
};

// Things that make a sound now and then, at a place.
export type Emitter = {
  key: string;
  x: number;
  z: number;
  range: number;
  sounds: { name: SfxName; every: [number, number]; vol?: number; range?: number }[];
};

const nextAt = new Map<string, number>();

export type Scene = {
  ears: Ears;
  zone: "town" | "trail" | "clearing";
  far: boolean; // zoomed out over the world
  night: boolean;
  rain: number; // 0-1
  plaza: { x: number; z: number } | null;
  kiosk: { x: number; z: number } | null;
  site: { x: number; z: number } | null; // the nearest house being built
  emitters: Emitter[];
};

// Ambience for where you are, several times a second.
export const updateAmbience = (s: Scene) => {
  if (!ctx || !ambBus) return;
  ears = s.ears;
  const on = live();
  ambBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4);
  if (!on) return;
  const high = Math.min(1, s.ears.height / 400);
  const town = s.zone === "town" && !s.far;
  setBed("wind", 0.05 + high * 0.22 + (s.far ? 0.08 : 0));
  setBed("rain", s.rain * (s.far ? 0.12 : 0.3));
  if (s.plaza && !s.far) {
    const m = mix(s.plaza.x, s.plaza.z, 70);
    setBed("fountain", m.gain * 0.22, m.pan);
  } else setBed("fountain", 0);
  if (s.kiosk && !s.far) {
    const m = mix(s.kiosk.x, s.kiosk.z, 45);
    setBed("crowd", m.gain * 0.16, m.pan);
  } else setBed("crowd", 0);
  setBed("insects", s.zone !== "town" ? (s.night ? 0.07 : 0.035) : s.night && town ? 0.012 : 0);

  const now = ctx.currentTime;
  const due = (key: string, every: [number, number]) => {
    const t = nextAt.get(key);
    if (t === undefined) {
      nextAt.set(key, now + rnd(0, every[1]));
      return false;
    }
    if (now < t) return false;
    nextAt.set(key, now + rnd(every[0], every[1]));
    return true;
  };

  if (s.far) return;
  // Birds by day (more in the jungle), crickets at night, all round you.
  const around = () => ({ x: ears.x + rnd(-25, 25), z: ears.z + rnd(-25, 25), range: 70 });
  if (!s.night && s.rain < 0.5 && due("birds", s.zone === "town" ? [1.6, 5] : [0.5, 2])) sfx("bird", around(), 0, 0.5);
  if (s.night && due("crickets", [0.35, 1.1])) sfx("cricket", around(), 0, 0.6);
  // A building site nearby: hammering now and then.
  if (s.site && town && due("hammer", [2.5, 6])) sfx("hammer", { x: s.site.x, z: s.site.z, range: 55 }, 0, 0.55);
  for (const e of s.emitters) {
    const d = Math.hypot(e.x - ears.x, e.z - ears.z);
    for (const snd of e.sounds) {
      const key = `${e.key}:${snd.name}`;
      if (!due(key, snd.every)) continue;
      const range = snd.range ?? e.range;
      if (d < range) sfx(snd.name, { x: e.x, z: e.z, range }, 0, snd.vol ?? 1);
    }
  }
};

// Animals in the jungle, when they react to you.
export const animalSound = (kind: string) => {
  const map: Record<string, SfxName> = {
    tiger: "tiger",
    elephant: "elephant",
    calf: "elephant",
    monkey: "monkey",
    peacock: "peacock",
    peahen: "peacock",
    deer: "deer",
    stag: "deer",
  };
  const name = map[kind];
  if (name) sfx(name, null, 0, 0.8);
};
