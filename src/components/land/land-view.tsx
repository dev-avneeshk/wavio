"use client";

import { useEffect, useRef, useState } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { site } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { TOWN_SIZE, nextPlot, parseWorldView, type WorldView } from "@/lib/world";
import { LandEngine, type ViewInfo } from "./engine";

export type LandProps = {
  view: WorldView;
};

// The page card covers the left side of the map on wide screens; tell the camera how much.
const cardInset = () => {
  if (window.innerWidth < 768) return 0;
  const card = document.getElementById("waitlist-card");
  return card ? card.getBoundingClientRect().right + 16 : 0;
};

// Another town's houses, fetched when you move the camera there.
const loadTown = async (town: number): Promise<WorldView | null> => {
  if (!hasSupabaseEnv) return null;
  const { data, error } = await createClient().rpc("waitlist_world", { p_town: town });
  if (error) {
    console.error("[land] loading town failed:", error.code, error.message);
    return null;
  }
  return parseWorldView(data);
};

const fmt = (n: number) => n.toLocaleString("en");

export default function LandView({ view }: LandProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LandEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const [info, setInfo] = useState<ViewInfo | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: LandEngine;
    try {
      engine = new LandEngine(host, { leftInset: cardInset, loadTown, onView: setInfo });
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
    engineRef.current?.setData(view);
  }, [view]);

  if (failed) return <LandFallback />;

  // Zoomed out over the world there's no single town to name; tapping a town flies there instead.
  const townLabel =
    !info || info.zoomedOut
      ? null
      : info.loading
        ? "Loading..."
        : info.town > info.open
          ? `${site.townName(info.town)} · empty`
          : `${site.townName(info.town)} · ${fmt(info.houses)}/${fmt(TOWN_SIZE)}`;

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0 touch-none select-none" />
      <div className="pointer-events-none absolute inset-x-3 bottom-9 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6">
        <p className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] backdrop-blur md:ml-auto md:block">
          {info?.zoomedOut ? "Tap a town to fly there." : "Drag to move. Right-drag to turn. Zoom out to see every town."}
        </p>
        <div className="pointer-events-auto ml-auto flex flex-wrap justify-end gap-2 md:ml-0">
          {info && townLabel && (
            <MapButton onClick={() => void engineRef.current?.flyToTown(info.town)} label={`Show all of ${site.townName(info.town)}`}>
              {townLabel}
            </MapButton>
          )}
          <MapButton onClick={() => engineRef.current?.flyToWorld()} label="Show every town">
            World
          </MapButton>
          <MapButton strong onClick={() => void engineRef.current?.flyToFocus()}>
            {view.me ? "My house" : `Plot #${fmt(nextPlot(view))}`}
          </MapButton>
        </div>
      </div>
    </div>
  );
}

function MapButton({
  children,
  onClick,
  strong,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  strong?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,background-color] duration-200 active:scale-[0.97] ${
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
        The 3D map needs WebGL, which this browser has turned off. You can still join the waitlist.
      </p>
    </div>
  );
}
