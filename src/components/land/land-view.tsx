"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { useSocialLive } from "@/components/chat/use-social-live";
import { PersonPopup } from "@/components/game/person-popup";
import { PlayButton, PlayHud } from "@/components/game/play-hud";
import { RotateGate } from "@/components/game/rotate-gate";
import { AwayPanel, StoryPanel } from "@/components/game/story-panel";
import { GameToasts } from "@/components/game/toasts";
import { useGameSession } from "@/components/game/use-game-session";
import { ChatIcon } from "@/components/icons";
import type { PersonInfo } from "@/components/people/people";
import { hasSupabaseEnv } from "@/lib/env";
import {
  addStory,
  getGame,
  onMapRequest,
  patchGame,
  setPlay,
  storyText,
  storyTone,
  toast,
  useGame,
  type GameEvent,
  type StoryItem,
} from "@/lib/game";
import { charAct, townEvents } from "@/lib/game-api";
import { createLiveLink } from "@/lib/game-live";
import { clearInvite, rememberInvite } from "@/lib/invite";
import { useChosenPlot } from "@/lib/plot-choice";
import { site } from "@/lib/site";
import { onFlyRequest, onIncoming, openChat, useSocial } from "@/lib/social";
import { createClient } from "@/lib/supabase/client";
import { TOWN_SIZE, nextPlot, parseWorldView, type WorldView } from "@/lib/world";
import { LandEngine, type Selection, type ViewInfo } from "./engine";
import { FindHouse } from "./find-house";
import { HousePopup } from "./house-popup";

export type LandProps = {
  view: WorldView;
  signedIn?: boolean;
  // A house to open on, from a shared link (/?h=12).
  startAt?: number | null;
};

const PHONE_LAND = "(orientation: landscape) and (max-height: 540px) and (pointer: coarse)";

// The page card covers the left side of the map on wide screens and phones held sideways; tell the
// camera how much. Collapsed, it's a small pill in the corner, so the map gets the whole width. In
// play mode the card is hidden.
const cardInset = () => {
  if (document.documentElement.dataset.play) return 0;
  if (window.innerWidth < 768 && !window.matchMedia(PHONE_LAND).matches) return 0;
  const card = document.getElementById("waitlist-card");
  if (!card || card.dataset.collapsed === "true") return 0;
  return card.getBoundingClientRect().right + 16;
};

// Another town's houses, fetched when you move the camera there.
const loadTown = async (town: number): Promise<WorldView | null> => {
  if (!hasSupabaseEnv) return null;
  const { data, error } = await createClient().rpc("waitlist_world", { p_town: town });
  if (error) {
    console.error("[land] loading town failed:", error.code, error.message);
    return null;
  }
  return parseWorldView(data);
};

const loadFeed = (town: number) => (hasSupabaseEnv ? townEvents(town) : Promise.resolve(null));

// Phones: play full screen, turned sideways where the browser allows it (Android; iPhones can't).
const goFullscreen = async () => {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Not allowed here (iPhone Safari, in-app browsers): carry on in the page.
  }
  try {
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // Can't lock: the rotate prompt covers it.
  }
};

const leaveFullscreen = () => {
  try {
    (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
  } catch {
    // Nothing locked.
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
};

const fmt = (n: number) => n.toLocaleString("en");

export default function LandView({ view, signedIn = false, startAt = null }: LandProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LandEngine | null>(null);
  const popupEl = useRef<HTMLDivElement | null>(null);
  const personEl = useRef<HTMLDivElement | null>(null);
  const startRef = useRef(startAt);
  const [failed, setFailed] = useState(false);
  const [info, setInfo] = useState<ViewInfo | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [person, setPerson] = useState<PersonInfo | null>(null);
  const chosen = useChosenPlot();
  const { unread } = useSocial();
  const { play } = useGame();
  const me = view.me;
  // Live positions: only people with a house join the channel (it doesn't connect until then).
  const live = useMemo(() => (hasSupabaseEnv ? createLiveLink() : null), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: LandEngine;
    try {
      engine = new LandEngine(host, {
        leftInset: cardInset,
        loadTown,
        loadFeed,
        live,
        onView: setInfo,
        onSelect: setSel,
        onSelectPerson: setPerson,
        onNear: (near) => patchGame({ near }),
        onPlay: (on) => setPlay(on),
        startAt: startRef.current,
      });
    } catch (error) {
      console.error("[land] WebGL unavailable:", error);
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    engine.setPopup(popupEl.current);
    engine.setPersonPopup(personEl.current);
    // Re-centre the camera when the card is collapsed or opened.
    const card = document.getElementById("waitlist-card");
    const ro = card ? new ResizeObserver(() => engine.relayout()) : null;
    if (card) ro?.observe(card);
    const offFly = onFlyRequest((plot) => void engine.flyToHouse(plot));
    const offMsg = onIncoming((m) => engine.showBubble(m.from, m.body));
    return () => {
      ro?.disconnect();
      offFly();
      offMsg();
      engineRef.current = null;
      engine.dispose();
    };
  }, [live]);

  useEffect(() => {
    engineRef.current?.setData(view);
  }, [view]);

  // Someone opened a house's link: if they join, that house gets the invite.
  useEffect(() => {
    if (me) clearInvite();
    else if (startAt) rememberInvite(startAt);
  }, [me, startAt]);

  useSocialLive(me);
  useGameSession(me, engineRef);

  // Play mode hides the page around the map (globals.css) and re-centres the view.
  useEffect(() => {
    const root = document.documentElement;
    if (play) root.dataset.play = "1";
    else delete root.dataset.play;
    engineRef.current?.relayout();
    if (!play) leaveFullscreen();
    return () => {
      delete root.dataset.play;
    };
  }, [play]);

  const startPlay = useCallback(() => {
    if (!getGame().ready) return;
    void goFullscreen();
    void engineRef.current?.setPlay(true);
  }, []);

  const stopPlay = useCallback(() => void engineRef.current?.setPlay(false), []);

  const act = useCallback(
    async (kind: "fight" | "steal" | "wave") => {
      const eng = engineRef.current;
      if (!eng || !me) return;
      if (kind === "wave") return eng.playAct("wave", null);
      const g = getGame();
      const near = g.near;
      if (!near || g.busy) return;
      patchGame({ busy: true });
      const r = await charAct(kind, near.plot);
      patchGame({ busy: false });
      if (!r.ok) return toast(r.error, "bad");
      const d = r.data;
      const ev: GameEvent = {
        id: d.id,
        at: eng.serverNow(),
        dur: kind === "fight" ? 6 : 4,
        kind,
        detail: d.detail,
        actor: me.plot,
        target: near.plot,
        winner: d.winner,
        coins: d.coins,
        live: true,
      };
      eng.playAct(kind, ev);
      const item: StoryItem = {
        id: d.id,
        at: Math.floor(ev.at),
        kind,
        detail: d.detail,
        mine: true,
        other: near.plot,
        otherName: d.targetName || near.username,
        won: kind === "fight" ? d.winner === me.plot : null,
        coins: d.coins,
        live: true,
      };
      // The fight plays out first, then you find out how it went.
      const show = () => {
        addStory([item]);
        patchGame({ char: d.char });
        toast(storyText(item), storyTone(item));
      };
      if (kind === "fight") window.setTimeout(show, 4000);
      else show();
    },
    [me],
  );

  // Requests from the page card (Play, show a house).
  useEffect(
    () =>
      onMapRequest((r) => {
        if (r.type === "play") {
          if (r.on) startPlay();
          else stopPlay();
        } else if (r.type === "act") void act(r.kind);
        else if (r.type === "show") void engineRef.current?.flyToHouse(r.plot);
      }),
    [startPlay, stopPlay, act],
  );

  const popupRef = useCallback((el: HTMLDivElement | null) => {
    popupEl.current = el;
    engineRef.current?.setPopup(el);
  }, []);
  const personRef = useCallback((el: HTMLDivElement | null) => {
    personEl.current = el;
    engineRef.current?.setPersonPopup(el);
  }, []);
  const closePopup = useCallback(() => engineRef.current?.select(null), []);
  const closePerson = useCallback(() => engineRef.current?.selectPerson(null), []);
  const message = useCallback((plot: number) => {
    engineRef.current?.select(null);
    engineRef.current?.selectPerson(null);
    openChat(plot);
  }, []);
  const waved = useCallback((plot: number, waves: number) => engineRef.current?.patchHouse(plot, { waves }), []);
  const fly = useCallback((plot: number) => {
    engineRef.current?.selectPerson(null);
    void engineRef.current?.flyToHouse(plot);
  }, []);

  if (failed) return <LandFallback />;

  // Zoomed out over the world there's no single town to name; tapping a town flies there instead.
  const townLabel =
    !info || info.zoomedOut
      ? null
      : info.loading
        ? "Loading..."
        : info.town > info.open
          ? `${site.townName(info.town)} · empty`
          : `${site.townName(info.town)} · ${fmt(info.houses)}/${fmt(TOWN_SIZE)}`;

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0 touch-none select-none" />
      <HousePopup
        sel={sel}
        me={me}
        signedIn={signedIn}
        popupRef={popupRef}
        onClose={closePopup}
        onMessage={message}
        onWaved={waved}
      />
      <PersonPopup info={person} me={me} popupRef={personRef} onClose={closePerson} onHouse={fly} onMessage={message} />
      {me && <ChatWindow me={me} houses={view.plots} onShow={fly} />}
      <GameToasts />
      {play && me ? (
        <PlayHud
          username={me.username}
          onExit={stopPlay}
          onAct={(k) => void act(k)}
          onStory={() => patchGame({ storyOpen: true })}
          onStick={(x, y) => engineRef.current?.setStick(x, y)}
          onRun={(on) => engineRef.current?.setRun(on)}
        />
      ) : (
        <div className="pointer-events-none absolute inset-x-3 bottom-9 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6 phone-land:bottom-3 phone-land:right-[max(0.75rem,env(safe-area-inset-right))]">
          <p className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] backdrop-blur lg:ml-auto lg:block">
            {info?.zoomedOut ? "Tap a town to fly there." : "Tap a house or a person to see who they are. Drag to move, right-drag to turn."}
          </p>
          <div className="pointer-events-auto ml-auto flex flex-wrap items-end justify-end gap-2 lg:ml-0">
            {hasSupabaseEnv && <FindHouse onFound={fly} />}
            {info && townLabel && (
              // Phones: left out, to keep text off the map (zoom out to see town names).
              <MapButton
                className="hidden sm:block phone-land:hidden"
                onClick={() => void engineRef.current?.flyToTown(info.town)}
                label={`Show all of ${site.townName(info.town)}`}
              >
                {townLabel}
              </MapButton>
            )}
            {me && (
              <MapButton onClick={() => openChat(null)} label={unread ? `Chat, ${unread} unread` : "Chat with neighbours"}>
                <span className="inline-flex items-center gap-1.5">
                  <ChatIcon className="size-4" />
                  Chat
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
              </MapButton>
            )}
            <MapButton onClick={() => engineRef.current?.flyToWorld()} label="Show every town">
              World
            </MapButton>
            <MapButton strong onClick={() => void engineRef.current?.flyToFocus()}>
              {me ? "My house" : `Plot #${fmt(chosen ?? nextPlot(view))}`}
            </MapButton>
            {me && hasSupabaseEnv && <PlayButton onPlay={startPlay} />}
          </div>
        </div>
      )}
      {me && <AwayPanel username={me.username} onPlay={startPlay} />}
      <StoryPanel />
      <RotateGate />
    </div>
  );
}

function MapButton({
  children,
  onClick,
  strong,
  label,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  strong?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,background-color] duration-200 active:scale-[0.97] ${
        strong ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white/90 text-zinc-800 hover:bg-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function LandFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,#93C0E6_0%,#DDE8EE_45%,#93CD66_46%,#86C95A_100%)] p-6 text-center">
      <p className="max-w-xs rounded-2xl bg-white/85 px-4 py-3 text-sm text-zinc-700">
        The 3D map needs WebGL, which this browser has turned off. You can still join the waitlist.
      </p>
    </div>
  );
}
