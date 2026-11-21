import { AuthForm } from "../auth-form";

export const metadata = { title: "Create a workspace" };
export default function Page() {
  return <AuthForm mode="register" />;
}
