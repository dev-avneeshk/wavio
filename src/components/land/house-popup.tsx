"use client";

import { useEffect, useRef, useState } from "react";
import { ChatIcon, CloseIcon, ExternalIcon, ShareIcon, WaveIcon } from "@/components/icons";
import { houseLinkPath, instagramUrl, percentText, progressOf, stageOf, timeLeftText } from "@/lib/house";
import { site } from "@/lib/site";
import { waveHouse } from "@/lib/social-api";
import { shareLink, useNow } from "@/lib/use-now";
import type { MyHouse } from "@/lib/world";
import type { Selection } from "./engine";
import { areNeighbours, houseValue } from "./spec";

const fmt = (n: number) => n.toLocaleString("en");

type HousePopupProps = {
  sel: Selection | null;
  me: MyHouse | null;
  signedIn: boolean;
  // The engine moves this element to sit above the house.
  popupRef: (el: HTMLDivElement | null) => void;
  onClose: () => void;
  onMessage: (plot: number) => void;
  onWaved: (plot: number, waves: number) => void;
};

// The card over a tapped house: whose it is (tap the name for their Instagram), how far it's built,
// what it's worth, and buttons to wave, message (neighbours only) and share.
export function HousePopup({ sel, me, signedIn, popupRef, onClose, onMessage, onWaved }: HousePopupProps) {
  const now = useNow(30_000);
  const [note, setNote] = useState<string | null>(null);
  const [waving, setWaving] = useState(false);
  const plot = sel?.house.plot ?? 0;
  const lastPlot = useRef(0);

  // A different house: clear the last note.
  useEffect(() => {
    if (plot !== lastPlot.current) {
      lastPlot.current = plot;
      setNote(null);
    }
  }, [plot]);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, onClose]);

  const house = sel?.house;
  const p = house ? progressOf(house, now) : 0;
  const stage = stageOf(p);
  const neighbour = Boolean(me && house && areNeighbours(me.plot, house.plot));

  async function wave() {
    if (!house || waving) return;
    setWaving(true);
    const r = await waveHouse(house.plot);
    setWaving(false);
    if (!r.ok) return setNote(r.error);
    onWaved(house.plot, r.data.waves);
    setNote(r.data.counted ? `You waved at @${house.username}.` : "You already waved at this house today.");
  }

  async function share() {
    if (!house) return;
    const url = `${window.location.origin}${houseLinkPath(house.plot)}`;
    const r = await shareLink(url, sel?.mine ? "Come be my neighbour" : `@${house.username}'s house`);
    if (r === "copied") setNote(sel?.mine ? "Invite link copied. Friends who join from it speed up your build." : "Link copied.");
    else if (r === "failed") setNote(url);
  }

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={house ? `House #${fmt(house.plot)}, @${house.username}` : undefined}
      aria-hidden={sel ? undefined : true}
      style={{ visibility: "hidden" }}
      className={`group absolute left-0 top-0 z-10 w-[min(284px,calc(100vw-1.5rem))] will-change-transform ${
        sel ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {house && sel && (
        <div className="relative rounded-[1.25rem] border border-black/5 bg-white/97 p-4 shadow-[0_18px_44px_-18px_rgba(20,30,40,0.55)] backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-base font-bold uppercase text-white">
              {house.username.replace(/[^a-z0-9]/g, "").slice(0, 1) || "@"}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={instagramUrl(house.username)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open @${house.username} on Instagram`}
                className="flex min-w-0 items-center gap-1 font-semibold text-zinc-950 hover:underline"
              >
                <span className="truncate">@{house.username}</span>
                <ExternalIcon className="size-3.5 shrink-0 text-zinc-400" />
              </a>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                <span>
                  House #{fmt(house.plot)} · {site.townName(sel.town)}
                </span>
                {house.plot <= 100 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Founder
                  </span>
                )}
                {sel.mine && (
                  <span className="rounded-full bg-zinc-900 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                    You
                  </span>
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

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-zinc-900">
                {stage.label}
                {p < 1 && <span className="font-normal text-zinc-500"> · {percentText(p)} built</span>}
              </span>
              <span className="text-zinc-500">{p < 1 ? timeLeftText(house.done, now) : "Finished"}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${p >= 1 ? "bg-emerald-500" : "bg-[#F08A3C]"}`}
                style={{ width: `${Math.max(3, p * 100)}%` }}
              />
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-zinc-50 px-2.5 py-2" title="In-game coins, not real money">
              <dt className="text-zinc-500">Value · coins</dt>
              <dd className="mt-0.5 whitespace-nowrap font-mono text-[13px] font-semibold text-zinc-900">
                {fmt(houseValue(house.plot, p, house.waves))}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 px-2.5 py-2">
              <dt className="text-zinc-500">Waves</dt>
              <dd className="mt-0.5 font-mono text-[13px] font-semibold text-zinc-900">{fmt(house.waves)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex items-center gap-2">
            {sel.mine ? (
              <PopupButton strong onClick={share} icon={<ShareIcon className="size-4" />}>
                Share invite link
              </PopupButton>
            ) : me ? (
              <>
                <PopupButton onClick={wave} disabled={waving} icon={<WaveIcon className="size-4" />}>
                  {waving ? "Waving..." : "Wave"}
                </PopupButton>
                <PopupButton
                  strong
                  onClick={() => onMessage(house.plot)}
                  disabled={!neighbour}
                  title={neighbour ? undefined : "Only houses within 4 plots of yours can message each other"}
                  icon={<ChatIcon className="size-4" />}
                >
                  Message
                </PopupButton>
                <IconButton onClick={share} label="Share this house">
                  <ShareIcon className="size-4" />
                </IconButton>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-500">
                  {signedIn ? "Claim your house to wave and chat with neighbours." : "Join the waitlist to wave and chat with neighbours."}
                </p>
                <IconButton onClick={share} label="Share this house">
                  <ShareIcon className="size-4" />
                </IconButton>
              </>
            )}
          </div>
          {(note || (me && !sel.mine && !neighbour)) && (
            <p role="status" className="mt-2 break-words text-xs leading-snug text-zinc-500">
              {note ?? "Only houses within 4 plots of yours can message each other."}
            </p>
          )}

          {/* Points at the house when the card sits right above it. */}
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

function PopupButton({
  children,
  onClick,
  icon,
  strong,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
  strong?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-[transform,background-color] duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${
        strong ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700 transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.95]"
    >
      {children}
    </button>
  );
}
