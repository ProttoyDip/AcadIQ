export interface ExtractedQuestion {
  sequenceNumber: number;
  questionText: string;
  marks: number;
}

/** Deterministic first-pass extraction; downstream AI performs semantic review. */
export function extractQuestions(text: string): ExtractedQuestion[] {
  const normalized = text.replace(/\r/g, "\n");
  const boundary = "(?:^|\\n)\\s*(?:Q(?:uestion)?\\s*)?(\\d{1,3})\\s*[.):\\-]\\s*";
  const pattern = new RegExp(`${boundary}([\\s\\S]*?)(?=${boundary}|$)`, "gi");
  const questions: ExtractedQuestion[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const questionText = match[2].trim();
    if (!questionText) continue;
    const marksMatch = questionText.match(/(?:\[|\()\s*(\d+(?:\.\d+)?)\s*(?:marks?)?\s*(?:\]|\))/i);
    questions.push({
      sequenceNumber: questions.length + 1,
      questionText,
      marks: marksMatch ? Math.round(Number(marksMatch[1])) : 0,
    });
  }

  if (questions.length === 0 && normalized.trim().length >= 3) {
    return [{ sequenceNumber: 1, questionText: normalized.trim(), marks: 0 }];
  }
  return questions;
}
