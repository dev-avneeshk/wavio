import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here (via Supabase) with a one-time code.
// We swap it for a session cookie, then send them to the home page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const home = new URL("/", origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(home);
    console.error("[auth] code exchange failed:", error.message);
  }

  // No code (user cancelled on Google) or the exchange failed.
  home.searchParams.set("error", "auth");
  return NextResponse.redirect(home);
}
