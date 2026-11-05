"use client";

import { useEffect, type RefObject } from "react";
import type { LandEngine } from "@/components/land/engine";
import { hasSupabaseEnv } from "@/lib/env";
import { addStory, getGame, patchGame, setPlay, storyText, storyTone, toast, type StoryItem } from "@/lib/game";
import { gameEnter, gameLeave, gamePing } from "@/lib/game-api";
import type { MyHouse } from "@/lib/world";

// Being in the game: while the page is open and on screen you control your person, and they do
// nothing on their own. Leave (close the page, or have it hidden for 45 s) and they go back to
// living their own life; come back and you see what they got up to.
export function useGameSession(me: MyHouse | null, engine: RefObject<LandEngine | null>) {
  const plot = me?.plot ?? 0;

  useEffect(() => {
    if (!plot || !hasSupabaseEnv) return;
    let stopped = false;
    let inGame = false;
    let lastId = 0;
    let hideTimer = 0;

    const note = (items: StoryItem[]) => {
      for (const s of items) if (s.id > lastId) lastId = s.id;
    };

    const enter = async () => {
      const t0 = Date.now();
      const r = await gameEnter();
      if (stopped) return;
      if (!r.ok) {
        console.warn("[game] couldn't enter:", r.error);
        return;
      }
      const d = r.data;
      engine.current?.syncClock(d.now, Date.now() - t0);
      inGame = true;
      addStory(d.events);
      note(d.events);
      const away = Math.max(0, d.now - d.since);
      patchGame({
        ready: true,
        char: d.char,
        away: d.first ? { first: true, seconds: away, items: d.events } : away > 300 && d.events.length ? { first: false, seconds: away, items: d.events } : getGame().away,
      });
      engine.current?.setInGame(true);
    };

    const ping = async () => {
      if (!inGame) return;
      const t0 = Date.now();
      const r = await gamePing(lastId);
      if (stopped || !r.ok) return;
      engine.current?.syncClock(r.data.now, Date.now() - t0);
      const known = new Set(getGame().story.map((s) => s.id));
      const fresh = r.data.events.filter((s) => !known.has(s.id) && s.id > lastId);
      // Things done to you while you're here (another player robbed you, say).
      for (const s of fresh) if (!s.mine) toast(storyText(s), storyTone(s));
      addStory(r.data.events);
      note(r.data.events);
      patchGame({ char: r.data.char });
    };

    const leave = () => {
      if (!inGame) return;
      inGame = false;
      gameLeave();
      setPlay(false);
      engine.current?.setPlay(false);
      engine.current?.setInGame(false);
    };

    void enter();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void ping();
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(leave, 45_000);
        return;
      }
      window.clearTimeout(hideTimer);
      if (!inGame) void enter();
      else void ping();
    };
    const onPageHide = () => leave();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      window.clearInterval(id);
      window.clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
      if (inGame) gameLeave();
      patchGame({ ready: false, char: null, play: false, near: null });
    };
  }, [plot, engine]);
}
