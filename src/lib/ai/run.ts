import { chat, AiError, type Usage } from "./groq";
import { RULES, type TaskDef } from "./tasks";

const MAX_INPUT_CHARS = 40_000;

/** Pulls the JSON object out of a reply, tolerating code fences and stray text around it. */
export function extractJson(text: string): unknown {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* fall through to the first {...} block */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* give up */ } }
  throw new AiError("bad_output");
}

/**
 * Runs one task: validates the input, asks the model, validates the reply against the task's schema, and retries once with the problem
 * spelled out if the reply was unusable. Returns a draft; it never writes anything.
 */
export async function runTask<I, O>(def: TaskDef<I, O>, rawInput: unknown, opts: { extraRules?: string } = {}): Promise<{ output: O; usage: Usage; inChars: number; outChars: number }> {
  const input = def.input.parse(rawInput);
  const user = def.user(input);
  if (user.length > MAX_INPUT_CHARS) throw new AiError("too_large");
  const system = `${RULES}\n\n${def.system}${opts.extraRules ? `\n\n${opts.extraRules}` : ""}\n\nThe JSON object must look like: ${def.shape}`;
  let usage: Usage = { input: 0, output: 0 };
  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usage: u } = await chat({ tier: def.tier, system, user: attempt ? `${user}\n\nYour previous reply could not be used (${lastProblem}). Reply again with a valid JSON object only.` : user, maxTokens: def.maxTokens, effort: def.effort });
    usage = { input: usage.input + u.input, output: usage.output + u.output };
    try {
      const parsed = def.output.safeParse(extractJson(text));
      if (parsed.success) return { output: parsed.data, usage, inChars: user.length, outChars: text.length };
      lastProblem = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "reply"}: ${i.message}`).join("; ");
    } catch { lastProblem = "it was not valid JSON"; }
  }
  throw new AiError("bad_output");
}
