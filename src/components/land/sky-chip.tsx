"use client";

import { useEffect, useRef, useState } from "react";
import { MoonIcon, RainIcon, SnowIcon, SunIcon, SunsetIcon } from "@/components/icons";
import {
  PARTS,
  PART_NAME,
  SEASON_NAME,
  WEATHER_NAME,
  clockText,
  setSkyPicks,
  skyAt,
  useSkyPicks,
  type SkyState,
  type TimePick,
  type WeatherPick,
} from "@/lib/sky";
import { useNow } from "@/lib/use-now";

const TIME_OPTIONS: { v: TimePick; label: string }[] = [{ v: "live", label: "Live" }, ...PARTS.map((p) => ({ v: p as TimePick, label: PART_NAME[p] }))];
const WEATHER_OPTIONS: { v: WeatherPick; label: string }[] = [
  { v: "live", label: "Live" },
  { v: "clear", label: "Clear" },
  { v: "rain", label: "Rain" },
  { v: "winter", label: "Winter" },
];

const iconFor = (s: SkyState) =>
  s.weather === "rain" ? RainIcon : s.weather === "snow" ? SnowIcon : s.part === "night" ? MoonIcon : s.part === "evening" ? SunsetIcon : SunIcon;

// The sky over the towns follows the time in India. This pill shows it, and opens a picker to look
// at another time of day or weather (on this screen only).
export function SkyChip({ className = "" }: { className?: string }) {
  const picks = useSkyPicks();
  const now = useNow(15_000);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const s = skyAt(now * 1000, picks);
  const live = skyAt(now * 1000, { time: "live", weather: "live" });
  const previewing = picks.time !== "live" || picks.weather !== "live";
  const Icon = iconFor(s);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const liveWeather = live.realWeather === "clear" ? (live.part === "night" ? "clear night" : "clear skies") : live.realWeather === "rain" ? "raining" : "snowing";

  return (
    <div ref={ref} className={`pointer-events-auto ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Sky: ${PART_NAME[s.part]}, ${WEATHER_NAME[s.weather]}. Change time of day or weather`}
        title="Time of day and weather (India time)"
        className={`flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full pl-3 pr-3.5 text-sm font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,background-color] duration-200 active:scale-[0.97] ${
          s.part === "night" ? "bg-zinc-900/85 text-white hover:bg-zinc-900" : "bg-white/90 text-zinc-800 hover:bg-white"
        }`}
      >
        <Icon className="size-[18px]" />
        <span className="tabular-nums">{previewing && picks.time !== "live" ? PART_NAME[s.part] : clockText(s.realHour)}</span>
        <span className={`hidden text-xs font-medium sm:inline ${s.part === "night" ? "text-white/60" : "text-zinc-500"}`}>
          {previewing ? "preview" : "IST"}
        </span>
        {previewing && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(19rem,calc(100vw-1.5rem))] animate-rise rounded-2xl border border-black/5 bg-white/95 p-4 text-zinc-800 shadow-[0_24px_60px_-24px_rgba(30,40,50,0.6)] backdrop-blur-md">
          <p className="text-sm font-semibold text-zinc-900">Sky over the towns</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Follows the time in India. Now: {PART_NAME[live.realPart].toLowerCase()}, {clockText(live.realHour)} IST, {SEASON_NAME[live.season].toLowerCase()},{" "}
            {liveWeather}.
          </p>
          <Choice label="Time of day" options={TIME_OPTIONS} value={picks.time} onPick={(v) => setSkyPicks({ time: v as TimePick })} />
          <Choice label="Weather" options={WEATHER_OPTIONS} value={picks.weather} onPick={(v) => setSkyPicks({ weather: v as WeatherPick })} />
          {previewing ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
              <p className="text-xs text-zinc-500">Only you see this. Everyone else has the live sky.</p>
              <button
                type="button"
                onClick={() => setSkyPicks({ time: "live", weather: "live" })}
                className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Back to live
              </button>
            </div>
          ) : (
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
              Winter (Dec to Feb) brings snow, the monsoon (Jun to Sep) brings rain, and street lamps come on at sunset.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { v: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v)}
            aria-pressed={value === o.v}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.96] ${
              value === o.v ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
