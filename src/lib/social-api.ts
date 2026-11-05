// Calls to the database for waves, messages, blocking and search (browser only). Every rule is
// checked by the database (supabase/schema.sql, section 9); this file only turns its answers and
// error hints into data and plain words.
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Conversation } from "@/lib/social";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const WORDS: Record<string, string> = {
  chat_not_on_list: "Join the waitlist to message your neighbours.",
  chat_no_house: "That house isn't there any more.",
  chat_too_far: "You can only message houses within 4 plots of yours.",
  chat_you_blocked: "You blocked this neighbour. Unblock them to send a message.",
  chat_blocked: "This neighbour isn't taking messages from you.",
  chat_empty: "Write something first.",
  chat_too_long: "Messages can be up to 280 characters.",
  chat_slow_down: "Slow down a little and try again in a few seconds.",
  chat_daily_limit: "That's 300 messages today. Try again tomorrow.",
  house_not_on_list: "Join the waitlist to wave at houses.",
  house_own: "That's your own house.",
  house_missing: "That house isn't there any more.",
};

const fail = (error: { hint?: string | null; code?: string; message?: string } | null): { ok: false; error: string } => {
  if (error?.hint && WORDS[error.hint]) return { ok: false, error: WORDS[error.hint] };
  if (error?.code === "42501" || error?.message?.includes("JWT")) return { ok: false, error: "Sign in again to do that." };
  console.error("[social]", error?.code, error?.message);
  return { ok: false, error: "Something went wrong. Try again." };
};

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function rpc<T>(fn: string, args: Record<string, unknown>, parse: (data: unknown) => T | null): Promise<Result<T>> {
  try {
    const { data, error } = await createClient().rpc(fn, args);
    if (error) return fail(error);
    const parsed = parse(data);
    return parsed === null ? fail({ message: `unexpected answer from ${fn}` }) : { ok: true, data: parsed };
  } catch (e) {
    console.error("[social]", fn, e);
    return { ok: false, error: "Couldn't reach the server. Check your connection." };
  }
}

export const waveHouse = (plot: number) =>
  rpc("wave_house", { p_plot: plot }, (d) => {
    const o = d as { waves?: unknown; counted?: unknown } | null;
    return o && isInt(o.waves) ? { waves: o.waves, counted: o.counted === true } : null;
  });

export const sendMessage = (to: number, body: string) =>
  rpc("send_message", { p_to: to, p_body: body }, (d): ChatMessage | null => {
    const o = d as { id?: unknown; body?: unknown; at?: unknown } | null;
    return o && isInt(o.id) ? { id: o.id, fromMe: true, body: str(o.body), at: str(o.at) } : null;
  });

export type Thread = { with: number; messages: ChatMessage[]; near: boolean; blocked: boolean };

export const fetchThread = (withPlot: number, before?: number) =>
  rpc("chat_thread", { p_with: withPlot, p_before: before ?? null }, (d): Thread | null => {
    const o = d as { with?: unknown; messages?: unknown; near?: unknown; blocked?: unknown } | null;
    if (!o || !Array.isArray(o.messages)) return null;
    const messages: ChatMessage[] = [];
    for (const m of o.messages)
      if (Array.isArray(m) && isInt(m[0])) messages.push({ id: m[0], fromMe: m[1] === true, body: str(m[2]), at: str(m[3]) });
    return { with: withPlot, messages, near: o.near === true, blocked: o.blocked === true };
  });

export const fetchInbox = () =>
  rpc("chat_inbox", {}, (d): Conversation[] | null => {
    if (!Array.isArray(d)) return null;
    const out: Conversation[] = [];
    for (const c of d as Record<string, unknown>[]) {
      if (!c || !isInt(c.with)) continue;
      out.push({
        with: c.with,
        username: str(c.username),
        last: str(c.last),
        at: str(c.at),
        fromMe: c.fromMe === true,
        unread: isInt(c.unread) ? c.unread : 0,
        blocked: c.blocked === true,
      });
    }
    return out;
  });

export const setBlocked = (plot: number, on: boolean) =>
  rpc("set_block", { p_plot: plot, p_on: on }, (d) => (typeof d === "boolean" ? d : null));

export const findHouse = (query: string) =>
  rpc("find_house", { p_query: query }, (d): [number, string][] | null => {
    if (!Array.isArray(d)) return null;
    const out: [number, string][] = [];
    for (const r of d) if (Array.isArray(r) && isInt(r[0]) && typeof r[1] === "string") out.push([r[0], r[1]]);
    return out;
  });
