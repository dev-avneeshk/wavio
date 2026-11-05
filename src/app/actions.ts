"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseInstagramUsername } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error: string | null; plotGone?: number };

export async function joinWaitlist(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const raw = formData.get("instagram");
  const parsed = parseInstagramUsername(typeof raw === "string" ? raw : "");
  if (!parsed.ok) return { error: parsed.error };

  // The plot they tapped on the map, if any. The database checks it's free and in an open town.
  const rawPlot = formData.get("plot");
  const plot = typeof rawPlot === "string" && rawPlot !== "" ? Number(rawPlot) : null;
  if (plot !== null && !(Number.isInteger(plot) && plot >= 1 && plot <= 1_000_000_000)) {
    return { error: "That plot doesn't exist. Tap an empty plot on the map." };
  }

  // The house whose link they came from, if any. The database drops it if that house doesn't exist.
  const rawInvite = formData.get("invite");
  const invite = typeof rawInvite === "string" && rawInvite !== "" ? Number(rawInvite) : null;
  const invitedBy = invite !== null && Number.isInteger(invite) && invite >= 1 && invite <= 1_000_000_000 ? invite : null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Your session ended. Sign in with Google again." };

  // Only the username, the picked plot and the invite are sent. The database fills user_id, email
  // and name from the session.
  const row: { instagram_username: string; plot?: number; invited_by?: number } = { instagram_username: parsed.username };
  if (plot !== null) row.plot = plot;
  if (invitedBy !== null && invitedBy !== plot) row.invited_by = invitedBy;
  const { error } = await supabase.from("waitlist").insert(row);

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("waitlist_one_per_account")) {
        // Already joined (for example, a double submit). Just show their spot.
        revalidatePath("/");
        return { error: null };
      }
      if (error.message.includes("waitlist_plot_unique") && plot !== null) {
        // Someone got there first. Refresh the map so it shows their house.
        revalidatePath("/");
        return { error: `Someone just took plot #${plot.toLocaleString("en")}. Pick another one.`, plotGone: plot };
      }
      return { error: `@${parsed.username} is already on the waitlist from another Google account.` };
    }
    if (error.hint === "waitlist_plot_not_open" && plot !== null) {
      revalidatePath("/");
      return { error: "That plot isn't open yet. Pick one in the town that's filling now.", plotGone: plot };
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
