"use client";

import { useRef, useState } from "react";
import { BookIcon, CloseIcon, CoinIcon, FistIcon, HandIcon, HeartIcon, HouseGlyph, PlayIcon, TreeIcon, WaveIcon } from "@/components/icons";
import type { Zone } from "@/components/land/jungle";
import { decodeLook } from "@/components/people/look";
import { useTouch } from "@/lib/device";
import { incomeText, jobText, useGame } from "@/lib/game";

const fmt = (n: number) => n.toLocaleString("en");

// The way into the game, in the map's button row.
export function PlayButton({ onPlay }: { onPlay: () => void }) {
  const { ready } = useGame();
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={!ready}
      title={ready ? "Walk your person around town" : "Getting your person ready..."}
      className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent pl-3.5 pr-4 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] transition-[transform,background-color,opacity] duration-200 hover:bg-accent-deep active:scale-[0.97] disabled:opacity-60"
    >
      <PlayIcon className="size-4" />
      Play
    </button>
  );
}

type HudProps = {
  username: string;
  onExit: () => void;
  onAct: (kind: "fight" | "steal" | "wave") => void;
  onStory: () => void;
  onStick: (x: number, y: number) => void;
  onRun: (on: boolean) => void;
  zone: Zone;
  onTravel: (where: "jungle" | "home") => void;
};

// Play mode: your money, health and job at the top, the stick and run button on the left (touch
// screens), and what you can do to whoever is next to you on the right.
export function PlayHud({ username, onExit, onAct, onStory, onStick, onRun, zone, onTravel }: HudProps) {
  const { char, near, busy } = useGame();
  const touch = useTouch();
  const look = char ? decodeLook(char.look) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:p-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-2xl bg-zinc-950/80 py-1.5 pl-1.5 pr-3 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full ring-2 ring-white/70"
            style={{ background: look ? `linear-gradient(180deg, ${look.hairColor} 0 38%, ${look.skin} 38% 70%, ${look.topColor} 70%)` : "#555" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">@{username}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium leading-tight text-white/80">
              <span className="inline-flex items-center gap-1 text-[#F7C631]">
                <CoinIcon className="size-3.5" />
                {char ? fmt(char.wallet) : "..."} coins
              </span>
              <span className="inline-flex items-center gap-1">
                <HeartIcon className={`size-3.5 ${char && char.health < 35 ? "text-rose-400" : "text-rose-300"}`} />
                {char ? char.health : "..."}
              </span>
              <span className="hidden sm:inline">
                {incomeText(char?.income ?? 0)} · {jobText(char?.job ?? null)}
              </span>
            </p>
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {zone === "town" ? (
            <HudButton onClick={() => onTravel("jungle")} label="Go to the jungle">
              <TreeIcon className="size-[18px]" />
            </HudButton>
          ) : (
            <HudButton onClick={() => onTravel("home")} label="Back home">
              <HouseGlyph className="size-[18px]" />
            </HudButton>
          )}
          <HudButton onClick={onStory} label="Your story">
            <BookIcon className="size-[18px]" />
          </HudButton>
          <HudButton onClick={onExit} label="Back to the map">
            <CloseIcon className="size-[18px]" />
          </HudButton>
        </div>
      </div>

      {touch ? (
        <Stick onStick={onStick} onRun={onRun} />
      ) : (
        <p className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-zinc-950/70 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur md:block">
          WASD or arrow keys to walk · Shift to run · drag to look around
        </p>
      )}

      <div className="absolute bottom-3 right-[max(0.75rem,env(safe-area-inset-right))] flex flex-col items-end gap-2 md:bottom-6 md:right-6">
        {near && (
          <p className="max-w-[60vw] truncate rounded-full bg-zinc-950/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            Next to @{near.username}
          </p>
        )}
        <div className="pointer-events-auto flex items-end gap-2">
          <ActButton onClick={() => onAct("wave")} label="Wave">
            <WaveIcon className="size-5" />
          </ActButton>
          <ActButton onClick={() => onAct("steal")} label="Steal" disabled={!near || busy} tone="dark">
            <HandIcon className="size-5" />
          </ActButton>
          <ActButton onClick={() => onAct("fight")} label="Fight" disabled={!near || busy} tone="red" big>
            <FistIcon className="size-6" />
          </ActButton>
        </div>
      </div>
    </div>
  );
}

function HudButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full bg-zinc-950/75 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur transition-transform active:scale-[0.94]"
    >
      {children}
    </button>
  );
}

function ActButton({
  children,
  onClick,
  label,
  disabled,
  tone = "light",
  big,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  tone?: "light" | "dark" | "red";
  big?: boolean;
}) {
  const color =
    tone === "red" ? "bg-accent text-white" : tone === "dark" ? "bg-zinc-900/85 text-white" : "bg-white/90 text-zinc-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-full font-semibold shadow-[0_10px_26px_-12px_rgba(0,0,0,0.7)] backdrop-blur transition-[transform,opacity] duration-150 active:scale-[0.92] disabled:opacity-40 ${color} ${
        big ? "size-[4.5rem] text-[11px]" : "size-14 text-[10px]"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

// A thumb stick for touch screens. Push it all the way to run.
function Stick({ onStick, onRun }: { onStick: (x: number, y: number) => void; onRun: (on: boolean) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const R = 52;

  const move = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el || active.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    onStick(dx / R, -dy / R);
    onRun(len > R * 0.92);
  };

  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onStick(0, 0);
    onRun(false);
  };

  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="pointer-events-auto absolute bottom-4 left-[max(1rem,env(safe-area-inset-left))] size-[8.5rem] touch-none rounded-full border border-white/40 bg-zinc-950/30 backdrop-blur-sm"
      aria-label="Move"
      role="application"
    >
      <span
        className="absolute left-1/2 top-1/2 size-14 rounded-full bg-white/85 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
      <span className="pointer-events-none absolute inset-x-0 -top-5 text-center text-[10px] font-semibold uppercase tracking-wide text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
        Push far to run
      </span>
    </div>
  );
}
