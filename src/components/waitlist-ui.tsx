import { signOut } from "@/app/actions";
import { GoogleButton } from "@/components/google-button";
import { HouseArt } from "@/components/house-art";
import { CheckIcon, HouseGlyph } from "@/components/icons";
import { InstagramForm } from "@/components/instagram-form";
import { site } from "@/lib/site";

export type Entry = { instagram_username: string; created_at: string };

export function Shell({
  step,
  signedIn,
  reserved,
  plot,
  children,
}: {
  step: number;
  signedIn: boolean;
  reserved: boolean;
  plot: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto grid min-h-[100dvh] w-full max-w-6xl grid-rows-[auto_1fr_auto] px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-accent/12 text-accent">
            <HouseGlyph className="size-4.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">{site.brand}</span>
        </div>
        {signedIn && (
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 active:scale-[0.98]"
            >
              Sign out
            </button>
          </form>
        )}
      </header>

      <section className="grid items-center gap-10 py-6 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:py-10">
        <div className="max-w-xl animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-accent" />
            Waitlist open
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[0.95] tracking-tighter text-zinc-50 md:text-6xl">
            {site.headline}
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-400">{site.description}</p>

          <Steps current={step} />

          <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:p-7">
            {children}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms] md:max-w-none">
          <div
            aria-hidden="true"
            className="absolute inset-x-[12%] top-[18%] bottom-[22%] rounded-full bg-accent/[0.07] blur-3xl"
          />
          <div className="relative">
            <HouseArt reserved={reserved} plot={plot} />
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-1.5 border-t border-white/5 py-6 text-xs text-zinc-500 sm:flex-row sm:justify-between">
        <p>{site.privacyNote}</p>
        <p>{site.oneEntryNote}</p>
      </footer>
    </main>
  );
}

function Steps({ current }: { current: number }) {
  const last = site.steps.length - 1;
  return (
    <ol className="mt-9 grid grid-cols-3 gap-3">
      {site.steps.map((label, index) => {
        const done = index < current || (current === last && index === last);
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex flex-col gap-1.5 border-t-2 pt-3 transition-colors ${
              done || active ? "border-accent" : "border-white/10"
            }`}
          >
            <span className="flex h-3.5 items-center font-mono text-[11px] text-zinc-500">
              {done ? <CheckIcon className="size-3.5 text-accent" /> : `0${index + 1}`}
            </span>
            <span className={`text-xs leading-snug sm:text-sm ${active || done ? "text-zinc-100" : "text-zinc-500"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SignInPanel({ authFailed }: { authFailed: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {authFailed && (
        <p role="alert" className="text-sm text-rose-300">
          Google sign-in didn&apos;t finish. Try again.
        </p>
      )}
      <GoogleButton />
      <p className="text-sm text-zinc-500">
        Google sign-in keeps it to one spot per person. Next you&apos;ll add your Instagram.
      </p>
    </div>
  );
}

export function JoinPanel({ email }: { email: string | null }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-400">
        Signed in as <span className="text-zinc-200">{email ?? "your Google account"}</span>
      </p>
      <InstagramForm />
    </div>
  );
}

export function OnListPanel({
  entry,
  position,
  email,
}: {
  entry: Entry;
  position: number | null;
  email: string | null;
}) {
  const joined = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(entry.created_at));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">You&apos;re on the list</p>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-tight text-accent">
            {position ? `#${position}` : "Saved"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 text-xs font-medium text-accent">
          <CheckIcon className="size-3.5" />
          Spot saved
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-zinc-500">Instagram</dt>
          <dd className="mt-1 truncate font-mono text-zinc-100">@{entry.instagram_username}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-zinc-500">Google account</dt>
          <dd className="mt-1 truncate text-zinc-100">{email ?? "Signed in"}</dd>
        </div>
      </dl>
      <p className="text-xs text-zinc-500">Joined {joined}.</p>
    </div>
  );
}

export function LoadErrorPanel() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-rose-300">Couldn&apos;t load your waitlist spot.</p>
      <p className="text-sm text-zinc-400">Refresh the page in a moment. If you run this site, check the server log.</p>
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-medium text-zinc-100">Supabase isn&apos;t connected yet.</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-zinc-400">
        <li>
          Copy <code className="font-mono text-zinc-200">.env.example</code> to{" "}
          <code className="font-mono text-zinc-200">.env.local</code>.
        </li>
        <li>Paste your Supabase project URL and publishable key into it.</li>
        <li>
          Restart <code className="font-mono text-zinc-200">npm run dev</code>.
        </li>
      </ol>
      <p className="text-zinc-500">Full steps are in README.md.</p>
    </div>
  );
}
