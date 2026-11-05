"use client";

import { useEffect, useState } from "react";

// Touch screens. Some phones (Samsung phones with a stylus, some in-app browsers) say their main
// pointer is a mouse, so "(pointer: coarse)" alone misses them; any touch support counts here.
export const hasTouch = () =>
  navigator.maxTouchPoints > 0 || "ontouchstart" in window || window.matchMedia("(any-pointer: coarse)").matches;

// Phones (not touch laptops): a touch screen whose short side is phone-sized.
export const isPhone = () => hasTouch() && Math.min(window.screen.width, window.screen.height) <= 600;

// Phones held sideways, told apart by shape alone (for the same reason). Keep in step with the
// phone-land variant in globals.css.
export const PHONE_LAND = "(orientation: landscape) and (max-height: 540px)";

// True on touch screens. Also turns on at the first touch, in case the checks above missed it.
export function useTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (hasTouch()) {
      setTouch(true);
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") setTouch(true);
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);
  return touch;
}
