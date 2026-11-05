// How far along a house is, in words and numbers. The finish time comes from the database
// (public.waitlist_build_days in supabase/schema.sql); these numbers are only for the wording.
import type { House } from "@/lib/world";

export const BUILD_DAYS = 30;
export const DAYS_PER_INVITE = 2;
export const MIN_BUILD_DAYS = 3;

// Neighbours can message each other: houses at most this far apart (metres) in the same town, which
// is 4 plots along the street, the row behind, and across the road. Same number as in schema.sql.
export const NEIGHBOUR_RADIUS = 42;

export const nowSec = () => Date.now() / 1000;

// 0 when building starts, 1 when the house is finished.
export const progressOf = (h: Pick<House, "start" | "done">, now = nowSec()) => {
  if (!h.done || h.done <= h.start) return 0;
  return Math.min(1, Math.max(0, (now - h.start) / (h.done - h.start)));
};

export type StageKey = "foundation" | "frame" | "walls" | "roof" | "finishing" | "done";

const STAGES: { key: StageKey; label: string; until: number }[] = [
  { key: "foundation", label: "Foundation", until: 0.1 },
  { key: "frame", label: "Frame", until: 0.35 },
  { key: "walls", label: "Walls", until: 0.7 },
  { key: "roof", label: "Roof", until: 0.9 },
  { key: "finishing", label: "Finishing", until: 1 },
];

export const stageOf = (p: number): { key: StageKey; label: string; step: number; steps: number } => {
  const steps = STAGES.length + 1;
  if (p >= 1) return { key: "done", label: "Move-in ready", step: steps, steps };
  const i = STAGES.findIndex((s) => p < s.until);
  const s = STAGES[i < 0 ? STAGES.length - 1 : i];
  return { key: s.key, label: s.label, step: (i < 0 ? STAGES.length - 1 : i) + 1, steps };
};

// "12 days left", "1 day 5 h left", "40 min left", or "Finished".
export const timeLeftText = (done: number, now = nowSec()) => {
  const s = Math.max(0, done - now);
  if (!done || s <= 0) return "Finished";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  if (days >= 2) return `${days} days left`;
  if (days === 1) return hours ? `1 day ${hours} h left` : "1 day left";
  if (hours >= 1) return `${hours} h left`;
  return `${Math.max(1, Math.ceil(s / 60))} min left`;
};

export const percentText = (p: number) => `${Math.floor(p * 100)}%`;

export const instagramUrl = (username: string) => `https://www.instagram.com/${encodeURIComponent(username)}/`;

// The link that shows someone a house; joining from it counts as an invite from that house.
export const houseLinkPath = (plot: number) => `/?h=${plot}`;
