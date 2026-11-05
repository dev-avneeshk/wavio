"use client";

import { DAYS_PER_INVITE } from "@/lib/house";
import { useInvite } from "@/lib/invite";

// "You came from house #12's link": joining from it takes days off that house's build.
export function InviteNote() {
  const invite = useInvite();
  if (!invite) return null;
  return (
    <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-snug text-emerald-900 ring-1 ring-emerald-200">
      You came from house #{invite.toLocaleString("en")}&apos;s link. When you join, their house gets built {DAYS_PER_INVITE} days
      sooner.
    </p>
  );
}
