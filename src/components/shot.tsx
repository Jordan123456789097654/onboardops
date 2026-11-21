import { BrowserFrame } from "./mocks";

/** A real screenshot of the app (captured by scripts/screenshots.mjs) in light and dark, shown to match the visitor's theme. */
export function Shot({ name, alt, url, priority }: { name: string; alt: string; url: string; priority?: boolean }) {
  const common = { width: 2040, height: 1260, alt, decoding: "async" as const, loading: priority ? ("eager" as const) : ("lazy" as const), className: "block h-auto w-full" };
  return (
    <BrowserFrame url={url}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/screens/${name}-light.jpg`} {...common} className={`${common.className} shot-light`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/screens/${name}-dark.jpg`} {...common} className={`${common.className} shot-dark`} />
    </BrowserFrame>
  );
}
