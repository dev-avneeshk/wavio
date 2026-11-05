"use client";

import { useEffect, useRef, useState } from "react";
import { LandEngine } from "./engine";

export type LandProps = {
  names: string[];
  mine: number | null;
  mineName: string | null;
};

// The page card covers the left side of the map on wide screens; tell the camera how much.
const cardInset = () => {
  if (window.innerWidth < 768) return 0;
  const card = document.getElementById("waitlist-card");
  return card ? card.getBoundingClientRect().right + 16 : 0;
};

export default function LandView({ names, mine, mineName }: LandProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LandEngine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: LandEngine;
    try {
      engine = new LandEngine(host, { leftInset: cardInset });
    } catch (error) {
      console.error("[land] WebGL unavailable:", error);
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setData(names, mine, mineName);
  }, [names, mine, mineName]);

  if (failed) return <LandFallback />;

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0 touch-none select-none" />
      <div className="pointer-events-none absolute inset-x-3 bottom-9 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6">
        <p className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] backdrop-blur md:ml-auto md:block">
          Drag to move. Right-drag to turn. Scroll to zoom.
        </p>
        <div className="pointer-events-auto ml-auto flex gap-2 md:ml-0">
          <MapButton onClick={() => engineRef.current?.flyToOverview()}>Whole city</MapButton>
          <MapButton strong onClick={() => engineRef.current?.flyToFocus()}>
            {mine ? "See my house" : `Plot #${names.length + 1}`}
          </MapButton>
        </div>
      </div>
    </div>
  );
}

function MapButton({ children, onClick, strong }: { children: React.ReactNode; onClick: () => void; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-full px-4 text-sm font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,background-color] duration-200 active:scale-[0.97] ${
        strong ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white/90 text-zinc-800 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export function LandFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,#93C0E6_0%,#DDE8EE_45%,#93CD66_46%,#86C95A_100%)] p-6 text-center">
      <p className="max-w-xs rounded-2xl bg-white/85 px-4 py-3 text-sm text-zinc-700">
        The 3D city needs WebGL, which this browser has turned off. You can still join the waitlist.
      </p>
    </div>
  );
}
