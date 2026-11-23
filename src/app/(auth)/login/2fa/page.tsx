import { redirect } from "next/navigation";
import { readMfaPending } from "@/lib/login";
import { MfaLogin } from "./mfa-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-factor sign-in", robots: { index: false, follow: false } };

export default async function Page() {
  const p = await readMfaPending();
  if (!p) redirect("/login");
  if (p.enroll) redirect("/login/2fa/setup");
  return <MfaLogin />;
}
