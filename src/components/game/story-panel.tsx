"use client";

import { useEffect, useState } from "react";
import { CloseIcon, PlayIcon } from "@/components/icons";
import { TRAITS, decodeLook, lookWords } from "@/components/people/look";
import {
  addStory,
  durationText,
  incomeText,
  jobText,
  patchGame,
  storyCoins,
  storyText,
  storyTone,
  useGame,
  type StoryItem,
} from "@/lib/game";
import { myStory } from "@/lib/game-api";
import { sfx } from "@/lib/sound";

const fmt = (n: number) => n.toLocaleString("en");

const timeText = (at: number) => {
  const d = new Date(at * 1000);
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("en", today ? { timeStyle: "short" } : { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);
};

const TONE = { good: "bg-emerald-500", bad: "bg-rose-500", info: "bg-zinc-300" } as const;

function StoryList({ items }: { items: StoryItem[] }) {
  if (!items.length) return <p className="px-1 py-3 text-sm text-zinc-500">Nothing yet. Give them a little while.</p>;
  return (
    <ol className="flex flex-col">
      {items.map((s) => {
        const c = storyCoins(s);
        return (
          <li key={s.id} className="flex items-start gap-3 border-b border-zinc-100 py-2.5 last:border-0">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[storyTone(s)]}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-800">{storyText(s)}</span>
            <span className="shrink-0 text-right text-[11px] leading-tight text-zinc-400">
              {timeText(s.at)}
              {c !== 0 && (
                <span className={`block font-mono font-semibold ${c > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {c > 0 ? "+" : "−"}
                  {fmt(Math.abs(c))}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    sfx("open", null, 0, 0.7);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/35 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <section
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(640px,calc(100dvh-1.5rem))] w-full max-w-[460px] animate-rise flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_30px_80px_-30px_rgba(10,20,30,0.7)]"
      >
        {children}
      </section>
    </div>
  );
}

// The first time in, and every time you come back after a while: what your person got up to.
export function AwayPanel({ username, onPlay }: { username: string; onPlay: () => void }) {
  const { away, char } = useGame();
  if (!away) return null;
  const close = () => patchGame({ away: null });
  const look = char ? decodeLook(char.look) : null;
  const trait = char ? TRAITS[char.trait] : undefined;
  const net = away.items.reduce((n, s) => n + storyCoins(s), 0);
  const fights = away.items.filter((s) => s.kind === "fight");
  const won = fights.filter((s) => s.won).length;

  return (
    <Sheet onClose={close} label={away.first ? "Meet your person" : "While you were away"}>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="size-12 shrink-0 rounded-full ring-2 ring-zinc-900/10"
            style={{ background: look ? `linear-gradient(180deg, ${look.hairColor} 0 36%, ${look.skin} 36% 68%, ${look.topColor} 68%)` : "#ddd" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {away.first ? "Meet your person" : `While you were away · ${durationText(away.seconds)}`}
            </p>
            <p className="truncate text-lg font-semibold tracking-tight text-zinc-950">@{username}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {away.first && char && look && (
          <>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Fact label="Age" value={String(char.age)} />
              <Fact label="Personality" value={trait?.label ?? "Easy-going"} />
              <Fact label="Job" value={jobText(char.job)} />
              <Fact label="Income" value={incomeText(char.income)} />
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {trait?.note} Looks: {lookWords(look)}. Nobody else in the world looks quite like them.
            </p>
            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200">
              While you&apos;re here, you control them: press <b>Play</b> and walk them around town. When you leave, they live
              on their own: chores, going to work, chatting with neighbours, and the odd fight or theft. Come back to
              see what they got up to. Get them a job at the Job Market: seats at the hospital, police station, tech
              park, fire station, school, bank and film studio go first come, first served.
            </div>
            {away.items.length > 0 && <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">So far</p>}
          </>
        )}
        {!away.first && (
          <dl className="mb-1 grid grid-cols-3 gap-2 text-sm">
            <Fact label="Coins" value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${fmt(Math.abs(net))}`} />
            <Fact label="Fights" value={fights.length ? `${won} won, ${fights.length - won} lost` : "None"} />
            <Fact label="Wallet now" value={char ? fmt(char.wallet) : "..."} />
          </dl>
        )}
        {(!away.first || away.items.length > 0) && <StoryList items={away.items} />}
      </div>

      <footer className="flex gap-2 border-t border-zinc-100 px-5 py-3">
        <button
          type="button"
          onClick={close}
          className="h-11 flex-1 rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 active:scale-[0.98]"
        >
          Look around
        </button>
        <button
          type="button"
          onClick={() => {
            close();
            onPlay();
          }}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent text-sm font-semibold text-white hover:bg-accent-deep active:scale-[0.98]"
        >
          <PlayIcon className="size-4" />
          Play
        </button>
      </footer>
    </Sheet>
  );
}

// Everything your person did and had done to them, newest first.
export function StoryPanel() {
  const { story, storyOpen } = useGame();
  const [busy, setBusy] = useState(false);
  const [end, setEnd] = useState(false);
  if (!storyOpen) return null;
  const close = () => patchGame({ storyOpen: false });

  async function older() {
    const last = story[story.length - 1];
    setBusy(true);
    const r = await myStory(last?.at);
    setBusy(false);
    if (!r.ok) return;
    if (!r.data.length) setEnd(true);
    addStory(r.data);
  }

  return (
    <Sheet onClose={close} label="Your story">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <p className="text-lg font-semibold tracking-tight text-zinc-950">Your story</p>
          <p className="text-xs text-zinc-500">What your person did, and what was done to them.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="-mr-1.5 grid size-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <StoryList items={story} />
        {!end && story.length > 0 && (
          <button
            type="button"
            onClick={older}
            disabled={busy}
            className="mt-2 h-9 w-full rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-60"
          >
            {busy ? "Loading..." : "Show older"}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-2.5 py-2">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}
