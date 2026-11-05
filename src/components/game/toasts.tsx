"use client";

import { useGame } from "@/lib/game";

const TONE = {
  good: "bg-emerald-600 text-white",
  bad: "bg-rose-600 text-white",
  info: "bg-zinc-900/90 text-white",
} as const;

// Short notes at the top of the map ("@x stole 12 coins from you").
export function GameToasts() {
  const { toasts } = useGame();
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-16 z-30 flex flex-col items-center gap-1.5 px-3 md:top-20"
    >
      {toasts.map((t) => (
        <p
          key={t.id}
          className={`max-w-[min(92vw,420px)] animate-rise rounded-full px-4 py-2 text-center text-sm font-semibold shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] ${TONE[t.tone]}`}
        >
          {t.text}
        </p>
      ))}
    </div>
  );
}
