import PDFDocument from "pdfkit";
import { reportService } from "./report.service";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";

type Doc = PDFKit.PDFDocument;

const COLORS = {
  ink: "#111827",
  muted: "#6b7280",
  primary: "#1d4ed8",
  line: "#e5e7eb",
  high: "#b91c1c",
  medium: "#b45309",
  low: "#15803d",
};

const PAGE_MARGIN = 48;

function heading(doc: Doc, text: string) {
  doc.moveDown(0.8);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(13).text(text);
  doc.moveTo(PAGE_MARGIN, doc.y + 2).lineTo(doc.page.width - PAGE_MARGIN, doc.y + 2).strokeColor(COLORS.line).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10);
}

function keyValue(doc: Doc, label: string, value: string) {
  doc.font("Helvetica-Bold").fillColor(COLORS.muted).fontSize(9).text(label.toUpperCase(), { continued: true });
  doc.font("Helvetica").fillColor(COLORS.ink).fontSize(10).text(`  ${value}`);
}

function paragraph(doc: Doc, text: string) {
  doc.font("Helvetica").fillColor(COLORS.ink).fontSize(10).text(text, { align: "left", lineGap: 2 });
}

function bullet(doc: Doc, text: string, color = COLORS.ink) {
  doc.fillColor(color).font("Helvetica").fontSize(10).text(`•  ${text}`, { indent: 6, lineGap: 2 });
}

/** Simple fixed-column table; wraps long cells and breaks pages cleanly. */
function table(doc: Doc, columns: { header: string; width: number }[], rows: string[][]) {
  const startX = PAGE_MARGIN;
  const drawHeader = () => {
    let x = startX;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted);
    const y = doc.y;
    for (const col of columns) {
      doc.text(col.header.toUpperCase(), x, y, { width: col.width - 8 });
      x += col.width;
    }
    doc.y = y + 14;
    doc.moveTo(startX, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).strokeColor(COLORS.line).stroke();
    doc.moveDown(0.3);
  };
  drawHeader();
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink);
  for (const row of rows) {
    const heights = row.map((cell, i) => doc.heightOfString(cell, { width: columns[i].width - 8 }));
    const rowHeight = Math.max(...heights) + 6;
    if (doc.y + rowHeight > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink);
    }
    let x = startX;
    const y = doc.y;
    row.forEach((cell, i) => {
      doc.text(cell, x, y, { width: columns[i].width - 8 });
      x += columns[i].width;
    });
    doc.y = y + rowHeight;
    doc.moveTo(startX, doc.y - 2).lineTo(doc.page.width - PAGE_MARGIN, doc.y - 2).strokeColor(COLORS.line).lineWidth(0.5).stroke();
  }
  doc.moveDown(0.5);
}

const pct = (n: unknown) => (typeof n === "number" ? `${Math.round(n)}%` : "—");
const num = (n: unknown) => (typeof n === "number" ? String(Math.round(n * 10) / 10) : "—");
const str = (s: unknown) => (typeof s === "string" && s.trim() ? s : "—");

function priorityColor(priority: string) {
  return priority === "HIGH" ? COLORS.high : priority === "MEDIUM" ? COLORS.medium : COLORS.low;
}

function humanType(reportType: string) {
  return reportType.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export const reportPdfService = {
  async render(reportId: number, facultyId: number): Promise<{ buffer: Buffer; filename: string }> {
    const report = await reportService.getById(reportId, facultyId);
    const course = report.courseId ? await courseRepository.findById(report.courseId) : null;
    const paper = report.questionPaperId ? await documentRepository.findQuestionPaperById(report.questionPaperId) : null;
    const result = (report.resultJson ?? {}) as Record<string, any>;
    const questionText = new Map<number, string>((paper?.questions ?? []).map((q) => [q.id, q.questionText]));
    const qLabel = (id: unknown) => {
      const text = typeof id === "number" ? questionText.get(id) : undefined;
      return text ? `Q${id}: ${text.length > 110 ? `${text.slice(0, 110)}…` : text}` : `Question #${String(id)}`;
    };

    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true, info: { Title: `AcadIQ ${humanType(report.reportType)} Report #${report.id}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    // Header band
    doc.rect(0, 0, doc.page.width, 84).fill(COLORS.primary);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text("AcadIQ", PAGE_MARGIN, 26);
    doc.font("Helvetica").fontSize(10).text("AI-assisted exam quality report — evidence for faculty decisions, not a verdict.", PAGE_MARGIN, 52);
    doc.fillColor(COLORS.ink);
    doc.y = 104;

    doc.font("Helvetica-Bold").fontSize(18).text(`${humanType(report.reportType)} Report`);
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(`Report #${report.id} · Generated ${new Date(report.createdAt).toLocaleString()}`);
    doc.moveDown(0.6);
    doc.fillColor(COLORS.ink);
    if (course) keyValue(doc, "Course", `${course.courseCode} — ${course.courseName}`);
    if (paper) keyValue(doc, "Question paper", `${paper.semester} ${paper.year} · ${paper.originalName} · ${paper.questions.length} questions`);

    // Decision contract
    const explanation = report.explanation ?? { decision: result.decision, reason: result.reason, confidence: result.confidence };
    const v2 = (result.explanation ?? {}) as Record<string, unknown>;
    heading(doc, "AI decision");
    keyValue(doc, "Decision", str(explanation?.decision));
    if (v2.reliabilityVersion === 2) {
      keyValue(doc, "Evidence sufficiency", `${num(v2.evidenceSufficiency)} / 100 (input completeness)`);
      keyValue(
        doc,
        "Model agreement",
        v2.modelAgreement === null || v2.modelAgreement === undefined
          ? "not measured (single run)"
          : `${num(v2.modelAgreement)} / 100 across ${num(v2.sampleCount)} samples (answer stability, not accuracy)`
      );
      if (v2.retrievalSupport !== null && v2.retrievalSupport !== undefined) keyValue(doc, "Retrieval support", `${num(v2.retrievalSupport)} / 100 (embedding cosine)`);
    }
    keyValue(doc, "Confidence", explanation?.confidence !== undefined && explanation?.confidence !== null ? `${Math.round(Number(explanation.confidence))} / 100` : "—");
    doc.moveDown(0.3);
    paragraph(doc, str(explanation?.reason));
    if (typeof v2.reliabilityNote === "string") {
      doc.moveDown(0.2);
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555555").text(v2.reliabilityNote, { align: "left" }).fillColor("#000000").font("Helvetica");
    }

    switch (report.reportType) {
      case "EXAM_QUALITY": {
        heading(doc, "Overall quality");
        keyValue(doc, "Quality score", `${num(result.overallScore ?? result.qualityScore)} / 100`);

        if (Array.isArray(result.bloomDistribution) && result.bloomDistribution.length) {
          heading(doc, "Bloom's taxonomy distribution");
          table(
            doc,
            [{ header: "Level", width: 100 }, { header: "Questions", width: 70 }, { header: "Marks", width: 60 }, { header: "Share", width: 60 }, { header: "Reason", width: 209 }],
            result.bloomDistribution.map((b: any) => [str(b.level), String(b.questionCount ?? "—"), String(b.marksAllocated ?? "—"), pct(b.percentage), str(b.reason)])
          );
        }
        const topics = result.topicCoverage ?? result.coverage?.topics;
        if (Array.isArray(topics) && topics.length) {
          heading(doc, "Topic coverage");
          table(
            doc,
            [{ header: "Topic", width: 170 }, { header: "In exam", width: 60 }, { header: "Questions", width: 65 }, { header: "Marks", width: 55 }, { header: "Reason", width: 149 }],
            topics.map((t: any) => [str(t.topic), t.coveredInExam ? "Yes" : "No", String(t.questionCount ?? "—"), String(t.marksAllocated ?? "—"), str(t.reason)])
          );
        }
        if (Array.isArray(result.marksDistribution) && result.marksDistribution.length) {
          heading(doc, "Marks distribution");
          table(
            doc,
            [{ header: "Topic", width: 300 }, { header: "Marks", width: 100 }, { header: "Share", width: 99 }],
            result.marksDistribution.map((m: any) => [str(m.topic), String(m.marks ?? "—"), pct(m.percentage)])
          );
        }
        if (Array.isArray(result.learningOutcomeAlignment) && result.learningOutcomeAlignment.length) {
          heading(doc, "Course outcome alignment");
          table(
            doc,
            [{ header: "Outcome", width: 400 }, { header: "Addressed", width: 99 }],
            result.learningOutcomeAlignment.map((o: any) => [str(o.outcome), o.addressed ? "Yes" : "No"])
          );
        }
        break;
      }
      case "SYLLABUS_COVERAGE": {
        heading(doc, "Coverage summary");
        keyValue(doc, "Coverage", pct(result.coveragePercentage));
        heading(doc, "Covered topics");
        (result.coveredTopics ?? []).forEach((t: string) => bullet(doc, t, COLORS.low));
        if (!(result.coveredTopics ?? []).length) paragraph(doc, "None identified.");
        heading(doc, "Missing topics");
        (result.missingTopics ?? []).forEach((t: string) => bullet(doc, t, COLORS.high));
        if (!(result.missingTopics ?? []).length) paragraph(doc, "None — every syllabus topic is examined.");
        if (Array.isArray(result.overusedTopics) && result.overusedTopics.length) {
          heading(doc, "Over-used topics");
          table(doc, [{ header: "Topic", width: 400 }, { header: "Occurrences", width: 99 }], result.overusedTopics.map((t: any) => [str(t.topic), String(t.occurrences ?? "—")]));
        }
        break;
      }
      case "QUESTION_SIMILARITY": {
        heading(doc, "Duplication summary");
        keyValue(doc, "Overall duplication", pct(result.overallDuplicationPercentage));
        paragraph(doc, str(result.recommendation));
        if (Array.isArray(result.matches) && result.matches.length) {
          heading(doc, "Matched questions");
          table(
            doc,
            [{ header: "Current question", width: 170 }, { header: "Previous question", width: 120 }, { header: "Similarity", width: 60 }, { header: "Type", width: 70 }, { header: "Reason", width: 79 }],
            result.matches.map((m: any) => [qLabel(m.currentQuestionId), `#${m.previousQuestionId}`, pct(m.similarityPercentage), str(m.matchType).replace(/_/g, " "), str(m.reason)])
          );
        } else {
          paragraph(doc, "No similar or repeated questions were detected against the compared paper.");
        }
        break;
      }
      case "CO_MAPPING": {
        heading(doc, "Outcome coverage");
        keyValue(doc, "Mapping quality", `${num(result.qualityScore)} / 100`);
        const coverage = result.coverage ?? {};
        if (Object.keys(coverage).length) {
          table(doc, [{ header: "Course outcome", width: 380 }, { header: "Coverage", width: 119 }], Object.entries(coverage).map(([co, v]) => [co, pct(v)]));
        }
        if (Array.isArray(result.mappings) && result.mappings.length) {
          heading(doc, "Question → outcome mappings");
          table(
            doc,
            [{ header: "Question", width: 200 }, { header: "Outcome", width: 70 }, { header: "Strength", width: 65 }, { header: "Rationale", width: 164 }],
            result.mappings.map((m: any) => [qLabel(m.questionId), str(m.courseOutcome), str(m.strength), str(m.rationale ?? m.reason)])
          );
        }
        if (Array.isArray(result.unmappedQuestionIds) && result.unmappedQuestionIds.length) {
          heading(doc, "Unmapped questions");
          result.unmappedQuestionIds.forEach((id: number) => bullet(doc, qLabel(id), COLORS.high));
        }
        break;
      }
      case "QUESTION_REVIEW": {
        heading(doc, "Review summary");
        keyValue(doc, "Overall quality", `${num(result.qualityScore)} / 100`);
        if (Array.isArray(result.questions) && result.questions.length) {
          heading(doc, "Per-question review");
          for (const q of result.questions) {
            if (doc.y > doc.page.height - 140) doc.addPage();
            doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(qLabel(q.questionId));
            doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted)
              .text(`Clarity ${num(q.clarityScore)}/100 · Bloom: ${str(q.bloomLevel)} · Confidence ${num(q.confidence)}`);
            doc.fillColor(COLORS.ink).fontSize(9).text(str(q.reason), { lineGap: 1 });
            (q.issues ?? []).forEach((issue: string) => bullet(doc, issue, COLORS.medium));
            if (q.suggestedRewrite) {
              doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLORS.low).text(`Suggested rewrite: ${q.suggestedRewrite}`, { lineGap: 1 });
            }
            doc.moveDown(0.5);
          }
        }
        break;
      }
      case "GENERATED_PAPER": {
        const v = result.verification ?? {};
        heading(doc, "Verifier objective");
        keyValue(doc, "Objective", `${num(v.objective)} / 100 · ${v.passed ? "passed" : "below"} the ${num(result.constraints?.passThreshold)} threshold`);
        if (v.scores) {
          table(doc, [{ header: "Component", width: 220 }, { header: "Score", width: 80 }, { header: "Weight", width: 80 }],
            Object.entries(v.scores).map(([k, s]) => [k, num(s), `${num(v.weights?.[k])}%`]));
        }
        if (Array.isArray(v.violations) && v.violations.length) {
          heading(doc, "Remaining violations");
          v.violations.forEach((item: string) => bullet(doc, item, COLORS.medium));
        }
        if (Array.isArray(result.iterations)) {
          heading(doc, "Generate → verify → repair trace");
          result.iterations.forEach((it: any) => bullet(doc, `Iteration ${it.iteration}: ${num(it.objective)}/100 — ${it.passed ? "passed" : `${it.violations?.length ?? 0} violation(s)`}`));
        }
        heading(doc, str(result.paper?.title));
        paragraph(doc, `Total marks ${num(v.marksTotal)} / ${num(result.constraints?.totalMarks)}. A student-facing copy without annotations is available via "Download question paper".`);
        for (const q of [...(result.paper?.questions ?? [])].sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber)) {
          doc.moveDown(0.3);
          doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(`Q${q.sequenceNumber}. `, { continued: true });
          doc.font("Helvetica").text(`${q.text}  [${q.marks} marks]`, { lineGap: 1 });
          doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(`Bloom: ${str(q.intendedBloom)}${q.intendedOutcome ? ` · ${q.intendedOutcome}` : ""} · ${str(q.topic)}`);
        }
        break;
      }
    }

    const issues = Array.isArray(result.issues) ? result.issues : [];
    if (issues.length) {
      heading(doc, "Issues");
      issues.forEach((i: any) => bullet(doc, `[${str(i.severity)}] ${str(i.message)}`, priorityColor(String(i.severity))));
    }

    heading(doc, "Recommendations");
    const recs = report.recommendations ?? [];
    if (!recs.length) paragraph(doc, "No recommendations were generated for this report.");
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>;
    [...recs]
      .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
      .forEach((r) => bullet(doc, `[${r.priority}] ${r.message}`, priorityColor(r.priority)));

    // Footer on every page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
        .text(`AcadIQ · Report #${report.id} · Page ${i + 1} of ${pages.count} · AI output is advisory; final decisions rest with faculty.`,
          PAGE_MARGIN, doc.page.height - 30, { width: doc.page.width - PAGE_MARGIN * 2, align: "center", lineBreak: false });
    }

    doc.end();
    const buffer = await done;
    const slug = `${course?.courseCode ?? "report"}-${report.reportType.toLowerCase()}-${report.id}`.replace(/[^a-z0-9-]+/gi, "-");
    return { buffer, filename: `acadiq-${slug}.pdf` };
  },
};
