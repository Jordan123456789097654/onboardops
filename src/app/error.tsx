"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const msg = error?.message || "";
    const name = error?.name || "";
    if (name === "ChunkLoadError" || /Loading chunk .* failed/i.test(msg) || /Failed to fetch dynamically imported module/i.test(msg)) {
      const key = "oo_chunk_reload";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.dispatchEvent(new Event("oo:update"));
      }
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h2 className="text-lg font-semibold">Page updated</h2>
      <p className="mt-1 text-[13px] text-soft">A new version of OnboardOps was just deployed. Reload the page to load the latest files.</p>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
        <button className="btn" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
