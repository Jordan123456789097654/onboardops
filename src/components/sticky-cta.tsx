"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** A phone-only call to action that appears after the first screen of the home page. */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden">
      <Link href="/register" className="btn-primary !h-11 w-full !text-sm">Create a workspace. Free in beta.</Link>
    </div>
  );
}
