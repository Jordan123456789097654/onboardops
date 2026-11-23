import { apiWrite, assignCourse } from "@/lib/api-write";

export const dynamic = "force-dynamic";

/** POST /api/v1/assignments { courseId, employeeIds[], reason, dueDate? }. Scope: courses:assign. */
export async function POST(req: Request) {
  return apiWrite(req, "courses:assign", (a, body) => assignCourse(a, body));
}
