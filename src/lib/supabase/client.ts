import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

// Browser client, used only to start the Google sign-in redirect.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
