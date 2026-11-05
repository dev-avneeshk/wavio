// Time of day, season and weather over the towns, on India's clock (IST, UTC+5:30). Everyone sees
// the same sky: it's worked out from the time alone, no server needed. Visitors can also pick a time
// or a weather to look at; that's kept in their browser only.
//
// Seasons follow India's calendar: winter Dec-Feb (snow on the ground, snowfall most hours),
// summer Mar-May, monsoon Jun-Sep (rain most hours), post-monsoon Oct-Nov. The sun runs on the
// real sunrise and sunset for central India (about 22 degrees north) on that day.
import { useSyncExternalStore } from "react";

export type DayPart = "morning" | "afternoon" | "evening" | "night";
export type Weather = "clear" | "rain" | "snow";
export type Season = "winter" | "summer" | "monsoon" | "autumn";
export type TimePick = "live" | DayPart;
export type WeatherPick = "live" | "clear" | "rain" | "winter";
export type SkyPicks = { time: TimePick; weather: WeatherPick };

export type SkyState = {
  hour: number; // IST hours (0-24) the sun is drawn at: the real time, or the picked part of the day
  realHour: number; // IST clock right now
  part: DayPart; // of `hour`
  realPart: DayPart;
  doy: number; // day of the year in India (1-366)
  season: Season;
  weather: Weather; // what's drawn
  realWeather: Weather; // what the live sky has now
  rain: number; // 0-1, how hard it rains
  snow: number; // 0-1, how hard it snows
  frost: number; // 0-1, snow lying on the ground
  sunrise: number; // IST hours
  sunset: number;
  picks: SkyPicks;
};

const IST_MS = 5.5 * 3600 * 1000;
const LAT = (22 * Math.PI) / 180;
const NOON = 12.3; // solar noon in IST for central India (the IST meridian is east of most of India)

export const PARTS: DayPart[] = ["morning", "afternoon", "evening", "night"];
export const PART_NAME: Record<DayPart, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
export const WEATHER_NAME: Record<Weather, string> = { clear: "Clear", rain: "Rain", snow: "Snow" };
export const SEASON_NAME: Record<Season, string> = { winter: "Winter", summer: "Summer", monsoon: "Monsoon", autumn: "Post-monsoon" };

// The sun's declination (radians) on day d of the year.
const declination = (doy: number) => ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + doy)) / 365);

// Sunrise and sunset (IST hours) on day d.
export const sunTimes = (doy: number): [number, number] => {
  const c = Math.max(-1, Math.min(1, -Math.tan(LAT) * Math.tan(declination(doy))));
  const half = (Math.acos(c) * 180) / Math.PI / 15;
  return [NOON - half, NOON + half];
};

// The direction to the sun at IST hour h on day d, in the world's axes (x east, y up, z south).
export const sunDir = (hour: number, doy: number, out: { x: number; y: number; z: number }) => {
  const dec = declination(doy);
  const H = ((hour - NOON) * 15 * Math.PI) / 180;
  const east = -Math.cos(dec) * Math.sin(H);
  const north = Math.sin(dec) * Math.cos(LAT) - Math.cos(dec) * Math.cos(H) * Math.sin(LAT);
  const up = Math.sin(dec) * Math.sin(LAT) + Math.cos(dec) * Math.cos(H) * Math.cos(LAT);
  out.x = east;
  out.y = up;
  out.z = -north;
  return out;
};

const wrap24 = (h: number) => ((h % 24) + 24) % 24;

// Morning from just before sunrise to noon; evening around sunset; night after that.
export const partOf = (hour: number, sunrise: number, sunset: number): DayPart => {
  const h = wrap24(hour);
  if (h >= sunrise - 0.75 && h < 12) return "morning";
  if (h >= 12 && h < sunset - 1.25) return "afternoon";
  if (h >= sunset - 1.25 && h < Math.max(sunset + 1.1, 19.25)) return "evening";
  return "night";
};

// The hour the sun is drawn at for a picked part of the day.
const pickedHour = (part: DayPart, sunrise: number, sunset: number) => {
  switch (part) {
    case "morning":
      return sunrise + 2.2;
    case "afternoon":
      return 14.5;
    case "evening":
      return sunset - 0.2;
    case "night":
      return 22.5;
  }
};

const seasonOf = (month: number): Season =>
  month === 11 || month <= 1 ? "winter" : month <= 4 ? "summer" : month <= 8 ? "monsoon" : "autumn";

// A number in [0, 1) from an integer, the same on every screen.
const hash01 = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// How likely rain is in a 3-hour slot, by month (Jan..Dec).
const RAIN_CHANCE = [0, 0, 0.03, 0.04, 0.12, 0.55, 0.7, 0.7, 0.55, 0.15, 0.05, 0];

export const skyAt = (ms: number, picks: SkyPicks): SkyState => {
  const ist = new Date(ms + IST_MS);
  const month = ist.getUTCMonth();
  const start = Date.UTC(ist.getUTCFullYear(), 0, 1);
  const doy = Math.floor((ist.getTime() - start) / 86_400_000) + 1;
  const realHour = ist.getUTCHours() + ist.getUTCMinutes() / 60 + ist.getUTCSeconds() / 3600;
  const [sunrise, sunset] = sunTimes(doy);
  const season = seasonOf(month);

  // The live weather changes every 3 hours.
  const slot = Math.floor((ms + IST_MS) / (3 * 3600 * 1000));
  const roll = hash01(slot);
  const strength = 0.55 + 0.45 * hash01(slot * 7 + 3);
  let realWeather: Weather = "clear";
  if (season === "winter") realWeather = roll < 0.55 ? "snow" : "clear";
  else if (roll < RAIN_CHANCE[month]) realWeather = "rain";
  const realFrost = season === "winter" ? (month === 0 ? 1 : month === 11 ? 0.85 : 0.65) : 0;

  let weather = realWeather;
  let frost = realFrost;
  let rain = realWeather === "rain" ? strength : 0;
  let snow = realWeather === "snow" ? 0.45 + 0.4 * strength : 0;
  if (picks.weather === "clear") {
    weather = "clear";
    rain = snow = frost = 0;
  } else if (picks.weather === "rain") {
    weather = "rain";
    rain = 0.85;
    snow = frost = 0;
  } else if (picks.weather === "winter") {
    weather = "snow";
    snow = 0.8;
    frost = 1;
    rain = 0;
  }

  const hour = picks.time === "live" ? realHour : pickedHour(picks.time, sunrise, sunset);
  return {
    hour,
    realHour,
    part: picks.time === "live" ? partOf(realHour, sunrise, sunset) : picks.time,
    realPart: partOf(realHour, sunrise, sunset),
    doy,
    season,
    weather,
    realWeather,
    rain,
    snow,
    frost,
    sunrise,
    sunset,
    picks,
  };
};

// "6:41 pm"
export const clockText = (hour: number) => {
  const h = wrap24(hour);
  let hh = Math.floor(h);
  let mm = Math.floor((h - hh) * 60 + 1e-6);
  if (mm >= 60) {
    hh += 1;
    mm -= 60;
  }
  const am = hh % 24 < 12;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${am ? "am" : "pm"}`;
};

// ---------- the visitor's picks (this browser only) ----------

const KEY = "lazycity:sky";
const DEFAULT: SkyPicks = { time: "live", weather: "live" };
const TIMES: TimePick[] = ["live", ...PARTS];
const WEATHERS: WeatherPick[] = ["live", "clear", "rain", "winter"];

const read = (): SkyPicks => {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<SkyPicks> | null;
    return {
      time: TIMES.includes(v?.time as TimePick) ? (v?.time as TimePick) : "live",
      weather: WEATHERS.includes(v?.weather as WeatherPick) ? (v?.weather as WeatherPick) : "live",
    };
  } catch {
    return DEFAULT;
  }
};

let picks: SkyPicks | null = null;
const listeners = new Set<() => void>();

export const getSkyPicks = (): SkyPicks => (picks ??= read());

export const setSkyPicks = (patch: Partial<SkyPicks>) => {
  const next = { ...getSkyPicks(), ...patch };
  if (next.time === picks?.time && next.weather === picks?.weather) return;
  picks = next;
  try {
    if (next.time === "live" && next.weather === "live") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the pick lasts until the page is closed.
  }
  for (const fn of listeners) fn();
};

export const subscribeSkyPicks = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useSkyPicks = () => useSyncExternalStore(subscribeSkyPicks, getSkyPicks, () => DEFAULT);
