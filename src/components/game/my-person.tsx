"use client";

import { BookIcon, BriefcaseIcon, PlayIcon } from "@/components/icons";
import { TRAITS, decodeLook, lookWords } from "@/components/people/look";
import { JOB_WHERE, incomeText, jobText, patchGame, requestMap, useGame } from "@/lib/game";

const fmt = (n: number) => n.toLocaleString("en");

// Your person, in the card: who they are, their money and health, and the way into the game.
export function MyPerson() {
  const { char, ready, story } = useGame();
  const look = char ? decodeLook(char.look) : null;
  const trait = char ? TRAITS[char.trait] : undefined;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="size-11 shrink-0 rounded-full ring-2 ring-zinc-900/10"
          style={{
            background: look
              ? `linear-gradient(180deg, ${look.hairColor} 0 36%, ${look.skin} 36% 68%, ${look.topColor} 68%)`
              : "linear-gradient(180deg,#e4e4e7,#d4d4d8)",
          }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">Your person</p>
          <p className="truncate text-xs text-zinc-500">
            {char && look ? `${char.age} · ${trait?.label ?? "Easy-going"} · ${lookWords(look)}` : "Getting them ready..."}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Fact label="Job" value={jobText(char?.job ?? null)} />
        <Fact label="Income" value={incomeText(char?.income ?? 0)} />
        <Fact label="Wallet" value={char ? `${fmt(char.wallet)} coins` : "..."} />
        <Fact label="Health" value={char ? `${char.health} / 100` : "..."} />
      </dl>
      <p className="mt-2.5 text-xs leading-snug text-zinc-500">
        {char?.job
          ? `Works ${char.jobKind ? JOB_WHERE[char.jobKind] : ""}${char.seat ? ` (seat #${char.seat})` : ""}. Pay goes into the wallet as they earn it.`
          : "The Job Market is open: hospital jobs go first come, first served."}{" "}
        While you&apos;re away, your person lives on their own.
      </p>
      <button
        type="button"
        onClick={() => patchGame({ jobsOpen: true })}
        className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-[transform,background-color] active:scale-[0.98] ${
          char?.job ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        <BriefcaseIcon className="size-4" />
        {char?.job ? "Job Market" : "Find a job"}
      </button>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            // Phones held upright: the map is above the card.
            window.scrollTo({ top: 0, behavior: "smooth" });
            requestMap({ type: "play", on: true });
          }}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent text-sm font-semibold text-white transition-[transform,background-color,opacity] hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
        >
          <PlayIcon className="size-4" />
          Play
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => patchGame({ storyOpen: true })}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 transition-[transform,background-color] hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60"
        >
          <BookIcon className="size-4" />
          Story
          {story.length > 0 && <span className="font-medium text-zinc-500">{story.length > 99 ? "99+" : story.length}</span>}
        </button>
      </div>
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
