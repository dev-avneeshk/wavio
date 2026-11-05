// The plot a visitor tapped on the map (null = take the next free one). Shared by the map and the
// card (client code only). Kept in sessionStorage so it survives the trip to Google's sign-in page.
import { useSyncExternalStore } from "react";

const KEY = "waitlist:chosen-plot";
const listeners = new Set<() => void>();

const read = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(window.sessionStorage.getItem(KEY));
    return Number.isInteger(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
};

let chosen: number | null = read();

export const getChosenPlot = () => chosen;

export const setChosenPlot = (plot: number | null) => {
  if (plot === chosen) return;
  chosen = plot;
  try {
    if (plot === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, String(plot));
  } catch {
    // Private mode etc.: the choice just won't survive a reload.
  }
  for (const fn of listeners) fn();
};

export const subscribeChosenPlot = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useChosenPlot = () => useSyncExternalStore(subscribeChosenPlot, getChosenPlot, () => null);
