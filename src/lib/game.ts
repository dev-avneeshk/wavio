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

// The kinds of job at the Job Market (supabase/schema.sql, section 13).
export type JobKind = "hospital" | "labour" | "odd";

// Your own person (wallet and health are only sent to you). job: the job's title; seat: your seat
// at the hospital (1 is the best).
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

export type Toast = { id: number; text: string; tone: "good" | "bad" | "info" };

type GameState = {
  ready: boolean; // in the game (game_enter answered)
  char: MyChar | null;
  play: boolean; // walking your person around, camera behind them
  near: { plot: number; username: string } | null; // someone within reach while playing
  away: { first: boolean; seconds: number; items: StoryItem[] } | null; // the "while you were away" panel
  story: StoryItem[]; // newest first
  storyOpen: boolean;
  jobsOpen: boolean; // the Job Market panel
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
export const toast = (text: string, tone: Toast["tone"] = "info") => {
  const t = { id: ++toastId, text, tone };
  set({ toasts: [...state.toasts.slice(-2), t] });
  window.setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 5200);
};

export const setPlay = (play: boolean) => set({ play, near: play ? state.near : null });

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

// Where each kind of job is.
export const JOB_PLACE: Record<JobKind, string> = {
  hospital: "City Hospital",
  labour: "Building sites",
  odd: "Odd jobs",
};
export const JOB_WHERE: Record<JobKind, string> = {
  hospital: "at the City Hospital",
  labour: "on the building sites",
  odd: "doing odd jobs round town",
};
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
