"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { removeTypingChannel, waitForTypingChannelLeave } from "./ticket-typing-channel";

export function useClientTicketTyping(clientId: string, ticketId: string | null) {
  const publish = useRef<((typing: boolean) => void) | null>(null);
  const lastInputAt = useRef(0);

  const updateTyping = useCallback((typing: boolean) => {
    lastInputAt.current = typing ? Date.now() : 0;
    publish.current?.(typing);
  }, []);

  useEffect(() => {
    if (!clientId || !ticketId) return;
    let active = true;
    let ready = false;
    let lastSentAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    lastInputAt.current = 0;

    const send = (isTyping: boolean) => {
      if (!active || !ready || !channel) return;
      // Throttle keystrokes while still refreshing the admin's expiry timer.
      if (isTyping && Date.now() - lastSentAt < 600) return;
      lastSentAt = Date.now();
      void channel.send({
        type: "broadcast", event: "typing",
        payload: { actor: "client", isTyping },
      }).then((result) => {
        if (active && result !== "ok") console.warn("Client typing broadcast failed:", result);
      });
    };
    const publishTyping = (typing: boolean) => {
      if (idleTimer) clearTimeout(idleTimer);
      send(typing);
      if (typing) idleTimer = setTimeout(() => {
        lastInputAt.current = 0;
        send(false);
        idleTimer = null;
      }, 1800);
    };
    publish.current = publishTyping;

    void (async () => {
      try {
        // Ensure the private join uses the restored/renewed user JWT.
        await waitForTypingChannelLeave(`ticket-typing:${ticketId}`);
        await supabase.realtime.setAuth();
        if (!active) return;
        channel = supabase.channel(`ticket-typing:${ticketId}`, {
          config: { private: true, broadcast: { ack: true } },
        }).subscribe((status, error) => {
          if (!active) return;
          ready = status === "SUBSCRIBED";
          if (ready) {
            lastSentAt = 0;
            publishTyping(lastInputAt.current > Date.now() - 1800);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("Client typing subscription failed:", error?.message ?? status);
          }
        });
      } catch (error) {
        if (active) console.warn("Could not connect client typing channel:", error);
      }
    })();

    return () => {
      if (ready) send(false);
      active = false;
      if (idleTimer) clearTimeout(idleTimer);
      if (publish.current === publishTyping) publish.current = null;
      if (channel) void removeTypingChannel(channel);
    };
  }, [clientId, ticketId]);

  return updateTyping;
}
