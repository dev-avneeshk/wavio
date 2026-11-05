"use client";

import { useEffect, useState } from "react";
import { ChatIcon, ShareIcon } from "@/components/icons";
import { houseValue } from "@/components/land/spec";
import {
  BUILD_DAYS,
  DAYS_PER_INVITE,
  MIN_BUILD_DAYS,
  houseLinkPath,
  percentText,
  progressOf,
  stageOf,
  timeLeftText,
} from "@/lib/house";
import { openChat, requestFly, useSocial } from "@/lib/social";
import { shareLink, useNow } from "@/lib/use-now";
import type { MyHouse } from "@/lib/world";

const fmt = (n: number) => n.toLocaleString("en");

// Your house in the card: how far it's built and when it's done, what it's worth, your invite link
// (each friend who joins from it takes days off), and a way into the neighbour chat.
export function MyHouseStatus({ me, neighbours }: { me: MyHouse; neighbours: number }) {
  const now = useNow(30_000);
  const { unread } = useSocial();
  const [note, setNote] = useState<string | null>(null);
  const p = progressOf(me, now);
  const stage = stageOf(p);
  // Whole percents, so the server's and the browser's first render agree.
  const pct = Math.floor(p * 100);
  const doneDate = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(me.done * 1000));
  const daysNow = Math.max(MIN_BUILD_DAYS, BUILD_DAYS - DAYS_PER_INVITE * me.invites);
  // The site's address is only known in the browser; the server renders the bare path.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}${houseLinkPath(me.plot)}`;

  async function share() {
    const r = await shareLink(link, "Come be my neighbour");
    setNote(r === "copied" ? "Link copied." : r === "shared" ? null : "Copy the link above.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-zinc-900" suppressHydrationWarning>
            {stage.label}
            {p < 1 && <span className="font-normal text-zinc-500"> · {percentText(p)} built</span>}
          </span>
          <span className="text-zinc-500" suppressHydrationWarning>
            {p < 1 ? timeLeftText(me.done, now) : "Finished"}
          </span>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100"
          role="progressbar"
          suppressHydrationWarning
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Build progress"
        >
          <div
            suppressHydrationWarning
            className={`h-full rounded-full ${p >= 1 ? "bg-emerald-500" : "bg-[#F08A3C]"}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500" suppressHydrationWarning>
          {p < 1 ? `Done on ${doneDate}. ` : "Your house is finished. "}
          Stage {Math.min(stage.step, stage.steps)} of {stage.steps}: foundation, frame, walls, roof, finishing, move-in.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Value" value={`${fmt(houseValue(me.plot, p, me.waves))}`} sub="coins (in-game)" />
        <Stat label="Waves" value={fmt(me.waves)} sub="from others" />
        <Stat label="Invited" value={fmt(me.invites)} sub={me.invites === 1 ? "friend" : "friends"} />
      </dl>

      <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
        <p className="text-sm font-semibold text-amber-950">Build faster with friends</p>
        <p className="mt-0.5 text-xs leading-snug text-amber-900">
          Every friend who joins from your link takes {DAYS_PER_INVITE} days off (down to {MIN_BUILD_DAYS} days). Your build
          is {daysNow} days now.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            readOnly
            value={link}
            aria-label="Your invite link"
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-full border border-amber-200 bg-white px-3 font-mono text-xs text-zinc-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={share}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 text-xs font-semibold text-white transition-[transform,background-color] duration-200 hover:bg-zinc-800 active:scale-[0.97]"
          >
            <ShareIcon className="size-3.5" />
            Share
          </button>
        </div>
        {note && (
          <p role="status" className="mt-1.5 text-xs text-amber-900">
            {note}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openChat(null)}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.98]"
        >
          <ChatIcon className="size-4 shrink-0" />
          Neighbours
          {neighbours > 0 && <span className="font-medium text-zinc-500">{neighbours}</span>}
          {unread > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{unread}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            // Phones: the map is above the card, so bring it into view first.
            window.scrollTo({ top: 0, behavior: "smooth" });
            requestFly(me.plot);
          }}
          className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.98]"
        >
          My house
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-2.5 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[15px] font-semibold text-zinc-950">{value}</dd>
      <dd className="truncate text-[10px] text-zinc-400">{sub}</dd>
    </div>
  );
}
