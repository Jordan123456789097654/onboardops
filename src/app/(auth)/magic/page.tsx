import { MagicClient } from "./client";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function Page({ searchParams }: { searchParams: { token?: string; ws?: string } }) {
  return <MagicClient token={searchParams.token ?? ""} ws={searchParams.ws} />;
}
