/**
 * Best-effort PII redaction applied before any student work leaves the server
 * for a third-party LLM. Regex-based (no NER), so it is honest about scope:
 * emails, phone numbers, student-ID-shaped tokens, explicit "Name:" fields and
 * any identifiers the caller already knows. Replacement tokens are stable so a
 * redacted answer still reads coherently.
 */

export interface RedactionResult {
  text: string;
  /** Category → number of replacements. Empty when nothing was redacted. */
  redactions: Record<string, number>;
}

const PATTERNS: Array<{ label: string; regex: RegExp; token: string }> = [
  { label: "email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, token: "[EMAIL]" },
  { label: "phone", regex: /(?<!\d)(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}(?!\d)/g, token: "[PHONE]" },
  // University IDs: 2-4 letters/digits prefix + 6-10 digits, or a 7+ digit run, or dotted/dashed roll numbers.
  { label: "studentId", regex: /\b(?:[A-Z]{1,4}[-/]?\d{6,10}|\d{2}[.\-/]\d{2}[.\-/]\d{2,4}[.\-/]\d{2,4}|\d{7,12})\b/g, token: "[STUDENT_ID]" },
  { label: "nameField", regex: /\b(name|student name|student|candidate|submitted by|roll(?: no| number)?|reg(?:istration)? no)\s*[:\-]\s*[^\n,;]{2,60}/gi, token: "$1: [REDACTED]" },
];

export function redactPii(text: string, knownIdentifiers: string[] = []): RedactionResult {
  let output = text;
  const redactions: Record<string, number> = {};
  const count = (label: string, n: number) => {
    if (n) redactions[label] = (redactions[label] ?? 0) + n;
  };

  for (const identifier of knownIdentifiers.map((id) => id.trim()).filter((id) => id.length >= 3)) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = output.match(regex)?.length ?? 0;
    if (matches) output = output.replace(regex, "[STUDENT_ID]");
    count("knownIdentifier", matches);
  }
  for (const { label, regex, token } of PATTERNS) {
    const matches = output.match(regex)?.length ?? 0;
    if (matches) output = output.replace(regex, token);
    count(label, matches);
  }
  return { text: output, redactions };
}

export function totalRedactions(result: RedactionResult): number {
  return Object.values(result.redactions).reduce((a, b) => a + b, 0);
}
