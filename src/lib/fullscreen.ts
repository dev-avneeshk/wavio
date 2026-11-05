"use client";

import { useSyncExternalStore } from "react";
import { isPhone } from "@/lib/device";

// Full screen without the browser's bars. Android and computers have the Fullscreen API; iPhones
// don't (only videos go full screen there), so on an iPhone the way is Add to Home Screen.
type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fsDoc = () => document as FsDoc;

export const fullscreenElement = () => fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement ?? null;

export const canFullscreen = () => Boolean(document.fullscreenEnabled || fsDoc().webkitFullscreenEnabled);

// Opened from the home screen as an app: there are no browser bars to hide.
export const isStandalone = () =>
  window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

type Lockable = { lock?: (o: string) => Promise<void>; unlock?: () => void };

// Must run from a tap. Phones are also turned sideways where the browser allows it (Android).
export async function enterFullscreen() {
  const el = document.documentElement as FsEl;
  try {
    if (!fullscreenElement()) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    return false;
  }
  if (isPhone()) {
    try {
      await (screen.orientation as unknown as Lockable).lock?.("landscape");
    } catch {
      // Can't lock here: the "turn your phone" prompt covers it.
    }
  }
  return fullscreenElement() !== null;
}

export async function exitFullscreen() {
  try {
    (screen.orientation as unknown as Lockable).unlock?.();
  } catch {
    // Nothing was locked.
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (fsDoc().webkitFullscreenElement) await fsDoc().webkitExitFullscreen?.();
  } catch {
    // Already out.
  }
}

const subscribe = (fn: () => void) => {
  document.addEventListener("fullscreenchange", fn);
  document.addEventListener("webkitfullscreenchange", fn);
  return () => {
    document.removeEventListener("fullscreenchange", fn);
    document.removeEventListener("webkitfullscreenchange", fn);
  };
};

export const useFullscreen = () => useSyncExternalStore(subscribe, () => fullscreenElement() !== null, () => false);
