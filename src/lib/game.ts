// Shared state for the game (client only): your person, play mode, who's within reach, what
// happened while you were away, and short notes ("@x stole 12 coins from you"). The map, the game
// controls and the panels all read it, like src/lib/social.ts does for chat.
import { useSyncExternalStore } from "react";

// Something that happened in town (public.character_events). at: Unix seconds (server clock).
export type GameEvent = {
  id: number;
  at: number;
  dur: number;
  kind: "task" | "chat" | "fight" | "steal";
  detail: string;
  actor: number;
  target: number | null;
  winner: number | null;
  coins: number;
  live: boolean; // done by a player in the game
};

// The kinds of job at the Job Market (supabase/schema.sql, section 13). The workplaces have a fixed
// number of seats each (first come, first served); building sites and odd jobs always hire.
export const PLACES = ["hospital", "police", "engineer", "fire", "school", "bank", "film"] as const;
export type PlaceKind = (typeof PLACES)[number];
export type JobKind = PlaceKind | "labour" | "odd";
export const JOB_KINDS: readonly JobKind[] = [...PLACES, "labour", "odd"];
export const isJobKind = (v: unknown): v is JobKind => typeof v === "string" && (JOB_KINDS as readonly string[]).includes(v);
export const isPlace = (k: JobKind | null | undefined): k is PlaceKind => !!k && (PLACES as readonly string[]).includes(k);

// Your own person (wallet and health are only sent to you). job: the job's title; seat: your seat
// at a workplace (1 is the best).
export type MyChar = {
  plot: number;
  look: number;
  age: number;
  trait: string;
  job: string | null;
  jobKind: JobKind | null;
  seat: number | null;
  income: number;
  wallet: number;
  health: number;
};

// One line of your story: something you did, or that was done to you.
export type StoryItem = {
  id: number;
  at: number;
  kind: GameEvent["kind"];
  detail: string;
  mine: boolean;
  other: number | null;
  otherName: string | null;
  won: boolean | null;
  coins: number;
  live: boolean;
};

export type Toast = { id: number; text: string; tone: "good" | "bad" | "info"; quiet?: boolean };

// Where you're walking to (picked on the town map while playing).
export type Dest = { key: string; name: string; x: number; z: number; color: string };

type GameState = {
  ready: boolean; // in the game (game_enter answered)
  char: MyChar | null;
  play: boolean; // walking your person around, camera behind them
  near: { plot: number; username: string } | null; // someone within reach while playing
  away: { first: boolean; seconds: number; items: StoryItem[] } | null; // the "while you were away" panel
  story: StoryItem[]; // newest first
  storyOpen: boolean;
  jobsOpen: boolean; // the Job Market panel
  jobsFocus: JobKind | null; // opened by tapping a workplace: show that one first
  mapOpen: boolean; // the town map
  dest: Dest | null;
  toasts: Toast[];
  busy: boolean; // a fight or theft is being decided
};

const initial: GameState = {
  ready: false,
  char: null,
  play: false,
  near: null,
  away: null,
  story: [],
  storyOpen: false,
  jobsOpen: false,
  jobsFocus: null,
  mapOpen: false,
  dest: null,
  toasts: [],
  busy: false,
};
let state = initial;
const listeners = new Set<() => void>();

const set = (patch: Partial<GameState>) => {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useGame = () => useSyncExternalStore(subscribe, () => state, () => initial);
export const getGame = () => state;
export const patchGame = set;

// Adds story lines (deduplicated by id), newest first, at most 200.
export const addStory = (items: StoryItem[]) => {
  if (!items.length) return;
  const seen = new Set(state.story.map((s) => s.id));
  const fresh = items.filter((s) => !seen.has(s.id));
  if (!fresh.length) return;
  const story = [...fresh, ...state.story].sort((a, b) => b.at - a.at || b.id - a.id).slice(0, 200);
  set({ story });
};

let toastId = 0;
// quiet: no sound (a sound of its own was played).
export const toast = (text: string, tone: Toast["tone"] = "info", quiet = false) => {
  const t = { id: ++toastId, text, tone, quiet };
  set({ toasts: [...state.toasts.slice(-2), t] });
  window.setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 5200);
};

export const setPlay = (play: boolean) => set({ play, near: play ? state.near : null, dest: play ? state.dest : null });

// ---------- requests from the page to the map ----------

type MapRequest = { type: "play"; on: boolean } | { type: "act"; kind: "fight" | "steal" | "wave" } | { type: "show"; plot: number };
const mapFns = new Set<(r: MapRequest) => void>();
export const onMapRequest = (fn: (r: MapRequest) => void) => {
  mapFns.add(fn);
  return () => {
    mapFns.delete(fn);
  };
};
export const requestMap = (r: MapRequest) => {
  for (const fn of mapFns) fn(r);
};

// ---------- words ----------

const fmt = (n: number) => n.toLocaleString("en");

export const TASKS: Record<string, { past: string; now: string; going?: string }> = {
  jobqueue: { past: "Hung about at the Job Market.", now: "At the Job Market", going: "Off to the Job Market" },
  work_hospital: { past: "Did a shift at the hospital.", now: "On shift at the hospital", going: "Off to the hospital" },
  work_police: { past: "Did a shift at the Police Station.", now: "On duty at the Police Station", going: "Off to the Police Station" },
  work_engineer: { past: "Engineered things at the Tech Park.", now: "Engineering at the Tech Park", going: "Off to the Tech Park" },
  work_fire: { past: "Did a shift at the Fire Station.", now: "On call at the Fire Station", going: "Off to the Fire Station" },
  work_school: { past: "Taught a class at the City School.", now: "Teaching at the City School", going: "Off to school" },
  work_bank: { past: "Counted money at the City Bank.", now: "Counting money at the bank", going: "Off to the bank" },
  work_film: { past: "Shot a scene at Lazy Films Studio.", now: "Shooting a film at the studio", going: "Off to the film studio" },
  work_labour: { past: "Did a shift on a building site.", now: "Working on a building site", going: "Off to work" },
  work_odd: { past: "Did odd jobs round the plaza.", now: "Doing odd jobs", going: "Off to work" },
  sweep: { past: "Swept the front garden.", now: "Sweeping the garden" },
  water: { past: "Watered the plants.", now: "Watering the plants" },
  mailbox: { past: "Checked the mailbox.", now: "Checking the mailbox" },
  jog: { past: "Went for a jog round the block.", now: "Out for a jog" },
  park: { past: "Sat on a bench in the park.", now: "Sitting in the park", going: "Off to the park" },
  build: { past: "Watched the builders work on the house.", now: "Watching the builders" },
  rest: { past: "Took a nap.", now: "Having a nap" },
};

export const jobText = (job: string | null) => job ?? "Waiting for a job";

// Each kind of job in words: where it is, what you'd be, and the buttons to apply.
export const JOB_INFO: Record<JobKind, { place: string; where: string; role: string; apply: string; switchTo: string; blurb: string }> = {
  hospital: {
    place: "City Hospital",
    where: "at the City Hospital",
    role: "Doctor",
    apply: "Become a doctor",
    switchTo: "Switch to the hospital",
    blurb: "The craziest jobs in medicine, from Professor of Hiccups to Emergency Room DJ.",
  },
  police: {
    place: "Police Station",
    where: "at the Police Station",
    role: "Police officer",
    apply: "Join the police",
    switchTo: "Switch to the police",
    blurb: "Chief Inspector of Samosa Theft, Moustache Inspector, Handcuff Juggler and more.",
  },
  engineer: {
    place: "Tech Park",
    where: "at the Tech Park",
    role: "Engineer",
    apply: "Become an engineer",
    switchTo: "Switch to engineering",
    blurb: "Rocket Scientist (Paper Rockets), Chief Jugaad Officer, Robot Babysitter and more.",
  },
  fire: {
    place: "Fire Station",
    where: "at the Fire Station",
    role: "Firefighter",
    apply: "Become a firefighter",
    switchTo: "Switch to the fire station",
    blurb: "Pole Slider in Chief, Cat-Out-of-Tree Specialist, Fire Truck Siren DJ and more.",
  },
  school: {
    place: "City School",
    where: "at the City School",
    role: "Teacher",
    apply: "Become a teacher",
    switchTo: "Switch to teaching",
    blurb: "Head of Surprise Tests, Chief Chalk Thrower, PT Teacher Who Only Whistles and more.",
  },
  bank: {
    place: "City Bank",
    where: "at the City Bank",
    role: "Banker",
    apply: "Work at the bank",
    switchTo: "Switch to the bank",
    blurb: "Loan Refuser, Head of Come Tomorrow, Vault Guard (Forgot the Code) and more.",
  },
  film: {
    place: "Lazy Films Studio",
    where: "at Lazy Films Studio",
    role: "Film star or crew",
    apply: "Get into films",
    switchTo: "Switch to films",
    blurb: "Superstar, Villain With a Cool Laugh, Stunt Double, Fake Rain Maker and more.",
  },
  labour: {
    place: "Building sites",
    where: "on the building sites",
    role: "Labourer",
    apply: "Work as a labourer",
    switchTo: "Switch to labour",
    blurb: "Brick Juggler, Scaffolding Monkey, Cement Mixer Whisperer and more.",
  },
  odd: {
    place: "Odd jobs",
    where: "doing odd jobs round town",
    role: "Odd jobs round town",
    apply: "Do odd jobs",
    switchTo: "Switch to odd jobs",
    blurb: "Chai Wallah, Mango Seller, Walker of Seven Dogs and more.",
  },
};
export const JOB_PLACE = Object.fromEntries(JOB_KINDS.map((k) => [k, JOB_INFO[k].place])) as Record<JobKind, string>;
export const JOB_WHERE = Object.fromEntries(JOB_KINDS.map((k) => [k, JOB_INFO[k].where])) as Record<JobKind, string>;
export const incomeText = (income: number) => `${fmt(Math.max(0, income))} coins/day`;

const who = (s: StoryItem) => (s.otherName ? `@${s.otherName}` : "a neighbour");

// The story line in words.
export const storyText = (s: StoryItem): string => {
  const o = who(s);
  const c = `${fmt(s.coins)} ${s.coins === 1 ? "coin" : "coins"}`;
  switch (s.kind) {
    case "task":
      return TASKS[s.detail]?.past ?? "Pottered about at home.";
    case "chat":
      return s.mine ? `Went over for a chat with ${o}.` : `${o} came over for a chat.`;
    case "fight":
      if (s.mine) return s.won ? `Picked a fight with ${o} and won${s.coins ? ` (+${c})` : ""}.` : `Picked a fight with ${o} and lost${s.coins ? ` (−${c})` : ""}.`;
      return s.won ? `${o} picked a fight with you. You won${s.coins ? ` (+${c})` : ""}.` : `${o} picked a fight with you and won${s.coins ? ` (−${c})` : ""}.`;
    case "steal":
      if (s.detail === "ok") return s.mine ? `Stole ${c} from ${o}.` : `${o} stole ${c} from you.`;
      if (s.detail === "empty") return s.mine ? `Tried to rob ${o}, but they had nothing.` : `${o} tried to rob you and found nothing.`;
      return s.mine ? `Tried to steal from ${o} and got caught.` : `Caught ${o} trying to steal from you.`;
  }
};

export const storyTone = (s: StoryItem): "good" | "bad" | "info" => {
  if (s.kind === "fight") return s.won ? "good" : "bad";
  if (s.kind === "steal") {
    if (s.detail === "ok") return s.mine ? "good" : "bad";
    return s.mine ? "bad" : "good";
  }
  return "info";
};

// Coins won or lost by a story line.
export const storyCoins = (s: StoryItem) => {
  if (s.kind === "steal" && s.detail === "ok") return s.mine ? s.coins : -s.coins;
  if (s.kind === "fight") return s.won ? s.coins : -s.coins;
  return 0;
};

// "3 h 20 min", "2 days", "5 min".
export const durationText = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 2) return `${d} days`;
  if (d === 1) return h ? `1 day ${h} h` : "1 day";
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.max(1, m)} min`;
};
