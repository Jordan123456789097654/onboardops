import { redirect } from "next/navigation";
import { getActiveMembership, unauthPath } from "@/lib/auth";

export default async function AppIndex() {
  const m = await getActiveMembership();
  if (!m) redirect(await unauthPath());
  redirect(m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview");
}
