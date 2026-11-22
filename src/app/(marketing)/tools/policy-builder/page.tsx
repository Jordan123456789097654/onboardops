import { PageShell, CtaBand } from "@/components/page-shell";
import { PolicyBuilder } from "@/components/tools/tools-ui";

export const metadata = { title: "Free policy builder", description: "Build a plain-language attendance, phone, safety, dress code or social media policy, plus a sign-off sheet.", alternates: { canonical: "/tools/policy-builder" } };

export default function Page() {
  return (
    <PageShell eyebrow="Free tool" title="Free policy builder" intro="Pick a topic, answer a few questions, and get a draft policy and a printable sign-off sheet.">
      <PolicyBuilder />
      <CtaBand title="Keep it with your team's records" text="Create a free workspace and your drafts become real templates, policies and rules." />
    </PageShell>
  );
}
