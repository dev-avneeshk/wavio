"use client";

import { useEffect } from "react";
import { emittersOf } from "@/components/game/places";
import type { Senses } from "@/components/land/engine";
import { townCenter } from "@/components/land/layout";
import { KIOSK, surfaceAt } from "@/components/people/nav";
import { getSkyPicks, skyAt } from "@/lib/sky";
import { pauseAudio, sfx, unlock, updateAmbience } from "@/lib/sound";

// Runs the game's sound: starts it on the first tap or key press, ticks on buttons, your footsteps
// while you play, and the ambience for wherever the camera (or your person) is.
export function SoundDirector({ senses }: { senses: () => Senses | null }) {
  useEffect(() => {
    const start = () => unlock();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", start, opts);
    window.addEventListener("keydown", start, opts);
    window.addEventListener("touchend", start, opts);
    // A soft tick on every button (the map's own taps are handled by the engine).
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && !(b as HTMLButtonElement).disabled) sfx("tick", null, 0, 0.7);
    };
    document.addEventListener("click", onClick, true);
    const onVis = () => pauseAudio(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);

    let sky = skyAt(Date.now(), getSkyPicks());
    let skyAtMs = Date.now();
    let lastDist: number | null = null;
    let stride = 0;
    const id = window.setInterval(() => {
      const s = senses();
      if (!s) return;
      if (Date.now() - skyAtMs > 3000) {
        sky = skyAt(Date.now(), getSkyPicks());
        skyAtMs = Date.now();
      }
      // Footsteps: one every so many metres walked, softer on grass.
      const p = s.player;
      if (p && p.speed > 0.3) {
        if (lastDist !== null) stride += Math.max(0, p.dist - lastDist);
        const len = p.speed > 3.6 ? 1.05 : p.speed > 2.3 ? 0.85 : 0.68;
        if (stride >= len) {
          stride %= len;
          const soft = s.zone !== "town" || surfaceAt(s.town, p.x, p.z) === "soft";
          sfx(soft ? "stepSoft" : "stepHard", null, 0, p.speed > 3.6 ? 0.8 : 0.6);
        }
      } else stride = 0.5;
      lastDist = p ? p.dist : null;

      const [ox, oz] = s.town ? townCenter(s.town) : [0, 0];
      updateAmbience({
        ears: { x: s.x, z: s.z, rx: -s.fz, rz: s.fx, height: s.player ? 2 : s.height },
        zone: s.zone,
        far: !s.town || s.dist > 650,
        night: sky.part === "night",
        rain: sky.rain,
        plaza: s.town ? { x: ox, z: oz } : null,
        kiosk: s.town ? { x: ox + KIOSK.x, z: oz + KIOSK.z } : null,
        site: s.site,
        emitters: s.town ? emittersOf(s.town) : [],
      });
    }, 50);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", start, opts);
      window.removeEventListener("keydown", start, opts);
      window.removeEventListener("touchend", start, opts);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [senses]);
  return null;
}
