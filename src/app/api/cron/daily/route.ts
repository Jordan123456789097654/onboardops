export const dynamic = "force-dynamic";

/** Automated cron jobs are disabled. Reminders can still be triggered manually from Workspace Settings. */
export async function GET() {
  return Response.json({ ok: true, disabled: true, message: "Automated cron jobs are disabled." });
}
