// Live positions of the people being played right now, shared through a Supabase Realtime broadcast
// channel per town ("town:N"). Only players in the game join it. What comes in is only used to draw
// people moving; coins, fights and thefts are always decided and recorded by the database.
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameEvent } from "@/lib/game";
import { createClient } from "@/lib/supabase/client";

// p: house number, x/z: position, r: facing, g: gait (0 still, 1 walk, 3 run), a: action code
// (see people.ts), s: when the action started (server seconds).
export type LiveState = { p: number; x: number; z: number; r: number; g: number; a: number; s: number };

export type LiveLink = {
  join: (town: number) => void;
  leave: () => void;
  send: (s: LiveState) => void;
  sendEvent: (e: GameEvent) => void;
  onState: (fn: (s: LiveState) => void) => () => void;
  onEvent: (fn: (e: GameEvent) => void) => () => void;
};

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

const parseState = (v: unknown): LiveState | null => {
  const o = v as Record<string, unknown> | null;
  if (!o) return null;
  const p = num(o.p, 1, 1e9);
  const x = num(o.x, -1e6, 1e6);
  const z = num(o.z, -1e6, 1e6);
  const r = num(o.r, -100, 100);
  const g = num(o.g, 0, 4);
  const a = num(o.a, 0, 64);
  const s = num(o.s, 0, 1e11);
  if (p === null || x === null || z === null || r === null || g === null || a === null || s === null || !Number.isInteger(p)) return null;
  return { p, x, z, r, g: Math.round(g), a: Math.round(a), s };
};

const KINDS = new Set(["task", "chat", "fight", "steal"]);

const parseEvent = (v: unknown): GameEvent | null => {
  const o = v as Record<string, unknown> | null;
  if (!o || !KINDS.has(o.kind as string)) return null;
  const id = num(o.id, 1, 1e15);
  const at = num(o.at, 0, 1e11);
  const actor = num(o.actor, 1, 1e9);
  if (id === null || at === null || actor === null) return null;
  return {
    id,
    at,
    dur: num(o.dur, 1, 60) ?? 6,
    kind: o.kind as GameEvent["kind"],
    detail: typeof o.detail === "string" ? o.detail.slice(0, 12) : "",
    actor,
    target: num(o.target, 1, 1e9),
    winner: num(o.winner, 1, 1e9),
    coins: num(o.coins, 0, 1e6) ?? 0,
    live: true,
  };
};

export function createLiveLink(): LiveLink {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let town = 0;
  let open = false;
  const stateFns = new Set<(s: LiveState) => void>();
  const eventFns = new Set<(e: GameEvent) => void>();

  const leave = () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
    town = 0;
    open = false;
  };

  return {
    join(t) {
      if (t === town && channel) return;
      leave();
      town = t;
      channel = supabase
        .channel(`town:${t}`, { config: { broadcast: { self: false, ack: false } } })
        .on("broadcast", { event: "s" }, ({ payload }) => {
          const s = parseState(payload);
          if (s) for (const fn of stateFns) fn(s);
        })
        .on("broadcast", { event: "e" }, ({ payload }) => {
          const e = parseEvent(payload);
          if (e) for (const fn of eventFns) fn(e);
        })
        .subscribe((status) => {
          open = status === "SUBSCRIBED";
        });
    },
    leave,
    send(s) {
      if (channel && open) void channel.send({ type: "broadcast", event: "s", payload: s });
    },
    sendEvent(e) {
      if (channel && open) void channel.send({ type: "broadcast", event: "e", payload: e });
    },
    onState(fn) {
      stateFns.add(fn);
      return () => {
        stateFns.delete(fn);
      };
    },
    onEvent(fn) {
      eventFns.add(fn);
      return () => {
        eventFns.delete(fn);
      };
    },
  };
}
