"use client";
import { useEffect, useState } from "react";

/** Live status badge from the status page. Follows the site's light or dark theme. */
export function StatusBadge() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  return (
    <span className="inline-block h-[30px] w-[250px] max-w-full">
      {theme && (
        <iframe
          key={theme}
          src={`https://status.onboardops.org/badge?theme=${theme}`}
          title="OnboardOps system status"
          width={250}
          height={30}
          loading="lazy"
          scrolling="no"
          style={{ border: 0, colorScheme: "normal", maxWidth: "100%" }}
        />
      )}
    </span>
  );
}
