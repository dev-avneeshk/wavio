// The places in a town worth finding: the hospital, the Job Market, the civic quarter's six
// workplaces and the way into the jungle. The town map draws them; the sound gives each its noises.
import { jungleOf } from "@/components/land/jungle";
import { PX, townCenter } from "@/components/land/layout";
import { HOSPITAL, KIOSK, WORK, WORK_KINDS, workBuildings, workFrame } from "@/components/people/nav";
import { JOB_INFO, type JobKind } from "@/lib/game";
import type { Emitter } from "@/lib/sound";

export type PlaceKey = JobKind | "kiosk" | "jungle";
export type MapPlace = {
  key: PlaceKey;
  name: string;
  short: string; // on the map
  color: string;
  x: number; // world
  z: number;
  hx: number; // footprint, for drawing
  hz: number;
  facing: number | null; // the way its front faces (to look at it from the front)
  dy: -1 | 0 | 1; // its label on the map: above, on, or below it (two share each civic block)
};

export const PLACE_COLOR: Record<PlaceKey, string> = {
  hospital: "#E5484D",
  police: "#1E4B9A",
  engineer: "#0E8F9C",
  fire: "#E8590C",
  school: "#D99A00",
  bank: "#1F7A50",
  film: "#6D28D9",
  labour: "#B45309",
  odd: "#B45309",
  kiosk: "#1F5FA8",
  jungle: "#2F7D45",
};

const SHORT: Partial<Record<PlaceKey, string>> = {
  hospital: "Hospital",
  police: "Police",
  engineer: "Tech Park",
  fire: "Fire Station",
  school: "School",
  bank: "Bank",
  film: "Film Studio",
  kiosk: "Job Market",
  jungle: "Jungle",
};

const cache = new Map<number, MapPlace[]>();

export const placesOf = (town: number): MapPlace[] => {
  const hit = cache.get(town);
  if (hit) return hit;
  const [ox, oz] = townCenter(town);
  const out: MapPlace[] = [
    { key: "hospital", name: JOB_INFO.hospital.place, short: SHORT.hospital!, color: PLACE_COLOR.hospital, x: ox + HOSPITAL.x, z: oz + HOSPITAL.z, hx: HOSPITAL.hx, hz: HOSPITAL.hz, facing: 0, dy: -1 },
    { key: "kiosk", name: "Job Market", short: SHORT.kiosk!, color: PLACE_COLOR.kiosk, x: ox + KIOSK.x, z: oz + KIOSK.z, hx: KIOSK.hx, hz: KIOSK.hz, facing: 0, dy: 1 },
  ];
  for (const b of workBuildings(town))
    out.push({
      key: b.kind,
      name: JOB_INFO[b.kind].place,
      short: SHORT[b.kind]!,
      color: PLACE_COLOR[b.kind],
      x: b.x,
      z: b.z,
      hx: b.hx,
      hz: b.hz,
      facing: workFrame(b.kind, town).a,
      dy: b.x < townCenter(town)[0] + WORK[b.kind].i * PX ? -1 : 1,
    });
  const j = jungleOf(town);
  out.push({ key: "jungle", name: "The jungle", short: SHORT.jungle!, color: PLACE_COLOR.jungle, x: j.gateX, z: j.tz, hx: 2, hz: 2, facing: -Math.PI / 2, dy: 0 });
  if (cache.size > 40) cache.clear();
  cache.set(town, out);
  return out;
};

// What each place sounds like (seconds between sounds, metres you hear them from).
const SOUNDS: Partial<Record<PlaceKey, Emitter["sounds"]>> = {
  hospital: [
    { name: "monitor", every: [0.95, 1.15], range: 26, vol: 0.7 },
    { name: "ambulance", every: [50, 120], range: 170, vol: 0.5 },
  ],
  police: [
    { name: "policeSiren", every: [55, 130], range: 180, vol: 0.45 },
    { name: "radio", every: [6, 14], range: 32 },
  ],
  fire: [
    { name: "fireBell", every: [45, 100], range: 120, vol: 0.5 },
    { name: "horn", every: [70, 150], range: 140, vol: 0.7 },
  ],
  school: [{ name: "schoolBell", every: [40, 90], range: 130, vol: 0.7 }],
  bank: [{ name: "clink", every: [2.5, 6], range: 28 }],
  film: [
    { name: "clapper", every: [9, 20], range: 60 },
    { name: "cheer", every: [16, 34], range: 60, vol: 0.55 },
  ],
  engineer: [{ name: "bleeps", every: [2.5, 6], range: 30, vol: 0.8 }],
};

const emitCache = new Map<number, Emitter[]>();

export const emittersOf = (town: number): Emitter[] => {
  const hit = emitCache.get(town);
  if (hit) return hit;
  const out: Emitter[] = [];
  for (const p of placesOf(town)) {
    const sounds = SOUNDS[p.key];
    if (sounds) out.push({ key: `${town}:${p.key}`, x: p.x, z: p.z, range: 60, sounds });
  }
  if (emitCache.size > 40) emitCache.clear();
  emitCache.set(town, out);
  return out;
};

export const WORKPLACE_KEYS: readonly PlaceKey[] = ["hospital", ...WORK_KINDS, "kiosk", "jungle"];
