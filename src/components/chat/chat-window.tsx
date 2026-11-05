"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BackIcon, CloseIcon, ExternalIcon, HouseGlyph, SendIcon } from "@/components/icons";
import { neighboursOf } from "@/components/land/spec";
import { instagramUrl } from "@/lib/house";
import { closeChat, markRead, onIncoming, openChat, useSocial, type ChatMessage } from "@/lib/social";
import { fetchThread, sendMessage, setBlocked } from "@/lib/social-api";
import type { House, MyHouse } from "@/lib/world";

const MAX = 280;
const fmt = (n: number) => n.toLocaleString("en");

const timeText = (at: string) => {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("en", today ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }).format(d);
};

type ChatWindowProps = {
  me: MyHouse;
  houses: readonly House[]; // your town's houses (your neighbours are among them)
  onShow: (plot: number) => void; // fly the map to a house
};

// Messages with your neighbours (houses within 4 plots of yours). Opens from a house's card, the
// map's Chat button, or the card on the page.
export function ChatWindow({ me, houses, onShow }: ChatWindowProps) {
  const { chatOpen, chatWith, inbox } = useSocial();
  const neighbours = useMemo(() => neighboursOf(me.plot, houses), [me.plot, houses]);

  if (!chatOpen) return null;
  const other = chatWith ? (houses.find((h) => h.plot === chatWith) ?? null) : null;
  const convo = chatWith ? inbox.find((c) => c.with === chatWith) : undefined;
  const username = other?.username ?? convo?.username ?? "neighbour";

  return (
    <section
      aria-label="Messages with neighbours"
      // Phones: a sheet over the page below the header. Desktop: a panel above the map buttons.
      className="pointer-events-auto fixed inset-x-2 bottom-2 top-[4.25rem] z-40 flex flex-col overflow-hidden rounded-[1.25rem] border border-black/5 bg-white shadow-[0_24px_60px_-24px_rgba(20,30,40,0.6)] md:absolute md:inset-x-auto md:bottom-20 md:right-6 md:top-auto md:z-20 md:h-[min(460px,calc(100%-6.5rem))] md:w-[360px]"
    >
      {chatWith ? (
        <Thread key={chatWith} withPlot={chatWith} username={username} onShow={onShow} />
      ) : (
        <>
          <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950">Neighbours</p>
              <p className="text-xs text-zinc-500">Houses within 4 plots of yours can chat.</p>
            </div>
            <CloseButton />
          </header>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {neighbourRows(neighbours, inbox).map((row) => (
              <li key={row.plot}>
                <button
                  type="button"
                  onClick={() => openChat(row.plot)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
                >
                  <Avatar name={row.username} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-zinc-900">@{row.username}</span>
                      <span className="shrink-0 text-[11px] text-zinc-400">#{fmt(row.plot)}</span>
                    </span>
                    <span className={`block truncate text-xs ${row.unread ? "font-medium text-zinc-800" : "text-zinc-500"}`}>
                      {row.blocked ? "Blocked" : row.last ? `${row.fromMe ? "You: " : ""}${row.last}` : "Say hi"}
                    </span>
                  </span>
                  {row.unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                      {row.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {neighbours.length === 0 && inbox.length === 0 && (
              <li className="px-4 py-6 text-center text-sm leading-relaxed text-zinc-500">
                No neighbours yet. When someone takes a plot near yours, you can chat here. Share your link to bring friends next door.
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

type Row = { plot: number; username: string; last: string; fromMe: boolean; unread: number; blocked: boolean; at: string };

// Conversations first (unread, then newest), then the other neighbours, nearest first.
const neighbourRows = (neighbours: readonly House[], inbox: ReturnType<typeof useSocial>["inbox"]): Row[] => {
  const rows: Row[] = inbox.map((c) => ({
    plot: c.with,
    username: c.username,
    last: c.last,
    fromMe: c.fromMe,
    unread: c.blocked ? 0 : c.unread,
    blocked: c.blocked,
    at: c.at,
  }));
  rows.sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.at.localeCompare(a.at));
  const seen = new Set(rows.map((r) => r.plot));
  for (const n of neighbours)
    if (!seen.has(n.plot)) rows.push({ plot: n.plot, username: n.username, last: "", fromMe: false, unread: 0, blocked: false, at: "" });
  return rows;
};

function Thread({ withPlot, username, onShow }: { withPlot: number; username: string; onShow: (plot: number) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [near, setNear] = useState(true);
  const [blocked, setBlockedState] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [more, setMore] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    const r = await fetchThread(withPlot);
    if (!r.ok) {
      setError(r.error);
      setLoaded(true);
      return;
    }
    setMessages((prev) => {
      // Keep older pages already loaded, and anything sent meanwhile.
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of r.data.messages) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.id - b.id);
    });
    setMore((m) => m || r.data.messages.length >= 60);
    setNear(r.data.near);
    setBlockedState(r.data.blocked);
    setLoaded(true);
    markRead(withPlot);
  }, [withPlot]);

  // Load now, again when they message you, and every 10 s while the tab is visible (in case live
  // updates aren't getting through).
  useEffect(() => {
    void load();
    const off = onIncoming((m) => {
      if (m.from === withPlot) void load();
    });
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [load, withPlot]);

  // Stay scrolled to the newest message unless they've scrolled up to read.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    const r = await fetchThread(withPlot, first.id);
    if (!r.ok) return setError(r.error);
    stick.current = false;
    setMore(r.data.messages.length >= 60);
    setMessages((prev) => [...r.data.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const r = await sendMessage(withPlot, body);
    setSending(false);
    if (!r.ok) return setError(r.error);
    stick.current = true;
    setText("");
    setMessages((prev) => (prev.some((m) => m.id === r.data.id) ? prev : [...prev, r.data]));
  }

  async function toggleBlock() {
    const r = await setBlocked(withPlot, !blocked);
    if (!r.ok) return setError(r.error);
    setBlockedState(r.data);
    setError(null);
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-zinc-100 px-2 py-2">
        <button
          type="button"
          onClick={() => openChat(null)}
          aria-label="All neighbours"
          className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <BackIcon className="size-5" />
        </button>
        <Avatar name={username} />
        <div className="min-w-0 flex-1">
          <a
            href={instagramUrl(username)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1 text-sm font-semibold text-zinc-950 hover:underline"
          >
            <span className="truncate">@{username}</span>
            <ExternalIcon className="size-3 shrink-0 text-zinc-400" />
          </a>
          <p className="text-[11px] text-zinc-500">House #{fmt(withPlot)}</p>
        </div>
        <button
          type="button"
          onClick={() => onShow(withPlot)}
          aria-label="Show their house on the map"
          title="Show their house on the map"
          className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <HouseGlyph className="size-4" />
        </button>
        <CloseButton />
      </header>

      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-zinc-50/70 px-3 py-3"
        aria-live="polite"
      >
        {more && (
          <li className="self-center">
            <button type="button" onClick={loadOlder} className="rounded-full px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">
              Load earlier messages
            </button>
          </li>
        )}
        {loaded && messages.length === 0 && (
          <li className="m-auto max-w-[15rem] text-center text-sm leading-relaxed text-zinc-500">
            Say hi to your neighbour at house #{fmt(withPlot)}. Only the two of you can see this chat.
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={`flex max-w-[82%] flex-col ${m.fromMe ? "self-end items-end" : "self-start items-start"}`}>
            <p
              className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                m.fromMe ? "rounded-br-md bg-zinc-900 text-white" : "rounded-bl-md bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              }`}
            >
              {m.body}
            </p>
            <span className="mt-0.5 px-1 text-[10px] text-zinc-400">{timeText(m.at)}</span>
          </li>
        ))}
      </ol>

      <footer className="border-t border-zinc-100 p-2">
        {error && (
          <p role="alert" className="px-2 pb-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
        {!near && loaded ? (
          <p className="px-2 py-2 text-xs text-zinc-500">This house isn&apos;t within 4 plots of yours, so you can&apos;t message it.</p>
        ) : blocked ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <p className="text-xs text-zinc-500">You blocked @{username}.</p>
            <button type="button" onClick={toggleBlock} className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100">
              Unblock
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <label htmlFor={`chat-${withPlot}`} className="sr-only">
              Message @{username}
            </label>
            <textarea
              id={`chat-${withPlot}`}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX));
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={MAX}
              placeholder={`Message @${username}`}
              className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white transition-[transform,background-color] duration-200 hover:bg-accent-deep active:scale-[0.95] disabled:opacity-40"
            >
              <SendIcon className="size-[18px]" />
            </button>
          </form>
        )}
        <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-zinc-400">
          <span>{near && !blocked ? `${text.length}/${MAX}` : ""}</span>
          {!blocked && near && (
            <button type="button" onClick={toggleBlock} className="hover:text-zinc-700 hover:underline">
              Block @{username}
            </button>
          )}
        </div>
      </footer>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-sm font-bold uppercase text-white">
      {name.replace(/[^a-z0-9]/g, "").slice(0, 1) || "@"}
    </span>
  );
}

function CloseButton() {
  return (
    <button
      type="button"
      onClick={closeChat}
      aria-label="Close messages"
      className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      <CloseIcon className="size-4" />
    </button>
  );
}
