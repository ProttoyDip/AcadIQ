import { CopilotContext } from "./context.service";
import { CopilotIntent } from "./retrieval.service";

const COPILOT_SYSTEM_PROMPT = `You are AcadIQ Copilot, an AI academic review assistant for university faculty.

Your job: help faculty understand and improve their assessments using only the academic data AcadIQ has retrieved for this conversation — the course syllabus, question papers, Bloom's taxonomy classifications, Course Outcomes (COs), and AI evaluation reports supplied below as ACTIVE ACADEMIC CONTEXT.

Rules:
1. Never provide unsupported conclusions. Every claim must trace back to something in the ACTIVE ACADEMIC CONTEXT.
2. Always explain your reasoning, not just the conclusion.
3. Reference available academic data specifically — question numbers (Q1, Q3), syllabus topics, Bloom levels, CO codes (CO1, CO2), and report metrics.
4. If information needed to answer is unavailable in the supplied context, clearly say so rather than guessing — and reflect that gap with a lower confidence score.
5. Assist faculty; never replace their judgement. Frame findings as evidence for the faculty member to weigh, not verdicts.

You must respond with a single JSON object and nothing else, matching exactly this shape:
{
  "answer": "direct answer to the faculty member's question, in plain prose",
  "reasoning": "the evidence and logic behind that answer, referencing specific data points from the context",
  "confidence": <integer 0-100, your self-assessed certainty given how well the available context supports the answer>
}
Do not wrap the JSON in markdown code fences. Do not include a "sources" field — AcadIQ attaches sources separately from what it actually retrieved.`;

function renderCourseSection(context: CopilotContext): string {
  let section = `\nCourse: ${context.courseCode} - ${context.courseName}`;
  if (context.courseOutcomes && context.courseOutcomes.length > 0) {
    section += `\n\nDeclared Course Outcomes:`;
    for (const co of context.courseOutcomes) section += `\n- [${co.code}]: ${co.description}`;
  }
  if (context.paperMetadata) {
    section += `\n\nQuestion Paper: ${context.paperMetadata.originalName} (${context.paperMetadata.semester} ${context.paperMetadata.year})`;
  }
  if (context.questions && context.questions.length > 0) {
    section += `\n\nExam Questions (${context.questions.length} total):`;
    for (const q of context.questions) {
      const bloom = q.bloomLevel ? ` [Bloom: ${q.bloomLevel}]` : "";
      const topic = q.topic ? ` [Topic: ${q.topic}]` : "";
      section += `\n- Q${q.sequenceNumber} (${q.marks} marks)${bloom}${topic}: ${q.questionText}`;
    }
  }
  if (context.syllabusExcerpt) {
    section += `\n\nSyllabus Content Excerpt:\n${context.syllabusExcerpt.slice(0, 15000)}`;
  }
  return section;
}

function renderExamQualitySection(context: CopilotContext): string {
  if (!context.examQuality) return "";
  let section = `\n\nExam Quality Report:`;
  section += `\n- Overall Quality Score: ${context.examQuality.qualityScore}/100`;
  if (context.examQuality.positivePoints?.length) section += `\n- Key Strengths: ${JSON.stringify(context.examQuality.positivePoints)}`;
  if (context.examQuality.issues?.length) section += `\n- Identified Issues: ${JSON.stringify(context.examQuality.issues)}`;
  if (context.examQuality.recommendations?.length) section += `\n- Recommendations: ${JSON.stringify(context.examQuality.recommendations)}`;
  return section;
}

function renderCoCoverageSection(context: CopilotContext): string {
  if (!context.coCoverage) return "";
  let section = `\n\nCO Intelligence (Course Outcome Mapping) Report:`;
  section += `\n- Overall CO Mapping Quality Score: ${context.coCoverage.qualityScore}/100`;
  section += `\n- Coverage by outcome: ${JSON.stringify(context.coCoverage.coverage)}`;
  if (context.coCoverage.missingOutcomes.length > 0) {
    section += `\n- Weak/uncovered outcomes: ${context.coCoverage.missingOutcomes.join(", ")}`;
  }
  return section;
}

function renderAcademicMemorySection(context: CopilotContext): string {
  if (!context.academicMemory) return "";
  let section = `\n\nAcademic Memory Report (repeated/similar questions vs. course history):`;
  section += `\n- Overall similarity score: ${context.academicMemory.similarityScore}%`;
  section += `\n- Similar question pairs found: ${context.academicMemory.similarQuestionCount}`;
  section += `\n- AI suggestion: ${context.academicMemory.replacementSuggestion}`;
  if (context.academicMemory.topMatch) {
    const m = context.academicMemory.topMatch;
    section += `\n- Closest match (${m.similarityPercentage}% similar): current question "${m.currentQuestionText}" vs. previous question "${m.previousQuestionText}"`;
  }
  return section;
}

function renderQuestionQualitySection(context: CopilotContext): string {
  if (!context.questionQuality) return "";
  let section = `\n\nQuestion Review Report:`;
  section += `\n- Overall question quality score: ${context.questionQuality.qualityScore}/100`;
  section += `\n- Low-clarity questions flagged: ${context.questionQuality.lowClarityCount}`;
  return section;
}

const SECTION_RENDERERS: Record<CopilotIntent, (context: CopilotContext) => string> = {
  SCORE: renderExamQualitySection,
  CO_COVERAGE: renderCoCoverageSection,
  ACADEMIC_MEMORY: renderAcademicMemorySection,
  QUESTION_QUALITY: renderQuestionQualitySection,
  GENERAL: () => "",
};

/**
 * Step 4 of the retrieval flow: "Build AI context" into an actual prompt.
 * The section matching the identified intent is placed immediately after the
 * course overview — the LLM reads top-to-bottom, so leading with what the
 * faculty member most likely asked about improves grounded, on-topic answers
 * without needing to omit any of the other retrieved data.
 */
export function buildCopilotSystemPrompt(context: CopilotContext, intent: CopilotIntent = "GENERAL"): string {
  const allSections = [renderExamQualitySection, renderCoCoverageSection, renderAcademicMemorySection, renderQuestionQualitySection];
  const priority = SECTION_RENDERERS[intent];
  const rest = allSections.filter((fn) => fn !== priority);

  let prompt = `${COPILOT_SYSTEM_PROMPT}\n\n--- ACTIVE ACADEMIC CONTEXT ---`;
  prompt += renderCourseSection(context);
  prompt += priority(context);
  for (const render of rest) prompt += render(context);
  prompt += `\n--- END ACADEMIC CONTEXT ---`;
  return prompt;
}
