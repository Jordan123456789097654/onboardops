/**
 * Removes personal details before text leaves the server for the AI provider, and puts names back in the result.
 * It is a safety net, not a guarantee: tasks that handle people also send as little as possible in the first place.
 */

const PATTERNS: [RegExp, string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[id]"],
  [/(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]"],
  [/\b(?:\d[ -]?){12,19}\b/g, "[number]"],
  [/\b\d{9,}\b/g, "[number]"],
];

export type Redaction = { text: string; restore: <T>(value: T) => T };

/** names: full names or first names to hide. Each distinct name part of 2+ letters becomes [Person 1], [Person 2], ... */
export function redact(input: string, names: string[] = []): Redaction {
  let text = input;
  const map = new Map<string, string>();
  // Contact details and ID numbers first: replacing names first would split an email such as maya.chen@example.com so it no longer matches.
  for (const [re, label] of PATTERNS) text = text.replace(re, label);
  const parts = [...new Set(names.flatMap((n) => n.split(/\s+/)).map((p) => p.trim()).filter((p) => p.length >= 2))].sort((a, b) => b.length - a.length);
  parts.forEach((p, i) => {
    const token = `[Person ${i + 1}]`;
    map.set(token, p);
    text = text.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), token);
  });
  const back = (s: string) => { let out = s; for (const [token, original] of map) out = out.split(token).join(original); return out; };
  const restore = <T,>(value: T): T => {
    if (typeof value === "string") return back(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => restore(v)) as unknown as T;
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, restore(v)])) as unknown as T;
    return value;
  };
  return { text, restore };
}
