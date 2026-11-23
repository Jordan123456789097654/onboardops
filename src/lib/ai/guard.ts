import { hit } from "../rate-limit";
import { featureOn } from "../features";
import { aiConfigured } from "./groq";

export class AiLimitError extends Error {
  constructor(message: string) { super(message); this.name = "AiLimitError"; }
}

export type Risk = "low" | "care";

/** "Care" tasks read employee or case text. They are open by default; setting AI_CARE_FROM to a future date holds them closed until then. */
export const careOpen = (now = Date.now()) => { const d = Date.parse(process.env.AI_CARE_FROM ?? ""); return !Number.isFinite(d) || now >= d; };

export const AI_LIMITS = { userPerHour: 30, workspacePerDay: 200, workspacePerMonth: 3000 };

/** Throws a friendly AiLimitError when AI is off, not allowed for this kind of task, or over a limit. */
export async function guardAi(workspace: { id: string; features: unknown }, userId: string, risk: Risk) {
  if (process.env.AI_DISABLED === "1" || !aiConfigured()) throw new AiLimitError("AI is not available right now.");
  if (!featureOn(workspace.features, "ai")) throw new AiLimitError("AI assistance is turned off for this workspace. An owner or admin can turn it on in Settings, Features.");
  if (risk === "care") {
    if (!featureOn(workspace.features, "aiPeople")) throw new AiLimitError("AI tools that read case or employee text are turned off for this workspace. An owner or admin can turn them on in Settings, Features.");
    if (!careOpen()) throw new AiLimitError("AI tools that read case or employee text are not available yet. They open after the notice period for our updated privacy terms.");
  }
  const u = await hit(`ai:u:${userId}`, AI_LIMITS.userPerHour, 3600);
  if (u) throw new AiLimitError(`You have used the AI a lot this hour. Try again in ${Math.ceil(u / 60)} minute${u > 90 ? "s" : ""}.`);
  const d = await hit(`ai:w:d:${workspace.id}`, AI_LIMITS.workspacePerDay, 86400);
  if (d) throw new AiLimitError("This workspace has reached today's AI limit. It resets within 24 hours.");
  const m = await hit(`ai:w:m:${workspace.id}`, AI_LIMITS.workspacePerMonth, 30 * 86400);
  if (m) throw new AiLimitError("This workspace has reached this month's AI limit.");
}
