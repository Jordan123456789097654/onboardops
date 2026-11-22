import Link from "next/link";
import { Brand } from "@/components/ui";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

const links: [string, string][] = [["Home", "/"], ["Help center", "/support"], ["Free tools", "/tools"], ["Blog", "/blog"], ["Pricing", "/pricing"], ["Contact us", "/contact"], ["Sign in", "/login"], ["Find my workplace", "/staff"]];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
      <p className="mono mt-10 text-sm text-soft">404</p>
      <h1 className="mt-1 text-3xl font-semibold">We could not find that page</h1>
      <p className="mt-3 text-[14px] text-soft">The address may have a typo, or the page may have moved. Here are some places to go instead.</p>
      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{links.map(([l, h]) => <li key={h}><Link href={h} className="btn w-full">{l}</Link></li>)}</ul>
      <p className="mt-8 text-[13px] text-soft">Looking for a workspace address? Use <Link className="text-accent" href="/staff">Find my workplace</Link>, or ask your employer for the link.</p>
    </main>
  );
}
