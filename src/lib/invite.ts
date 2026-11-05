// Invites (client only). Opening a house's link (/?h=12) remembers house 12 for 30 days; if the
// visitor joins, house 12 gets the invite and finishes sooner. Kept in localStorage so it survives
// the trip to Google's sign-in page and a later visit.
import { useSyncExternalStore } from "react";

const KEY = "waitlist:invited-by";
const KEEP_MS = 30 * 86400 * 1000;
const listeners = new Set<() => void>();

const read = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const { plot, at } = JSON.parse(raw) as { plot?: unknown; at?: unknown };
    if (typeof plot !== "number" || !Number.isInteger(plot) || plot < 1) return null;
    if (typeof at !== "number" || Date.now() - at > KEEP_MS) return null;
    return plot;
  } catch {
    return null;
  }
};

let invite: number | null = null;
let loaded = false;

export const getInvite = () => {
  if (!loaded && typeof window !== "undefined") {
    invite = read();
    loaded = true;
  }
  return invite;
};

export const rememberInvite = (plot: number) => {
  if (!Number.isInteger(plot) || plot < 1) return;
  invite = plot;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ plot, at: Date.now() }));
  } catch {
    // Private mode: the invite only lasts this visit.
  }
  for (const fn of listeners) fn();
};

export const clearInvite = () => {
  invite = null;
  loaded = true;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  for (const fn of listeners) fn();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useInvite = () => useSyncExternalStore(subscribe, getInvite, () => null);
