"use client";

import { SpeakerIcon, SpeakerOffIcon } from "@/components/icons";
import { setSoundOn, sfx, useSoundOn } from "@/lib/sound";

// Sound on and off (remembered on this device).
export function SoundButton({ variant }: { variant: "map" | "hud" }) {
  const on = useSoundOn();
  const label = on ? "Turn sound off" : "Turn sound on";
  const look =
    variant === "hud"
      ? "size-10 bg-zinc-950/75 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] active:scale-[0.94]"
      : "size-10 bg-white/90 text-zinc-800 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] hover:bg-white active:scale-[0.97]";
  return (
    <button
      type="button"
      onClick={() => {
        setSoundOn(!on);
        if (!on) window.setTimeout(() => sfx("good", null, 0, 0.6), 60);
      }}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`grid place-items-center rounded-full backdrop-blur transition-[transform,background-color] duration-200 ${look}`}
    >
      {on ? <SpeakerIcon className="size-[18px]" /> : <SpeakerOffIcon className="size-[18px]" />}
    </button>
  );
}
