import { SsoEmail } from "./sso-email";
import { SSO_ERRORS } from "@/lib/sso";

export const metadata = { title: "Single sign-on" };
export default function Page({ searchParams }: { searchParams: { sso_error?: string } }) {
  return <SsoEmail error={searchParams.sso_error ? SSO_ERRORS[searchParams.sso_error] ?? SSO_ERRORS.exchange : undefined} />;
}
