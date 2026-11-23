import { apiWrite, logInfraction, maybeBulk } from "@/lib/api-write";

export const dynamic = "force-dynamic";

/** POST /api/v1/infractions. Scope: infractions:write. Verbal warnings, written infractions and strike points only. One object or an array of up to 100. */
export async function POST(req: Request) {
  return apiWrite(req, "infractions:write", (a, body) => maybeBulk(body, (item) => logInfraction(a, item)), 201);
}
