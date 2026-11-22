"use client";
import { useEffect } from "react";

/** Remembers a partner referral code (?ref=code) on this device for later sign-up. No cookie is set. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[a-z0-9-]{3,30}$/i.test(ref)) localStorage.setItem("oo-ref", ref.toLowerCase());
    } catch { /* storage unavailable */ }
  }, []);
  return null;
}
