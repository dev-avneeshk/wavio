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
      <Shell step={0} signedIn={false} reserved={false} plot="#????">
        <SetupNotice />
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims ?? null;

  if (!claims) {
    return (
      <Shell step={0} signedIn={false} reserved={false} plot="#????">
        <SignInPanel authFailed={errorParam === "auth"} />
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
      <Shell step={1} signedIn reserved={false} plot="#????">
        <LoadErrorPanel />
      </Shell>
    );
  }

  if (!entry) {
    return (
      <Shell step={1} signedIn reserved={false} plot="#????">
        <JoinPanel email={email} />
      </Shell>
    );
  }

  const { data: pos, error: posError } = await supabase.rpc("waitlist_position");
  if (posError) console.error("[waitlist] position failed:", posError.code, posError.message);
  const position = typeof pos === "number" && pos > 0 ? pos : null;

  return (
    <Shell step={2} signedIn reserved plot={position ? `#${position}` : "#????"}>
      <OnListPanel entry={entry} position={position} email={email} />
    </Shell>
  );
}
