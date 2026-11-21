import { VerifyClient } from "./client";

export const metadata = { title: "Verify your email" };
export default function Page({ searchParams }: { searchParams: { token?: string; e?: string } }) {
  return <VerifyClient token={searchParams.token ?? ""} emailId={searchParams.e} />;
}
