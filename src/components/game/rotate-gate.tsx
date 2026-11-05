"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PhoneRotateIcon } from "@/components/icons";
import { hasTouch } from "@/lib/device";

// Phones held upright. The game is made for landscape, so they're asked to turn the phone.
const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 600px)";
const KEY = "lfc.portrait-ok";

const subscribe = (fn: () => void) => {
  const mq = window.matchMedia(PORTRAIT_PHONE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

export function RotateGate() {
  const portrait = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PORTRAIT_PHONE).matches && hasTouch(),
    () => false,
  );
  // Some people have rotation locked: they can carry on upright (remembered for this visit).
  const [ok, setOk] = useState(true);
  useEffect(() => {
    try {
      setOk(sessionStorage.getItem(KEY) === "1");
    } catch {
      setOk(false);
    }
  }, []);

  if (!portrait || ok) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-[linear-gradient(180deg,#5F9FD6_0%,#C9DEEE_45%,#93CD66_46%,#6FB24A_100%)] p-8 text-center">
      <div className="rounded-[2rem] bg-white/90 px-7 py-8 shadow-[0_24px_60px_-28px_rgba(30,40,50,0.6)] backdrop-blur">
        <PhoneRotateIcon className="mx-auto size-14 animate-turn-phone text-zinc-900" />
        <p className="mt-5 text-xl font-semibold tracking-tight text-zinc-950">Turn your phone sideways</p>
        <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-zinc-600">
          Lazy Films City is played in landscape. Rotate your phone to see the town and walk your person around.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {
            // Private mode: just for now, then.
          }
          setOk(true);
        }}
        className="rounded-full px-4 py-2 text-xs font-semibold text-white/95 underline underline-offset-4 [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]"
      >
        My rotation is locked, continue upright
      </button>
    </div>
  );
}
