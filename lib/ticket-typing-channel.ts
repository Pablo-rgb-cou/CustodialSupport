import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Broadcast participants share a topic. Wait for the previous subscription's
// asynchronous leave before reusing it after a quick reopen or Strict Mode replay.
const pendingLeaves = new Map<string, Promise<unknown>>();

export async function waitForTypingChannelLeave(topic: string) {
  await pendingLeaves.get("realtime:" + topic);
}

export function removeTypingChannel(channel: RealtimeChannel) {
  const leaving = supabase.removeChannel(channel).finally(() => {
    if (pendingLeaves.get(channel.topic) === leaving) pendingLeaves.delete(channel.topic);
  });
  pendingLeaves.set(channel.topic, leaving);
  return leaving;
}
