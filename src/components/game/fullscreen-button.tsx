"use client";

import { useEffect, useState } from "react";
import { CloseIcon, ExpandIcon, ShareIcon, ShrinkIcon } from "@/components/icons";
import { canFullscreen, enterFullscreen, exitFullscreen, isIOS, isStandalone, useFullscreen } from "@/lib/fullscreen";

type Mode = "api" | "ios" | null;

// Full screen on and off. iPhones can't do it from a web page, so there the button explains
// Add to Home Screen instead. Left out when there's nothing to do (already an app from the home screen).
export function FullscreenButton({ variant }: { variant: "map" | "hud" }) {
  const on = useFullscreen();
  const [mode, setMode] = useState<Mode>(null);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setMode(canFullscreen() ? "api" : isIOS() ? "ios" : null);
  }, []);

  if (!mode) return null;
  const label = on ? "Exit full screen" : "Full screen";
  const look =
    variant === "hud"
      ? "size-10 bg-zinc-950/75 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] active:scale-[0.94]"
      : "size-10 bg-white/90 text-zinc-800 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] hover:bg-white active:scale-[0.97]";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (mode === "ios") return setTip((v) => !v);
          void (on ? exitFullscreen() : enterFullscreen());
        }}
        aria-label={label}
        aria-pressed={mode === "api" ? on : undefined}
        title={label}
        className={`grid place-items-center rounded-full backdrop-blur transition-[transform,background-color] duration-200 ${look}`}
      >
        {on ? <ShrinkIcon className="size-[18px]" /> : <ExpandIcon className="size-[18px]" />}
      </button>
      {tip && (
        <div
          role="dialog"
          aria-label="Play full screen on iPhone"
          className={`absolute right-0 z-40 w-[min(17rem,calc(100vw-1.5rem))] animate-rise rounded-2xl bg-white p-4 text-left text-zinc-800 shadow-[0_24px_60px_-24px_rgba(30,40,50,0.6)] ${
            variant === "hud" ? "top-12" : "bottom-12"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900">Full screen on iPhone</p>
            <button
              type="button"
              onClick={() => setTip(false)}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Safari won&apos;t hide its bars for a web page. Tap <ShareIcon className="inline size-3.5 align-[-2px]" /> Share,
            then <b>Add to Home Screen</b>, and open Lazy Films City from your home screen: it opens full screen, with no
            browser bars.
          </p>
        </div>
      )}
    </div>
  );
}
