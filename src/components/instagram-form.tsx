"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { joinWaitlist, type JoinState } from "@/app/actions";
import { PlotChoiceNote } from "@/components/plot-choice-note";
import { INSTAGRAM_MAX_LENGTH, parseInstagramUsername } from "@/lib/instagram";
import { setChosenPlot, useChosenPlot } from "@/lib/plot-choice";
import { setPreviewName } from "@/lib/preview-name";

const initialState: JoinState = { error: null };

export function InstagramForm({ nextPlot }: { nextPlot: number }) {
  const [state, submit, pending] = useActionState(joinWaitlist, initialState);
  const [value, setValue] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  // Hide the last server error once the user starts editing again.
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false);
  const chosen = useChosenPlot();
  const plot = chosen ?? nextPlot;

  const error = clientError ?? (editedSinceSubmit ? null : state.error);

  // Show what they're typing on the tag above their plot (only once it's a valid username).
  useEffect(() => {
    const parsed = parseInstagramUsername(value);
    setPreviewName(parsed.ok ? parsed.username : "");
  }, [value]);
  useEffect(() => () => setPreviewName(""), []);

  // Their pick was taken (or isn't open): fall back to the next free plot.
  useEffect(() => {
    if (state.plotGone) setChosenPlot(null);
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseInstagramUsername(value);
    if (!result.ok) {
      setClientError(result.error);
      return;
    }
    setClientError(null);
    setEditedSinceSubmit(false);
    const formData = new FormData();
    formData.set("instagram", result.username);
    if (chosen !== null) formData.set("plot", String(chosen));
    startTransition(() => submit(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="instagram" className="text-sm font-medium text-zinc-900">
          Instagram username
        </label>
        <div
          className={`flex h-12 items-center rounded-2xl border bg-white pl-4 pr-2 transition-colors focus-within:border-zinc-900 ${
            error ? "border-red-400" : "border-zinc-300"
          }`}
        >
          <span aria-hidden="true" className="select-none font-mono text-zinc-400">
            @
          </span>
          <input
            id="instagram"
            name="instagram"
            type="text"
            value={value}
            onChange={(event) => {
              // A typed or pasted leading "@" is dropped; the prefix above already shows it.
              setValue(event.target.value.replace(/^\s*@+/, ""));
              setClientError(null);
              setEditedSinceSubmit(true);
            }}
            placeholder="yourname"
            maxLength={80}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "instagram-error" : "instagram-help"}
            className="h-full min-w-0 flex-1 bg-transparent pl-1 font-mono text-[15px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>
        {error ? (
          <p id="instagram-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : (
          <p id="instagram-help" className="text-sm text-zinc-500">
            Just your username. Letters, numbers, periods and underscores, up to {INSTAGRAM_MAX_LENGTH} characters.
          </p>
        )}
      </div>

      <PlotChoiceNote nextPlot={nextPlot} />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Saving your plot..." : `Claim house #${plot.toLocaleString("en")}`}
      </button>
    </form>
  );
}
