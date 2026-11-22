"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "oo-cookie-notice-v1";

/** We set only the cookies needed to sign in and remember your theme, and count page views without cookies or personal data. So this is a notice, not a consent wall. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setShow(false); };
  return (
    <div role="region" aria-label="Cookie notice" className="no-print fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-lg border border-line bg-surface p-3 text-[13px] shadow-lg">
      <p>We only use cookies needed to sign you in and remember your theme. We count page views without cookies, ads or tracking across sites. <Link href="/legal/cookies" className="text-accent">Cookie policy</Link></p>
      <div className="mt-2 flex justify-end"><button className="btn" onClick={close}>Got it</button></div>
    </div>
  );
}
