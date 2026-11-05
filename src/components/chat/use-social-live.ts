"use client";

import { useEffect } from "react";
import { emitIncoming, getSocial, setInbox, setUnread } from "@/lib/social";
import { fetchInbox } from "@/lib/social-api";
import { createClient } from "@/lib/supabase/client";
import type { MyHouse } from "@/lib/world";

type MessageRow = { id: number; from_plot: number; to_plot: number; body: string; created_at: string };

// Keeps your conversations up to date while the page is open: new messages arrive live through
// Supabase Realtime, and the inbox is also checked every 30 s (every 15 s if live updates aren't
// connected), so nothing is missed either way.
export function useSocialLive(me: MyHouse | null) {
  const plot = me?.plot ?? 0;
  const unread = me?.unread ?? 0;

  useEffect(() => {
    if (plot) setUnread(unread);
  }, [plot, unread]);

  useEffect(() => {
    if (!plot) return;
    let stopped = false;
    let live = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const check = async (first = false) => {
      const r = await fetchInbox();
      if (!r.ok || stopped) return;
      // Without live updates, a higher unread count is how we notice a new message.
      if (!first && !live) {
        const before = getSocial().inbox;
        for (const c of r.data) {
          const prev = before.find((x) => x.with === c.with);
          if (!c.fromMe && !c.blocked && c.unread > (prev?.unread ?? 0) && c.at !== prev?.at) {
            emitIncoming({ id: -1, from: c.with, body: c.last, at: c.at });
          }
        }
      }
      setInbox(r.data);
    };

    void check(true);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (stopped) return;
      channel = supabase
        .channel(`inbox-${plot}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `to_plot=eq.${plot}` }, (payload) => {
          const row = payload.new as Partial<MessageRow>;
          if (typeof row.id !== "number" || typeof row.from_plot !== "number") return;
          emitIncoming({ id: row.id, from: row.from_plot, body: String(row.body ?? ""), at: String(row.created_at ?? "") });
          void check();
        })
        .subscribe((status) => {
          live = status === "SUBSCRIBED";
        });
    })();

    let tick = 0;
    const id = window.setInterval(() => {
      tick++;
      if (document.visibilityState !== "visible") return;
      if (live ? tick % 6 === 0 : tick % 3 === 0) void check();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [plot]);
}
