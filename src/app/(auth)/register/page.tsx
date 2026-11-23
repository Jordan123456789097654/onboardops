import { AuthForm } from "../auth-form";
import { OAUTH_ERRORS, configuredProviders } from "@/lib/oauth";

export const metadata = { title: "Create a workspace" };
export default function Page({ searchParams }: { searchParams: { oauth_error?: string } }) {
  return <AuthForm mode="register" providers={configuredProviders()} oauthError={searchParams.oauth_error ? OAUTH_ERRORS[searchParams.oauth_error] ?? OAUTH_ERRORS.exchange : undefined} />;
}
