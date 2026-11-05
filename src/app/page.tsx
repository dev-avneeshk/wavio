import {
  JoinPanel,
  LoadErrorPanel,
  OnListPanel,
  SetupNotice,
  Shell,
  SignInPanel,
  type Entry,
} from "@/components/waitlist-ui";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { error: errorParam } = await searchParams;

  if (!hasSupabaseEnv) {
    return (
      <Shell step={0} signedIn={false} names={[]} mine={null} mineName={null}>
        <SetupNotice />
      </Shell>
    );
  }

  const supabase = await createClient();
  const [{ data: auth }, houses] = await Promise.all([supabase.auth.getClaims(), supabase.rpc("waitlist_houses")]);

  // Every claimed Instagram username in join order: names[0] lives on plot #1.
  if (houses.error) console.error("[waitlist] houses failed:", houses.error.code, houses.error.message);
  const names: string[] = Array.isArray(houses.data)
    ? houses.data.filter((n: unknown): n is string => typeof n === "string")
    : [];
  const nextPlot = names.length + 1;

  const claims = auth?.claims ?? null;
  if (!claims) {
    return (
      <Shell step={0} signedIn={false} names={names} mine={null} mineName={null}>
        <SignInPanel authFailed={errorParam === "auth"} nextPlot={nextPlot} />
      </Shell>
    );
  }

  const email = typeof claims.email === "string" ? claims.email : null;

  // RLS only returns the signed-in user's own row; the filter just makes that explicit.
  const { data: entry, error } = await supabase
    .from("waitlist")
    .select("instagram_username, created_at")
    .eq("user_id", claims.sub)
    .maybeSingle<Entry>();

  if (error) {
    console.error("[waitlist] load failed:", error.code, error.message);
    return (
      <Shell step={1} signedIn names={names} mine={null} mineName={null}>
        <LoadErrorPanel />
      </Shell>
    );
  }

  if (!entry) {
    return (
      <Shell step={1} signedIn names={names} mine={null} mineName={null}>
        <JoinPanel email={email} nextPlot={nextPlot} />
      </Shell>
    );
  }

  const index = names.indexOf(entry.instagram_username);
  const position = index >= 0 ? index + 1 : null;

  return (
    <Shell step={2} signedIn names={names} mine={position} mineName={entry.instagram_username}>
      <OnListPanel entry={entry} position={position} email={email} />
    </Shell>
  );
}
