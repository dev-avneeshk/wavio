"use client";

import { useEffect, useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user comes back with the browser's Back button, re-enable the button.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    // On success the browser is already on its way to Google.
    if (error) {
      setError("Couldn't open Google sign-in. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-6 text-[15px] font-medium text-zinc-900 shadow-[0_2px_6px_-3px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        <GoogleIcon className="size-5" />
        {pending ? "Opening Google..." : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
