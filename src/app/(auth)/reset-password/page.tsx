import { ResetForm } from "./form";

export const metadata = { title: "Choose a new password" };
export default function Page({ searchParams }: { searchParams: { token?: string; invite?: string } }) {
  return <ResetForm token={searchParams.token ?? ""} invite={searchParams.invite === "1"} />;
}
