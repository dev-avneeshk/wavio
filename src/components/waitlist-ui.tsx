import { signOut } from "@/app/actions";
import { GoogleButton } from "@/components/google-button";
import { CheckIcon, HouseGlyph, PaintRollerIcon } from "@/components/icons";
import { InstagramForm } from "@/components/instagram-form";
import { Land } from "@/components/land/land";
import { ShellFrame } from "@/components/shell-frame";
import { site } from "@/lib/site";
import { TOWN_SIZE, nextPlot, plotInTown, townOf, type MyHouse, type WorldView } from "@/lib/world";

const fmt = (n: number) => n.toLocaleString("en");

type ShellProps = {
  step: number;
  signedIn: boolean;
  view: WorldView;
  children: React.ReactNode;
};

export function Shell({ step, signedIn, view, children }: ShellProps) {
  const next = nextPlot(view);
  const summary = view.me
    ? `House #${fmt(view.me.plot)} · being built in ${site.townName(townOf(view.me.plot))}`
    : `${site.headline.replace(/\.$/, "")} · #${fmt(next)} is next`;

  const header = (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 md:p-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.45)] backdrop-blur">
        <span className="grid size-7 place-items-center rounded-full bg-accent text-white">
          <HouseGlyph className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-900">{site.brand}</span>
      </div>
      {signedIn && (
        <form action={signOut} className="pointer-events-auto">
          <button
            type="submit"
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.45)] backdrop-blur transition-colors hover:bg-white hover:text-zinc-950 active:scale-[0.98]"
          >
            Sign out
          </button>
        </form>
      )}
    </header>
  );

  return (
    <ShellFrame map={<Land view={view} />} header={header} top={<Counter view={view} />} summary={summary}>
      <h1 className="mt-4 text-3xl font-semibold leading-[0.98] tracking-tighter text-zinc-950 md:text-[2.5rem]">
        {site.headline}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{site.description}</p>

      <Steps current={step} />

      <div className="mt-6">{children}</div>

      <div className="mt-6 flex flex-col gap-1 border-t border-zinc-200/80 pt-4 text-xs leading-relaxed text-zinc-500">
        <p>{site.privacyNote}</p>
        <p>{site.oneEntryNote}</p>
      </div>
    </ShellFrame>
  );
}

function Counter({ view }: { view: WorldView }) {
  const count = view.houses;
  const next = nextPlot(view);
  const text =
    count === 0
      ? `No houses yet. House #1 in ${site.townName(1)} is waiting.`
      : `${fmt(count)} ${count === 1 ? "house" : "houses"} being built${view.me ? "" : ` · #${fmt(next)} is next`}`;
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
      <span className="size-1.5 animate-pulse-dot rounded-full bg-accent" />
      {text}
    </p>
  );
}

function Steps({ current }: { current: number }) {
  const last = site.steps.length - 1;
  return (
    <ol className="mt-6 grid grid-cols-3 gap-3">
      {site.steps.map((label, index) => {
        const done = index < current || (current === last && index === last);
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex flex-col gap-1.5 border-t-2 pt-2.5 transition-colors ${
              done || active ? "border-accent" : "border-zinc-200"
            }`}
          >
            <span className="flex h-3.5 items-center font-mono text-[11px] text-zinc-400">
              {done ? <CheckIcon className="size-3.5 text-accent" /> : `0${index + 1}`}
            </span>
            <span className={`text-xs leading-snug ${active || done ? "font-medium text-zinc-900" : "text-zinc-400"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SignInPanel({ authFailed, nextPlot }: { authFailed: boolean; nextPlot: number }) {
  return (
    <div className="flex flex-col gap-3">
      {authFailed && (
        <p role="alert" className="text-sm text-red-600">
          Google sign-in didn&apos;t finish. Try again.
        </p>
      )}
      <GoogleButton />
      <p className="text-sm text-zinc-500">
        Next you&apos;ll add your Instagram, and house #{fmt(nextPlot)} in {site.townName(townOf(nextPlot))} is yours.
      </p>
    </div>
  );
}

export function JoinPanel({ email, nextPlot }: { email: string | null; nextPlot: number }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Signed in as <span className="font-medium text-zinc-800">{email ?? "your Google account"}</span>
      </p>
      <InstagramForm nextPlot={nextPlot} />
    </div>
  );
}

export function OnListPanel({ me, email }: { me: MyHouse; email: string | null }) {
  const joined = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(me.createdAt));
  const town = site.townName(townOf(me.plot));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">You&apos;re on the waitlist</p>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-tight text-zinc-950">#{fmt(me.plot)}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-amber-500" />
          Being built
        </span>
      </div>
      <p className="text-[15px] leading-relaxed text-zinc-700">
        Your house is being built on plot {fmt(plotInTown(me.plot))} of {fmt(TOWN_SIZE)} in {town}. It&apos;s the one with
        the crane and the yellow pin.
      </p>
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-zinc-700 shadow-[0_2px_6px_-3px_rgba(0,0,0,0.25)]">
          <PaintRollerIcon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{site.customizeTitle}</p>
          <p className="text-xs leading-snug text-zinc-500">{site.customizeNote}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Soon
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 border-t border-zinc-200/80 pt-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-zinc-500">Instagram</dt>
          <dd className="mt-0.5 truncate font-mono text-zinc-900">@{me.username}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-zinc-500">Google account</dt>
          <dd className="mt-0.5 truncate text-zinc-900">{email ?? "Signed in"}</dd>
        </div>
      </dl>
      <p className="text-xs text-zinc-500">Joined {joined}.</p>
    </div>
  );
}

export function LoadErrorPanel() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-red-600">Couldn&apos;t load your house.</p>
      <p className="text-sm text-zinc-500">Refresh the page in a moment. If you run this site, check the server log.</p>
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-medium text-zinc-900">Supabase isn&apos;t connected yet.</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-zinc-600">
        <li>
          Copy <code className="font-mono text-zinc-900">.env.example</code> to{" "}
          <code className="font-mono text-zinc-900">.env.local</code>.
        </li>
        <li>Paste your Supabase project URL and publishable key into it.</li>
        <li>
          Restart <code className="font-mono text-zinc-900">npm run dev</code>.
        </li>
      </ol>
      <p className="text-zinc-500">Full steps are in README.md.</p>
    </div>
  );
}
