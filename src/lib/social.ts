// Shared state for the social bits (client only): your conversations with neighbours, the chat
// window, and requests from the page card to the map (fly to a house). The map, the chat window and
// the card all read it, so they stay in step without passing props through the server-rendered page.
import { useSyncExternalStore } from "react";

export type Conversation = {
  with: number; // the neighbour's house number
  username: string;
  last: string;
  at: string;
  fromMe: boolean;
  unread: number;
  blocked: boolean; // you blocked them
};

export type ChatMessage = { id: number; fromMe: boolean; body: string; at: string };

// A new message to you, from Supabase Realtime or the inbox check.
export type Incoming = { id: number; from: number; body: string; at: string };

type SocialState = {
  inbox: Conversation[];
  unread: number;
  chatOpen: boolean;
  chatWith: number | null; // null: the list of neighbours
};

const initial: SocialState = { inbox: [], unread: 0, chatOpen: false, chatWith: null };
let state = initial;
const listeners = new Set<() => void>();

const set = (patch: Partial<SocialState>) => {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useSocial = () => useSyncExternalStore(subscribe, () => state, () => initial);
export const getSocial = () => state;

export const setInbox = (inbox: Conversation[]) =>
  set({ inbox, unread: inbox.reduce((n, c) => n + (c.blocked ? 0 : c.unread), 0) });

// Before the first inbox check, show the count the page loaded with.
export const setUnread = (unread: number) => {
  if (!state.inbox.length) set({ unread });
};

// Mark one conversation as read here (the database does it when the thread is opened).
export const markRead = (plot: number) => {
  if (!state.inbox.some((c) => c.with === plot && c.unread)) return;
  setInbox(state.inbox.map((c) => (c.with === plot ? { ...c, unread: 0 } : c)));
};

export const openChat = (withPlot: number | null = null) => set({ chatOpen: true, chatWith: withPlot });
export const closeChat = () => set({ chatOpen: false, chatWith: null });

const incomingFns = new Set<(m: Incoming) => void>();
export const onIncoming = (fn: (m: Incoming) => void) => {
  incomingFns.add(fn);
  return () => {
    incomingFns.delete(fn);
  };
};
export const emitIncoming = (m: Incoming) => {
  for (const fn of incomingFns) fn(m);
};

const flyFns = new Set<(plot: number) => void>();
export const onFlyRequest = (fn: (plot: number) => void) => {
  flyFns.add(fn);
  return () => {
    flyFns.delete(fn);
  };
};
// Ask the map to fly to a house and open its card.
export const requestFly = (plot: number) => {
  for (const fn of flyFns) fn(plot);
};
