"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspaceRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { inviteEmployee, type InviteOutcome } from "@/lib/invites";
import { run } from "./_util";

/** Sends sign-in invites to many employees at once (Managers and above). */
export async function bulkInviteAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const ids = z.array(z.string()).min(1, "Pick at least one employee").max(200, "Invite at most 200 people at once").parse(input);
    const out: InviteOutcome[] = [];
    for (const id of ids) out.push(await inviteEmployee(ctx, id));
    revalidatePath("/app", "layout");
    return out;
  });
}
