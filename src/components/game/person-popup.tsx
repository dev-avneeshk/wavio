"use client";

import { useEffect } from "react";
import { ChatIcon, CloseIcon, ExternalIcon, HouseGlyph } from "@/components/icons";
import { areNeighbours } from "@/components/land/spec";
import { TRAITS, lookWords } from "@/components/people/look";
import type { PersonInfo } from "@/components/people/people";
import { incomeText, jobText } from "@/lib/game";
import { instagramUrl } from "@/lib/house";
import { site } from "@/lib/site";
import { townOf, type MyHouse } from "@/lib/world";

const fmt = (n: number) => n.toLocaleString("en");

type Props = {
  info: PersonInfo | null;
  me: MyHouse | null;
  popupRef: (el: HTMLDivElement | null) => void; // the map keeps it above the person's head
  onClose: () => void;
  onHouse: (plot: number) => void;
  onMessage: (plot: number) => void;
};

// The card over a tapped person: who they are, their job and income, what they're up to.
export function PersonPopup({ info, me, popupRef, onClose, onHouse, onMessage }: Props) {
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info, onClose]);

  const neighbour = Boolean(me && info && !info.mine && areNeighbours(me.plot, info.plot));
  const l = info?.look;

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={info ? `@${info.username}` : undefined}
      aria-hidden={info ? undefined : true}
      style={{ visibility: "hidden" }}
      className={`group absolute left-0 top-0 z-10 w-[min(272px,calc(100vw-1.5rem))] will-change-transform ${
        info ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {info && l && (
        <div className="relative rounded-[1.25rem] border border-black/5 bg-white/97 p-4 shadow-[0_18px_44px_-18px_rgba(20,30,40,0.55)] backdrop-blur">
          <div className="flex items-start gap-3">
            <span
              className="size-10 shrink-0 rounded-full ring-2 ring-zinc-900/10"
              style={{ background: `linear-gradient(180deg, ${l.hairColor} 0 36%, ${l.skin} 36% 68%, ${l.topColor} 68%)` }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <a
                href={instagramUrl(info.username)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open @${info.username} on Instagram`}
                className="flex min-w-0 items-center gap-1 font-semibold text-zinc-950 hover:underline"
              >
                <span className="truncate">@{info.username}</span>
                <ExternalIcon className="size-3.5 shrink-0 text-zinc-400" />
              </a>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                <span>
                  Lives at #{fmt(info.plot)} · {site.townName(townOf(info.plot))}
                </span>
                {info.mine ? (
                  <span className="rounded-full bg-zinc-900 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">You</span>
                ) : (
                  info.online && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      In the game
                    </span>
                  )
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-2.5 py-2 ring-1 ring-amber-200">
              <dt className="text-amber-800">Job</dt>
              <dd className="text-right text-[13px] font-semibold text-amber-950">{jobText(info.job)}</dd>
            </div>
            <Fact label="Income" value={incomeText(info.income)} />
            <Fact label="Personality" value={TRAITS[info.trait]?.label ?? "Easy-going"} />
          </dl>
          <p className="mt-2.5 text-xs leading-snug text-zinc-500">
            {info.doing ? <span className="font-semibold text-zinc-800">{info.doing}. </span> : null}
            {info.age ? `Age ${info.age}, ` : ""}
            {lookWords(l)}.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onHouse(info.plot)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-100 px-3 text-sm font-semibold text-zinc-800 transition-[transform,background-color] hover:bg-zinc-200 active:scale-[0.97]"
            >
              <HouseGlyph className="size-4" />
              Their house
            </button>
            {neighbour && (
              <button
                type="button"
                onClick={() => onMessage(info.plot)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-3 text-sm font-semibold text-white transition-[transform,background-color] hover:bg-zinc-800 active:scale-[0.97]"
              >
                <ChatIcon className="size-4" />
                Message
              </button>
            )}
          </div>

          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 hidden size-3 -translate-x-1/2 rotate-45 border-b border-r border-black/5 bg-white group-data-[arrow=down]:block"
            style={{ left: "var(--arrow-x, 50%)" }}
          />
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-2.5 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}
