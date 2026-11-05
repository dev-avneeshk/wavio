"use client";

import { site } from "@/lib/site";
import { setChosenPlot, useChosenPlot } from "@/lib/plot-choice";
import { townOf } from "@/lib/world";

// "You picked plot #N" (with a way back to the next free plot), or a hint that you can pick one.
export function PlotChoiceNote({ nextPlot }: { nextPlot: number }) {
  const chosen = useChosenPlot();

  if (chosen === null) {
    return (
      <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm leading-snug text-zinc-600">
        Your house goes on plot #{nextPlot.toLocaleString("en")}. Want a different spot? Tap any empty plot on the map.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900 ring-1 ring-amber-200">
      <p>
        You picked plot <span className="font-semibold">#{chosen.toLocaleString("en")}</span> in{" "}
        {site.townName(townOf(chosen))}.
      </p>
      <button
        type="button"
        onClick={() => setChosenPlot(null)}
        className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:bg-amber-100"
      >
        Use #{nextPlot.toLocaleString("en")}
      </button>
    </div>
  );
}
