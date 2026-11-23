import { AuthForm } from "../auth-form";
import { OAUTH_ERRORS, configuredProviders } from "@/lib/oauth";
import { SSO_ERRORS } from "@/lib/sso";

export const metadata = { title: "Sign in" };
export default function Page({ searchParams }: { searchParams: { oauth_error?: string; sso_error?: string } }) {
  return <AuthForm mode="login" providers={configuredProviders()} oauthError={searchParams.sso_error ? SSO_ERRORS[searchParams.sso_error] ?? SSO_ERRORS.exchange : searchParams.oauth_error ? OAUTH_ERRORS[searchParams.oauth_error] ?? OAUTH_ERRORS.exchange : undefined} />;
}
