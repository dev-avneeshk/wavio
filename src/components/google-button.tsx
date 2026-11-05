"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

// Google's own "Sign in with Google" button. Its popup opens from this site, so Google's screen says
// "continue to wavio.codes" instead of the Supabase project address. Google hands back an ID token and
// Supabase turns it into a session. If Google's script can't load, the classic redirect sign-in is used.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";
const LOAD_TIMEOUT_MS = 8000;

type CredentialResponse = { credential?: string };
type GoogleAccountsId = {
  initialize(options: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    itp_support?: boolean;
    context?: "signin" | "signup" | "use";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ): void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Google puts the SHA-256 (hex) of the nonce in its token; Supabase gets the raw value and checks the match.
async function makeNonce() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return { raw, hashed: hex(new Uint8Array(digest)) };
}

type Mode = "loading" | "google" | "fallback";

export function GoogleButton() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  const [mode, setMode] = useState<Mode>(CLIENT_ID ? "loading" : "fallback");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up (or reset, with a fresh nonce) Google's button. Kept in a ref so callbacks always see the latest.
  const setupRef = useRef<() => Promise<void>>(async () => {});
  setupRef.current = async () => {
    const gsi = window.google?.accounts?.id;
    const slot = slotRef.current;
    if (!CLIENT_ID || !gsi || !slot) return;
    const { raw, hashed } = await makeNonce();
    nonceRef.current = raw;
    gsi.initialize({
      client_id: CLIENT_ID,
      callback: (response) => void finish(response),
      nonce: hashed,
      ux_mode: "popup",
      auto_select: false,
      itp_support: true,
      context: "signin",
    });
    const width = wrapRef.current?.clientWidth ?? 320;
    slot.replaceChildren();
    gsi.renderButton(slot, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "center",
      width: Math.max(200, Math.min(400, Math.floor(width))),
    });
    setMode("google");
  };

  async function finish(response: CredentialResponse) {
    if (!response.credential) {
      setError("Google didn't return a sign-in. Try again.");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
      nonce: nonceRef.current,
    });
    if (error) {
      console.error("[auth] Google sign-in failed:", error.message);
      setError("Couldn't finish signing in with Google. Try again.");
      setPending(false);
      void setupRef.current();
      return;
    }
    // The session cookie is set; re-render the page as the signed-in visitor.
    router.refresh();
  }

  // Script already loaded on an earlier visit: set up now. If Google never loads, fall back.
  useEffect(() => {
    if (mode !== "loading") return;
    if (window.google?.accounts?.id) void setupRef.current();
    const timer = window.setTimeout(() => setMode((m) => (m === "loading" ? "fallback" : m)), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);

  // Coming back with the browser's Back button after the redirect sign-in: re-enable the button.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // Backup sign-in by redirect (Google's screen shows the Supabase address in this one).
  async function redirectSignIn() {
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
    if (error) {
      setError("Couldn't open Google sign-in. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {CLIENT_ID && (
        <Script
          src={GSI_SRC}
          strategy="afterInteractive"
          onReady={() => void setupRef.current()}
          onError={() => setMode("fallback")}
        />
      )}

      <div ref={wrapRef} className="relative">
        {/* Google draws its button in here; kept laid out (just invisible) while loading so it sizes right. */}
        <div
          ref={slotRef}
          aria-hidden={mode !== "google" || pending}
          className={`min-h-11 w-full items-center justify-center ${mode === "fallback" ? "hidden" : "flex"} ${
            mode === "google" && !pending ? "" : "invisible"
          }`}
        />

        {mode === "loading" && (
          <div
            aria-busy="true"
            className="absolute inset-0 flex animate-pulse items-center justify-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 text-[15px] text-zinc-400"
          >
            <GoogleIcon className="size-5 opacity-60" />
            Loading Google sign-in...
          </div>
        )}

        {mode === "google" && pending && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white text-[15px] font-medium text-zinc-700">
            <GoogleIcon className="size-5" />
            Signing you in...
          </div>
        )}

        {mode === "fallback" && (
          <button
            type="button"
            onClick={redirectSignIn}
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-6 text-[15px] font-medium text-zinc-900 shadow-[0_2px_6px_-3px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            <GoogleIcon className="size-5" />
            {pending ? "Opening Google..." : "Continue with Google"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
