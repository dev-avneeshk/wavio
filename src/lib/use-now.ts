"use client";

import { useEffect, useState } from "react";

// The time in Unix seconds, refreshed every `everyMs`, for countdowns and build percentages.
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

// Share a link with the phone's share sheet, or copy it. Returns what happened, for a short note.
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ url, title });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (e) {
    // The person closed the share sheet.
    if (e instanceof DOMException && e.name === "AbortError") return "failed";
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
