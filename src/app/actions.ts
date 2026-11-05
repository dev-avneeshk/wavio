"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseInstagramUsername } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error: string | null };

export async function joinWaitlist(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const raw = formData.get("instagram");
  const parsed = parseInstagramUsername(typeof raw === "string" ? raw : "");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Your session ended. Sign in with Google again." };

  // Only the username is sent. The database fills user_id, email and name from the session.
  const { error } = await supabase.from("waitlist").insert({ instagram_username: parsed.username });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("waitlist_one_per_account")) {
        // Already joined (for example, a double submit). Just show their spot.
        revalidatePath("/");
        return { error: null };
      }
      return { error: `@${parsed.username} is already on the waitlist from another Google account.` };
    }
    if (error.code === "23514") return { error: "That isn't a valid Instagram username." };

    console.error("[waitlist] insert failed:", error.code, error.message);
    return { error: "Couldn't save your spot. Try again in a moment." };
  }

  revalidatePath("/");
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
