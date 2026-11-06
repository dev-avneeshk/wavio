"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import {
  BadgeIcon,
  BankIcon,
  BriefcaseIcon,
  CapIcon,
  ClapperIcon,
  CloseIcon,
  CupIcon,
  FlameIcon,
  GearIcon,
  HardHatIcon,
  MedicIcon,
} from "@/components/icons";
import { Sheet } from "@/components/game/story-panel";
import { JOB_INFO, JOB_PLACE, patchGame, toast, useGame, type JobKind, type MyChar } from "@/lib/game";
import { jobMarket, quitJob, takeJob, type JobMarket as Market, type Place } from "@/lib/game-api";

const fmt = (n: number) => n.toLocaleString("en");

type Props = {
  onHired: (char: MyChar) => void; // your new job (or none, after quitting)
  onShow: (plot: number) => void; // fly to someone's house
};

type Busy = JobKind | "quit" | null;

const ICONS: Record<JobKind, (p: { className?: string }) => ReactElement> = {
  hospital: MedicIcon,
  police: BadgeIcon,
  engineer: GearIcon,
  fire: FlameIcon,
  school: CapIcon,
  bank: BankIcon,
  film: ClapperIcon,
  labour: HardHatIcon,
  odd: CupIcon,
};

// Colours per workplace (whole class names, so Tailwind keeps them).
const TONES: Record<JobKind, { tile: string; bar: string; badge: string }> = {
  hospital: { tile: "bg-rose-50 text-rose-600 ring-rose-100", bar: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
  police: { tile: "bg-blue-50 text-blue-700 ring-blue-100", bar: "bg-blue-600", badge: "bg-blue-50 text-blue-800" },
  engineer: { tile: "bg-cyan-50 text-cyan-700 ring-cyan-100", bar: "bg-cyan-600", badge: "bg-cyan-50 text-cyan-800" },
  fire: { tile: "bg-orange-50 text-orange-600 ring-orange-100", bar: "bg-orange-500", badge: "bg-orange-50 text-orange-800" },
  school: { tile: "bg-yellow-50 text-yellow-700 ring-yellow-100", bar: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-800" },
  bank: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", bar: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-800" },
  film: { tile: "bg-violet-50 text-violet-700 ring-violet-100", bar: "bg-violet-600", badge: "bg-violet-50 text-violet-800" },
  labour: { tile: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", badge: "bg-amber-50 text-amber-800" },
  odd: { tile: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", badge: "bg-amber-50 text-amber-800" },
};

// The Job Market: first come, first served. The workplaces' seats run out; the building sites and
// odd jobs always hire. Opened from the map, the game, your person's card and by tapping a
// workplace in town (patchGame jobsOpen, jobsFocus).
export function JobMarket({ onHired, onShow }: Props) {
  const { jobsOpen, jobsFocus } = useGame();
  const [m, setM] = useState<Market | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffOf, setStaffOf] = useState<JobKind | null>(null);
  const cards = useRef(new Map<JobKind, HTMLElement>());
  const loaded = m !== null;

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

  // Opened by tapping a workplace: that one comes into view, with its staff.
  useEffect(() => {
    if (!jobsOpen || !jobsFocus || !loaded) return;
    setStaffOf(jobsFocus);
    const id = window.setTimeout(() => cards.current.get(jobsFocus)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => window.clearTimeout(id);
  }, [jobsOpen, jobsFocus, loaded]);

  if (!jobsOpen) return null;
  const close = () => patchGame({ jobsOpen: false, jobsFocus: null });
  const mine = m?.mine ?? null;
  const canApply = m?.member === true;

  async function apply(kind: JobKind) {
    if (mine?.seat && kind !== mine.kind) {
      const ok = window.confirm(`Leave seat #${mine.seat} at the ${JOB_PLACE[mine.kind]}? Someone else can take it straight away.`);
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
    if (!window.confirm(mine?.seat ? `Quit, and give up seat #${mine.seat} at the ${JOB_PLACE[mine.kind]}?` : "Quit your job?")) return;
    setBusy("quit");
    setError(null);
    const r = await quitJob();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onHired(r.data);
    toast("You quit. Your person is looking for work again.", "info");
    void load();
  }

  const seatsLeft = m ? m.places.reduce((s, p) => s + Math.max(0, p.open), 0) : 0;
  const keep = (kind: JobKind) => (el: HTMLElement | null) => {
    if (el) cards.current.set(kind, el);
    else cards.current.delete(kind);
  };

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

        {m && (
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

            {!canApply && (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-600">
                Get your free house first: only people with a house can take a job.
              </p>
            )}

            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Workplaces <span className="font-medium normal-case text-zinc-400">· {fmt(seatsLeft)} seats left · the earlier, the better the seat</span>
            </p>

            {/* The workplaces: the jobs everyone wants, while they last. */}
            {m.places.map((p) => (
              <PlaceCard
                key={p.kind}
                place={p}
                cardRef={keep(p.kind)}
                focused={jobsFocus === p.kind}
                mine={mine?.kind === p.kind}
                hasJob={mine !== null}
                busy={busy}
                canApply={canApply}
                staffOpen={staffOf === p.kind}
                onStaff={() => setStaffOf((s) => (s === p.kind ? null : p.kind))}
                onApply={apply}
                onShow={(plot) => {
                  close();
                  onShow(plot);
                }}
              />
            ))}

            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Always hiring</p>

            {(["labour", "odd"] as const).map((kind) => {
              const g = m[kind];
              const Icon = ICONS[kind];
              const info = JOB_INFO[kind];
              return (
                <section key={kind} ref={keep(kind)} className="scroll-mt-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="flex items-start gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${TONES[kind].tile}`}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-950">{kind === "labour" ? "Labourer on the building sites" : info.role}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONES[kind].badge}`}>Always hiring</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {info.blurb} {fmt(g.low)} to {fmt(g.high)} coins/day · {fmt(g.workers)} {g.workers === 1 ? "person works" : "people work"} here.
                      </p>
                    </div>
                  </div>
                  <JobButton
                    kind={kind}
                    busy={busy}
                    canApply={canApply}
                    current={mine?.kind === kind}
                    label={mine ? info.switchTo : info.apply}
                    onApply={apply}
                  />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function PlaceCard({
  place: p,
  cardRef,
  focused,
  mine,
  hasJob,
  busy,
  canApply,
  staffOpen,
  onStaff,
  onApply,
  onShow,
}: {
  place: Place;
  cardRef: (el: HTMLElement | null) => void;
  focused: boolean;
  mine: boolean;
  hasJob: boolean;
  busy: Busy;
  canApply: boolean;
  staffOpen: boolean;
  onStaff: () => void;
  onApply: (kind: JobKind) => void;
  onShow: (plot: number) => void;
}) {
  const info = JOB_INFO[p.kind];
  const tone = TONES[p.kind];
  const Icon = ICONS[p.kind];
  const full = p.open <= 0;
  const taken = p.total - p.open;
  return (
    <section
      ref={cardRef}
      className={`scroll-mt-2 rounded-2xl bg-white p-4 ring-1 transition-shadow ${focused ? "ring-2 ring-zinc-900" : "ring-zinc-200"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${tone.tile}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-semibold leading-snug text-zinc-950">
              {info.role} <span className="font-medium text-zinc-500">· {info.place}</span>
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                full ? "bg-zinc-100 text-zinc-500" : p.open <= 10 ? "bg-zinc-900 text-white" : tone.badge
              }`}
            >
              {full ? "Full" : `${fmt(p.open)} of ${fmt(p.total)} left`}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{info.blurb}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${p.total ? (taken / p.total) * 100 : 0}%` }} />
      </div>
      {p.next && !mine && (
        <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Next up: <b className="text-zinc-900">#{p.next.seat} {p.next.title}</b> · {fmt(p.next.pay)} coins/day
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <JobButton
            kind={p.kind}
            busy={busy}
            canApply={canApply}
            disabled={full}
            current={mine}
            label={full ? "No seats left" : hasJob ? info.switchTo : info.apply}
            onApply={onApply}
            flush
          />
        </div>
        <button
          type="button"
          onClick={onStaff}
          aria-expanded={staffOpen}
          className="h-11 shrink-0 rounded-full bg-zinc-100 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
        >
          Staff · {fmt(taken)}
        </button>
      </div>
      {staffOpen && (
        <div className="mt-3">
          {p.staff.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nobody yet. {p.top ? `Seat #1, ${p.top.title}, is up for grabs.` : "Seat #1 is up for grabs."}
            </p>
          ) : (
            <ol className="flex flex-col">
              {p.staff.map((s) => (
                <li key={s.seat}>
                  <button
                    type="button"
                    onClick={() => onShow(s.plot)}
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
        </div>
      )}
    </section>
  );
}

function JobButton({
  kind,
  label,
  busy,
  canApply,
  disabled,
  current,
  flush,
  onApply,
}: {
  kind: JobKind;
  label: string;
  busy: Busy;
  canApply: boolean;
  disabled?: boolean;
  current: boolean;
  flush?: boolean; // no gap above (it sits in a row)
  onApply: (kind: JobKind) => void;
}) {
  if (current) {
    return <p className={`${flush ? "" : "mt-3 "}py-3 text-center text-xs font-semibold text-emerald-700`}>You work here</p>;
  }
  return (
    <button
      type="button"
      onClick={() => onApply(kind)}
      disabled={!canApply || disabled || busy !== null}
      className={`${flush ? "" : "mt-3 "}h-11 w-full rounded-full bg-zinc-900 text-sm font-semibold text-white transition-[transform,background-color,opacity] hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50`}
    >
      {busy === kind ? "Applying..." : label}
    </button>
  );
}
