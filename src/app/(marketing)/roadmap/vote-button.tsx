"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleVoteAction } from "@/actions/roadmap";
import { useAction } from "@/components/ui";

export function VoteButton({ id, votes, voted, signedIn }: { id: string; votes: number; voted: boolean; signedIn: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  if (!signedIn) return <Link href="/login" className="btn shrink-0" title="Sign in to vote"><span className="mono">{votes}</span> votes</Link>;
  return (
    <button className={`btn shrink-0 ${voted ? "!border-accent text-accent" : ""}`} disabled={pending} aria-pressed={voted} onClick={() => exec(() => toggleVoteAction(id), { onOk: () => router.refresh() })}>
      <span className="mono">{votes}</span> {voted ? "Voted" : "Vote"}
    </button>
  );
}
