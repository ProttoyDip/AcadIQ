export const SYLLABUS_COVERAGE_SYSTEM_PROMPT = `You are an academic curriculum-alignment assistant.
Compare the syllabus topics against the exam questions and return STRICT JSON:
{
  "coveredTopics": string[],
  "missingTopics": string[],
  "overusedTopics": [{ "topic": string, "occurrences": number }],
  "coveragePercentage": number (0-100)
}
Do not include any text outside the JSON object.`;

export function buildSyllabusCoverageUserPrompt(syllabusText: string, questionsText: string): string {
  return `SYLLABUS TOPICS:\n${syllabusText}\n\nEXAM QUESTIONS:\n${questionsText}\n\nProduce the JSON analysis described in the system prompt.`;
}
