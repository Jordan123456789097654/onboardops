"use client";
import { Mail } from "lucide-react";
import { emailReportNowAction } from "@/actions/integrations";
import { useAction } from "@/components/ui";

export function EmailReportButton() {
  const { exec, pending } = useAction();
  return <button className="btn" disabled={pending} onClick={() => exec(() => emailReportNowAction(), { success: "Summary emailed to you" })}><Mail className="h-3.5 w-3.5" />{pending ? "Sending…" : "Email me this summary"}</button>;
}
