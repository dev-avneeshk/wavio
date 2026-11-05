import {
  JoinPanel,
  LoadErrorPanel,
  OnListPanel,
  SetupNotice,
  Shell,
  SignInPanel,
} from "@/components/waitlist-ui";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { emptyWorld, nextPlot, parseWorldView } from "@/lib/world";

type HomeProps = {
  searchParams: Promise<{ error?: string | string[]; h?: string | string[] }>;
};

// ?h=12 opens the map on house 12 (shared and invite links).
const housePlot = (raw: string | string[] | undefined) => {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000_000 ? n : null;
};

export default async function Home({ searchParams }: HomeProps) {
  const { error: errorParam, h } = await searchParams;
  const startAt = housePlot(h);

  if (!hasSupabaseEnv) {
    return (
      <Shell step={0} signedIn={false} view={emptyWorld}>
        <SetupNotice />
      </Shell>
    );
  }

  // One call gets the world's numbers, the houses of the town to show first (yours, or the one
  // where the next house goes), and your own house if you have one.
  const supabase = await createClient();
  const [{ data: auth }, world] = await Promise.all([supabase.auth.getClaims(), supabase.rpc("waitlist_world")]);
  if (world.error) console.error("[waitlist] world failed:", world.error.code, world.error.message);
  const view = world.error ? null : parseWorldView(world.data);
  if (!world.error && !view) console.error("[waitlist] world returned an unexpected shape");

  const claims = auth?.claims ?? null;
  if (!claims) {
    const shown = view ?? emptyWorld;
    return (
      <Shell step={0} signedIn={false} view={shown} startAt={startAt}>
        <SignInPanel authFailed={errorParam === "auth"} nextPlot={nextPlot(shown)} />
      </Shell>
    );
  }

  const email = typeof claims.email === "string" ? claims.email : null;

  if (!view) {
    return (
      <Shell step={1} signedIn view={emptyWorld}>
        <LoadErrorPanel />
      </Shell>
    );
  }

  if (!view.me) {
    return (
      <Shell step={1} signedIn view={view} startAt={startAt}>
        <JoinPanel email={email} nextPlot={nextPlot(view)} />
      </Shell>
    );
  }

  return (
    <Shell step={2} signedIn view={view} startAt={startAt}>
      <OnListPanel me={view.me} email={email} houses={view.plots} />
    </Shell>
  );
}
