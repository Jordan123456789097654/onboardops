"use client";
import { usePathname } from "next/navigation";
import { MarketingChat } from "./marketing-chat";

/** The chat bubble on every page except the Staff Console and print views. */
export function ChatMount({ enabled }: { enabled: boolean }) {
  const pathname = usePathname() || "/";
  if (!enabled || pathname.startsWith("/admin") || pathname.startsWith("/print")) return null;
  return <MarketingChat />;
}
