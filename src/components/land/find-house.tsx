"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { findHouse } from "@/lib/social-api";

const fmt = (n: number) => n.toLocaleString("en");

// Find a house by @username or house number, and fly there.
export function FindHouse({ onFound }: { onFound: (plot: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<[number, string][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQ("");
    setResults(null);
    setError(null);
  }

  function go(plot: number) {
    close();
    onFound(plot);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = q.trim();
    if (!s) return;
    const num = s.match(/^#?\s*(\d{1,9})$/);
    if (num) return go(Number(num[1]));
    setBusy(true);
    setError(null);
    const r = await findHouse(s);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const exact = r.data.find(([, name]) => name === s.replace(/^@+/, "").toLowerCase());
    if (exact) return go(exact[0]);
    if (r.data.length === 1) return go(r.data[0][0]);
    setResults(r.data);
    if (!r.data.length) setError("No house with that username yet.");
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Find a house"
        title="Find a house by @username or number"
        className="grid size-10 place-items-center rounded-full bg-white/90 text-zinc-800 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,background-color] duration-200 hover:bg-white active:scale-[0.95]"
      >
        <SearchIcon className="size-[18px]" />
      </button>
    );

  return (
    <div className="relative">
      <form
        onSubmit={submit}
        className="flex h-10 w-[min(250px,calc(100vw-1.5rem))] items-center gap-1 rounded-full bg-white pl-3.5 pr-1 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)]"
      >
        <SearchIcon className="size-4 shrink-0 text-zinc-400" />
        <label htmlFor="find-house" className="sr-only">
          Find a house by Instagram username or house number
        </label>
        <input
          ref={inputRef}
          id="find-house"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setResults(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          placeholder="@username or #12"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
        />
        <button
          type={q.trim() ? "submit" : "button"}
          onClick={q.trim() ? undefined : close}
          disabled={busy}
          aria-label={q.trim() ? "Find" : "Close"}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-60"
        >
          {q.trim() ? <SearchIcon className="size-4" /> : <CloseIcon className="size-4" />}
        </button>
      </form>
      {(error || (results && results.length > 0)) && (
        <div className="absolute bottom-12 right-0 w-full overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)]">
          {error && <p className="px-3.5 py-2 text-xs text-zinc-500">{error}</p>}
          {results?.map(([plot, name]) => (
            <button
              key={plot}
              type="button"
              onClick={() => go(plot)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span className="truncate font-medium text-zinc-900">@{name}</span>
              <span className="shrink-0 text-xs text-zinc-400">#{fmt(plot)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
