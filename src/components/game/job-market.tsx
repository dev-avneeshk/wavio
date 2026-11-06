"use client";

import { useCallback, useEffect, useState } from "react";
import { BriefcaseIcon, CloseIcon, CupIcon, HardHatIcon, MedicIcon } from "@/components/icons";
import { Sheet } from "@/components/game/story-panel";
import { JOB_PLACE, patchGame, toast, useGame, type JobKind, type MyChar } from "@/lib/game";
import { jobMarket, quitJob, takeJob, type JobMarket as Market } from "@/lib/game-api";

const fmt = (n: number) => n.toLocaleString("en");

type Props = {
  onHired: (char: MyChar) => void; // your new job (or none, after quitting)
  onShow: (plot: number) => void; // fly to someone's house
};

// The Job Market: first come, first served. The hospital's seats run out; the building sites and
// odd jobs always hire. Opened from the map, the game and your person's card (patchGame jobsOpen).
export function JobMarket({ onHired, onShow }: Props) {
  const { jobsOpen } = useGame();
  const [m, setM] = useState<Market | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<JobKind | "quit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await jobMarket();
    if (r.ok) {
      setM(r.data);
      setFailed(false);
    } else setFailed(true);
  }, []);

  // While it's open: the seats left, kept fresh (other people are applying too).
  useEffect(() => {
    if (!jobsOpen) return;
    setError(null);
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => window.clearInterval(id);
  }, [jobsOpen, load]);

  if (!jobsOpen) return null;
  const close = () => patchGame({ jobsOpen: false });
  const mine = m?.mine ?? null;

  async function apply(kind: JobKind) {
    if (mine?.kind === "hospital" && kind !== "hospital" && mine.seat) {
      const ok = window.confirm(`Leave seat #${mine.seat} at the hospital? Someone else can take it straight away.`);
      if (!ok) return;
    }
    setBusy(kind);
    setError(null);
    const r = await takeJob(kind);
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      void load();
      return;
    }
    onHired(r.data);
    toast(`You're hired: ${r.data.job ?? JOB_PLACE[kind]}. ${fmt(r.data.income)} coins a day.`, "good");
    void load();
  }

  async function quit() {
    if (!window.confirm(mine?.seat ? `Quit, and give up seat #${mine.seat} at the hospital?` : "Quit your job?")) return;
    setBusy("quit");
    setError(null);
    const r = await quitJob();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onHired(r.data);
    toast("You quit. Your person is looking for work again.", "info");
    void load();
  }

  const h = m?.hospital;
  const full = h ? h.open <= 0 : false;
  const canApply = m?.member === true;

  return (
    <Sheet onClose={close} label="Job Market">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white">
            <BriefcaseIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-zinc-950">Job Market</p>
            <p className="text-xs text-zinc-500">First come, first served. Pay drops into your wallet as you earn it.</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {!m && !failed && <p className="py-6 text-center text-sm text-zinc-500">Opening the Job Market...</p>}
        {!m && failed && (
          <p className="py-6 text-center text-sm text-zinc-500">
            Couldn&apos;t load the jobs.{" "}
            <button type="button" onClick={() => void load()} className="font-semibold text-zinc-900 underline underline-offset-2">
              Try again
            </button>
          </p>
        )}

        {m && h && (
          <div className="flex flex-col gap-3">
            {mine && (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Your job</p>
                  <p className="truncate text-sm font-semibold text-emerald-950">{mine.title}</p>
                  <p className="text-xs text-emerald-800">
                    {JOB_PLACE[mine.kind]}
                    {mine.seat ? ` · seat #${mine.seat}` : ""} · {fmt(mine.pay)} coins/day
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void quit()}
                  disabled={busy !== null}
                  className="h-9 shrink-0 rounded-full bg-white px-3.5 text-xs font-semibold text-zinc-700 ring-1 ring-emerald-200 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {busy === "quit" ? "..." : "Quit"}
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}

            {/* The hospital: the jobs everyone wants, while they last. */}
            <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-accent ring-1 ring-rose-100">
                  <MedicIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-950">Doctor at the {JOB_PLACE.hospital}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        full ? "bg-zinc-100 text-zinc-500" : h.open <= 10 ? "bg-accent text-white" : "bg-rose-50 text-accent"
                      }`}
                    >
                      {full ? "Full" : `${fmt(h.open)} of ${fmt(h.total)} left`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    The craziest jobs in town. The earlier you apply, the better the seat: #1 pays the most.
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${h.total ? ((h.total - h.open) / h.total) * 100 : 0}%` }} />
              </div>
              {h.next && mine?.kind !== "hospital" && (
                <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  Next up: <b className="text-zinc-900">#{h.next.seat} {h.next.title}</b> · {fmt(h.next.pay)} coins/day
                </p>
              )}
              <JobButton
                strong
                kind="hospital"
                busy={busy}
                canApply={canApply}
                disabled={full}
                current={mine?.kind === "hospital"}
                label={full ? "No seats left" : mine ? "Switch to the hospital" : "Become a doctor"}
                onApply={apply}
              />
            </section>

            {/* Everyone else: always hiring. */}
            {(["labour", "odd"] as const).map((kind) => {
              const g = m[kind];
              const Icon = kind === "labour" ? HardHatIcon : CupIcon;
              return (
                <section key={kind} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-950">{kind === "labour" ? "Labourer on the building sites" : "Odd jobs round town"}</p>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">Always hiring</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {kind === "labour"
                          ? "Brick Juggler, Scaffolding Monkey, Cement Mixer Whisperer and more."
                          : "Chai Wallah, Mango Seller, Walker of Seven Dogs and more."}{" "}
                        {fmt(g.low)} to {fmt(g.high)} coins/day · {fmt(g.workers)} {g.workers === 1 ? "person works" : "people work"} here.
                      </p>
                    </div>
                  </div>
                  <JobButton
                    kind={kind}
                    busy={busy}
                    canApply={canApply}
                    current={mine?.kind === kind}
                    label={mine ? (kind === "labour" ? "Switch to labour" : "Switch to odd jobs") : kind === "labour" ? "Work as a labourer" : "Do odd jobs"}
                    onApply={apply}
                  />
                </section>
              );
            })}

            {!canApply && (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-600">
                Get your free house first: only people with a house can take a job.
              </p>
            )}

            <section>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Hospital staff {h.staff.length > 0 && <span className="font-medium normal-case text-zinc-400">· {h.staff.length} hired</span>}
              </p>
              {h.staff.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">Nobody yet. Seat #1 is up for grabs.</p>
              ) : (
                <ol className="mt-1 flex flex-col">
                  {h.staff.map((s) => (
                    <li key={s.seat}>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          onShow(s.plot);
                        }}
                        className="flex w-full items-center gap-3 border-b border-zinc-100 py-2 text-left last:border-0 hover:bg-zinc-50"
                      >
                        <span className="w-7 shrink-0 font-mono text-xs font-semibold text-zinc-400">#{s.seat}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-900">{s.title}</span>
                          <span className="block truncate text-xs text-zinc-500">@{s.username}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-emerald-700">{fmt(s.pay)}/day</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function JobButton({
  kind,
  label,
  busy,
  canApply,
  disabled,
  current,
  strong,
  onApply,
}: {
  kind: JobKind;
  label: string;
  busy: JobKind | "quit" | null;
  canApply: boolean;
  disabled?: boolean;
  current: boolean;
  strong?: boolean;
  onApply: (kind: JobKind) => void;
}) {
  if (current) {
    return <p className="mt-3 text-center text-xs font-semibold text-emerald-700">You work here</p>;
  }
  return (
    <button
      type="button"
      onClick={() => onApply(kind)}
      disabled={!canApply || disabled || busy !== null}
      className={`mt-3 h-11 w-full rounded-full text-sm font-semibold transition-[transform,background-color,opacity] active:scale-[0.98] disabled:opacity-50 ${
        strong ? "bg-accent text-white hover:bg-accent-deep" : "bg-zinc-900 text-white hover:bg-zinc-800"
      }`}
    >
      {busy === kind ? "Applying..." : label}
    </button>
  );
}
