"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mountSmartsupp, setSmartsuppVisibility } from "@/lib/smartsupp-lifecycle";

/** Mounted only after getUser() and the client's protected profile role check. */
export default function SmartsuppChat({ userId, hidden }: { userId: string; hidden: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/dashboard" || !userId) return;
    return mountSmartsupp(userId);
  }, [pathname, userId]);
  useEffect(() => {
    setSmartsuppVisibility(pathname === "/dashboard" && !hidden);
  }, [pathname, hidden, userId]);
  // Smartsupp supplies the chat UI. Optional tracking remains denied in the loader.
  return null;
}
