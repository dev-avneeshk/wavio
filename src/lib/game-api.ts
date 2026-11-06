// Calls to the database for the game (browser only). The rules and every outcome are decided by
// the database (supabase/schema.sql, sections 11 and 12); this file turns its answers into data and
// its error hints into plain words.
import { supabaseEnv } from "@/lib/env";
import { PLACES, isJobKind, type GameEvent, type JobKind, type MyChar, type PlaceKind, type StoryItem } from "@/lib/game";
import { createClient } from "@/lib/supabase/client";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const WORDS: Record<string, string> = {
  game_not_on_list: "Join the waitlist to get your person.",
  game_bad_action: "You can't do that.",
  game_no_target: "They're not in your town.",
  game_fight_wait: "Catch your breath first. Try again in a few seconds.",
  game_steal_wait: "Lie low for a couple of minutes before the next one.",
  game_steal_again: "You already robbed them today. Try someone else.",
  game_too_hurt: "You're too hurt to fight. Rest at home first.",
  job_bad_kind: "That job doesn't exist.",
  job_full: "Too late: every seat there is taken. Try another place; building sites and odd jobs always hire.",
  job_already: "You already work there.",
  job_wait: "You just changed jobs. Try again in a minute.",
};

const fail = (error: { hint?: string | null; code?: string; message?: string } | null): { ok: false; error: string } => {
  if (error?.hint && WORDS[error.hint]) return { ok: false, error: WORDS[error.hint] };
  if (error?.code === "42501" || error?.message?.includes("JWT")) return { ok: false, error: "Sign in again to do that." };
  console.error("[game]", error?.code, error?.message);
  return { ok: false, error: "Something went wrong. Try again." };
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const intOr = (v: unknown, d: number | null = null) => (isInt(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function rpc<T>(fn: string, args: Record<string, unknown>, parse: (data: unknown) => T | null): Promise<Result<T>> {
  try {
    const { data, error } = await createClient().rpc(fn, args);
    if (error) return fail(error);
    const parsed = parse(data);
    return parsed === null ? fail({ message: `unexpected answer from ${fn}` }) : { ok: true, data: parsed };
  } catch (e) {
    console.error("[game]", fn, e);
    return { ok: false, error: "Couldn't reach the server. Check your connection." };
  }
}

const parseChar = (v: unknown): MyChar | null => {
  const o = v as Record<string, unknown> | null;
  if (!o || !isInt(o.plot)) return null;
  return {
    plot: o.plot,
    look: isInt(o.look) ? o.look : -1,
    age: intOr(o.age, 0) ?? 0,
    trait: str(o.trait),
    job: typeof o.job === "string" && o.job ? o.job : null,
    jobKind: isJobKind(o.jobKind) ? o.jobKind : null,
    seat: intOr(o.seat),
    income: intOr(o.income, 0) ?? 0,
    wallet: intOr(o.wallet, 0) ?? 0,
    health: intOr(o.health, 100) ?? 100,
  };
};

const KINDS = new Set(["task", "chat", "fight", "steal"]);

const parseStory = (v: unknown): StoryItem[] => {
  if (!Array.isArray(v)) return [];
  const out: StoryItem[] = [];
  for (const r of v) {
    if (!Array.isArray(r) || !isInt(r[0]) || !isInt(r[1]) || !KINDS.has(r[2])) continue;
    out.push({
      id: r[0],
      at: r[1],
      kind: r[2],
      detail: str(r[3]),
      mine: r[4] === true,
      other: intOr(r[5]),
      otherName: typeof r[6] === "string" ? r[6] : null,
      won: typeof r[7] === "boolean" ? r[7] : null,
      coins: intOr(r[8], 0) ?? 0,
      live: r[9] === true,
    });
  }
  return out;
};

export const parseEvents = (v: unknown): GameEvent[] => {
  if (!Array.isArray(v)) return [];
  const out: GameEvent[] = [];
  for (const r of v) {
    if (!Array.isArray(r) || !isInt(r[0]) || !isNum(r[1]) || !KINDS.has(r[3]) || !isInt(r[5])) continue;
    out.push({
      id: r[0],
      at: r[1],
      dur: Math.max(1, intOr(r[2], 30) ?? 30),
      kind: r[3],
      detail: str(r[4]),
      actor: r[5],
      target: intOr(r[6]),
      winner: intOr(r[7]),
      coins: intOr(r[8], 0) ?? 0,
      live: r[9] === true,
    });
  }
  return out;
};

export type Enter = { now: number; char: MyChar; first: boolean; since: number; events: StoryItem[] };
export type Ping = { now: number; char: MyChar; events: StoryItem[] };
export type TownFeed = { now: number; events: GameEvent[]; online: number[] };
export type ActResult = {
  id: number;
  kind: "fight" | "steal";
  detail: string;
  winner: number | null;
  coins: number;
  targetName: string;
  char: MyChar;
};

// The access token, kept for the request sent while the page closes (it can't wait for a lookup).
let token: string | null = null;

const keepToken = async () => {
  try {
    const { data } = await createClient().auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    token = null;
  }
};

export const gameEnter = async () => {
  void keepToken();
  return rpc("game_enter", {}, (d): Enter | null => {
    const o = d as Record<string, unknown> | null;
    const char = parseChar(o?.char);
    if (!o || !char || !isNum(o.now)) return null;
    return { now: o.now, char, first: o.first === true, since: intOr(o.since, 0) ?? 0, events: parseStory(o.events) };
  });
};

export const gamePing = async (after: number) => {
  void keepToken();
  return rpc("game_ping", { p_after: after }, (d): Ping | null => {
    const o = d as Record<string, unknown> | null;
    const char = parseChar(o?.char);
    if (!o || !char || !isNum(o.now)) return null;
    return { now: o.now, char, events: parseStory(o.events) };
  });
};

// Leaving: sent with keepalive so it still goes out while the page closes.
export const gameLeave = () => {
  if (!token) return;
  try {
    const { url, key } = supabaseEnv();
    void fetch(`${url}/rest/v1/rpc/game_leave`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
  } catch {
    // Not configured: nothing to tell.
  }
};

export const myStory = (before?: number) => rpc("my_story", { p_before: before ?? null }, (d) => (Array.isArray(d) ? parseStory(d) : null));

export const charAct = (kind: "fight" | "steal", target: number) =>
  rpc("char_act", { p_kind: kind, p_target: target }, (d): ActResult | null => {
    const o = d as Record<string, unknown> | null;
    const char = parseChar(o?.char);
    if (!o || !char || !isInt(o.id) || (o.kind !== "fight" && o.kind !== "steal")) return null;
    return {
      id: o.id,
      kind: o.kind,
      detail: str(o.detail),
      winner: intOr(o.winner),
      coins: intOr(o.coins, 0) ?? 0,
      targetName: str(o.targetName),
      char,
    };
  });

export const townEvents = async (town: number): Promise<TownFeed | null> => {
  const r = await rpc("town_events", { p_town: town }, (d): TownFeed | null => {
    const o = d as Record<string, unknown> | null;
    if (!o || !isNum(o.now)) return null;
    const online = Array.isArray(o.online) ? (o.online.filter(isInt) as number[]) : [];
    return { now: o.now, events: parseEvents(o.events), online };
  });
  return r.ok ? r.data : null;
};

// ---------- the Job Market ----------

export type Staff = { seat: number; title: string; pay: number; plot: number; username: string };
export type Seat = { seat: number; title: string; pay: number };
// A workplace with seats: how many, how many are free, the next one up, seat 1, who works there.
export type Place = { kind: PlaceKind; total: number; open: number; next: Seat | null; top: Seat | null; staff: Staff[] };
export type JobMarket = {
  places: Place[]; // in the Job Market's order
  labour: { workers: number; low: number; high: number };
  odd: { workers: number; low: number; high: number };
  member: boolean; // signed in with a house
  mine: { kind: JobKind; title: string; pay: number; seat: number | null } | null;
};

const parseGroup = (v: unknown) => {
  const o = v as Record<string, unknown> | null;
  return { workers: intOr(o?.workers, 0) ?? 0, low: intOr(o?.low, 0) ?? 0, high: intOr(o?.high, 0) ?? 0 };
};

const parseSeat = (v: unknown): Seat | null => {
  const n = v as Record<string, unknown> | null;
  return n && isInt(n.seat) ? { seat: n.seat, title: str(n.title), pay: intOr(n.pay, 0) ?? 0 } : null;
};

const parsePlace = (v: unknown, kind: PlaceKind): Place | null => {
  const h = v as Record<string, unknown> | null;
  if (!h || !isInt(h.total) || !isInt(h.open)) return null;
  const staff: Staff[] = [];
  if (Array.isArray(h.staff))
    for (const r of h.staff)
      if (Array.isArray(r) && isInt(r[0]) && isInt(r[3]))
        staff.push({ seat: r[0], title: str(r[1]), pay: intOr(r[2], 0) ?? 0, plot: r[3], username: str(r[4]) });
  return { kind, total: h.total, open: h.open, next: parseSeat(h.next), top: parseSeat(h.top), staff };
};

export const jobMarket = () =>
  rpc("job_market", {}, (d): JobMarket | null => {
    const o = d as Record<string, unknown> | null;
    if (!o) return null;
    const places: Place[] = [];
    if (Array.isArray(o.places))
      for (const p of o.places) {
        const kind = (p as Record<string, unknown> | null)?.kind;
        if (!(PLACES as readonly unknown[]).includes(kind)) continue;
        const parsed = parsePlace(p, kind as PlaceKind);
        if (parsed) places.push(parsed);
      }
    else {
      // An older database: the hospital only.
      const h = parsePlace(o.hospital, "hospital");
      if (h) places.push(h);
    }
    if (!places.length) return null;
    const m = o.mine as Record<string, unknown> | null;
    return {
      places,
      labour: parseGroup(o.labour),
      odd: parseGroup(o.odd),
      member: o.member === true,
      mine: m && isJobKind(m.kind) ? { kind: m.kind, title: str(m.title), pay: intOr(m.pay, 0) ?? 0, seat: intOr(m.seat) } : null,
    };
  });

const charOnly = (d: unknown) => parseChar((d as Record<string, unknown> | null)?.char);

export const takeJob = (kind: JobKind) => rpc("take_job", { p_kind: kind }, charOnly);
export const quitJob = () => rpc("quit_job", {}, charOnly);
