"use client";

import { useState } from "react";
import { ChevronIcon } from "@/components/icons";

type ShellFrameProps = {
  map: React.ReactNode;
  header: React.ReactNode;
  top: React.ReactNode; // first row of the card (the counter), next to the collapse button
  summary: string; // one line shown when the card is collapsed
  children: React.ReactNode;
};

// The page layout: the map, the header, and the card, which can be collapsed to one line so the
// map gets the screen. The card's contents stay mounted while collapsed, so a half-typed username
// isn't lost.
export function ShellFrame({ map, header, top, summary, children }: ShellFrameProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="relative min-h-[100dvh] md:h-[100dvh] md:overflow-hidden">
      {/* Full screen behind the card on desktop; the top of the page on phones (almost all of it when collapsed). */}
      <div
        className={`relative min-h-[360px] md:absolute md:inset-0 md:h-auto ${
          collapsed ? "h-[calc(100dvh-4.5rem)]" : "h-[58dvh]"
        }`}
      >
        {map}
      </div>

      {header}

      <section
        className={`relative z-10 -mt-6 px-3 pb-6 md:absolute md:left-6 md:top-20 md:mt-0 md:px-0 md:pb-0 ${
          collapsed ? "md:w-auto md:max-w-[420px]" : "md:w-[420px]"
        }`}
      >
        <div
          id="waitlist-card"
          data-collapsed={collapsed ? "true" : undefined}
          className={`animate-rise border border-black/5 bg-white/95 shadow-[0_24px_60px_-28px_rgba(30,40,50,0.55)] backdrop-blur-md ${
            collapsed
              ? "rounded-full py-2 pl-4 pr-2"
              : "rounded-[1.75rem] p-6 md:max-h-[calc(100dvh-6.5rem)] md:overflow-y-auto"
          }`}
        >
          {collapsed && (
            <div className="flex items-center gap-3">
              <span className="size-1.5 shrink-0 animate-pulse-dot rounded-full bg-accent" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{summary}</p>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-expanded={false}
                aria-controls="waitlist-card-body"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 pl-4 pr-3 text-sm font-semibold text-white transition-[transform,background-color] duration-200 hover:bg-zinc-800 active:scale-[0.97]"
              >
                Show
                {/* Opens upwards on phones (the card sits under the map), downwards on desktop. */}
                <ChevronIcon className="size-4 md:rotate-180" />
              </button>
            </div>
          )}

          <div id="waitlist-card-body" hidden={collapsed}>
            <div className="flex items-start justify-between gap-3">
              {top}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-expanded={true}
                aria-controls="waitlist-card-body"
                aria-label="Collapse"
                title="Collapse"
                className="-mr-2 -mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.95]"
              >
                <ChevronIcon className="size-5 rotate-180 md:rotate-0" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
