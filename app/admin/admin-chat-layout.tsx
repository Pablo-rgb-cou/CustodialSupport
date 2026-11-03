"use client";

import { createContext, useEffect } from "react";

// A conversation owns the admin content viewport until it closes or unmounts.
// Keep this contract outside the route files so layout exports stay conventional.
export const AdminChatLayoutContext = createContext<(open: boolean) => void>(() => {});

let pageScrollLocks = 0;
let restorePageScroll: (() => void) | undefined;

// Chat, mobile navigation and photo overlays can overlap. Restore scrolling only
// after the final owner releases it, regardless of effect cleanup order.
export function useAdminPageScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (pageScrollLocks === 0) {
      const html = document.documentElement;
      const body = document.body;
      const previous = {
        htmlOverflow: html.style.overflow,
        htmlOverscroll: html.style.overscrollBehavior,
        bodyOverflow: body.style.overflow,
        bodyOverscroll: body.style.overscrollBehavior,
      };
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      restorePageScroll = () => {
        html.style.overflow = previous.htmlOverflow;
        html.style.overscrollBehavior = previous.htmlOverscroll;
        body.style.overflow = previous.bodyOverflow;
        body.style.overscrollBehavior = previous.bodyOverscroll;
      };
    }
    pageScrollLocks += 1;
    return () => {
      pageScrollLocks -= 1;
      if (pageScrollLocks === 0) {
        restorePageScroll?.();
        restorePageScroll = undefined;
      }
    };
  }, [locked]);
}
