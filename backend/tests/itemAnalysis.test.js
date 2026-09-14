const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeItems, parseMarksCsv, groupAttainment } = require("../dist/services/marks/itemAnalysis");
const { normalisePercent } = require("../dist/services/blueprint.service");

const items = [
  { questionId: 1, sequenceNumber: 1, maxMarks: 10, bloomLevel: "REMEMBER", topic: "Sets", text: "Q1" },
  { questionId: 2, sequenceNumber: 2, maxMarks: 10, bloomLevel: "APPLY", topic: "Graphs", text: "Q2" },
  { questionId: 3, sequenceNumber: 3, maxMarks: 10, bloomLevel: "APPLY", topic: "Graphs", text: "Q3" },
];

function row(student, q1, q2, q3) {
  return { student, marks: new Map([[1, q1], [2, q2], [3, q3]]) };
}

test("parseMarksCsv maps Q-headers, ignores unknown columns, treats blanks as 0", () => {
  const parsed = parseMarksCsv("student,Name,Q1,q 2,Question 3,Total\n2021001,Ana,8,5,,20\n2021002,Ben,6,7,9,22\n");
  assert.deepEqual(parsed.columns, [1, 2, 3]);
  assert.deepEqual(parsed.ignoredColumns, ["Name", "Total"]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].marks.get(3), 0);
  assert.equal(parsed.rows[1].marks.get(2), 7);
});

test("parseMarksCsv rejects duplicate students and non-numeric marks", () => {
  assert.throws(() => parseMarksCsv("s,Q1\nA,5\nA,6"), /more than once/);
  assert.throws(() => parseMarksCsv("s,Q1\nA,abc"), /Invalid mark/);
  assert.throws(() => parseMarksCsv("s,Name\nA,x"), /No question columns/);
});

test("analyzeItems: difficulty, discrimination, alpha and pass rate are computed deterministically", () => {
  // 8 students; Q1 easy for everyone, Q2 separates top from bottom, Q3 inverted (weak students do better).
  const rows = [
    row("s1", 10, 10, 2), row("s2", 10, 9, 3), row("s3", 9, 9, 4), row("s4", 10, 8, 3),
    row("s5", 9, 3, 8), row("s6", 10, 2, 9), row("s7", 9, 1, 9), row("s8", 10, 0, 10),
  ];
  const result = analyzeItems(rows, items, { passMarkPercent: 40, thresholdPercent: 60 });
  assert.equal(result.students, 8);
  assert.equal(result.totals.maxMarks, 30);

  const [q1, q2, q3] = result.items;
  assert.equal(q1.difficultyBand, "EASY");
  assert.ok(q1.fullMarksRate >= 0.5);
  assert.ok(q2.discrimination > 0.4, `Q2 discrimination ${q2.discrimination}`);
  assert.equal(q2.discriminationBand, "EXCELLENT");
  assert.ok(q3.discrimination < 0, `Q3 discrimination ${q3.discrimination}`);
  assert.equal(q3.discriminationBand, "POOR");
  assert.ok(result.recommendations.some((r) => r.questionId === 3 && r.priority === "HIGH"), "negative discrimination flagged HIGH");
  assert.equal(typeof result.totals.cronbachAlpha, "number");
  assert.equal(result.totals.passRate, 100);
  assert.equal(result.distribution.reduce((s, b) => s + b.count, 0), 8);

  const graphs = result.topicAttainment.find((g) => g.key === "Graphs");
  assert.deepEqual(graphs.questionSequence, [2, 3]);
  assert.equal(graphs.maxMarks, 20);
});

test("groupAttainment computes OBE levels against the threshold", () => {
  const rows = [row("a", 10, 10, 10), row("b", 10, 8, 8), row("c", 10, 2, 2), row("d", 10, 3, 3)];
  const [co1, co2] = groupAttainment(rows, items, [
    { key: "CO1", label: "Recall", questionIds: [1] },
    { key: "CO2", label: "Apply", questionIds: [2, 3] },
  ], 60);
  assert.equal(co1.studentsAboveThreshold, 100);
  assert.equal(co1.attainmentLevel, 3);
  assert.equal(co2.studentsAboveThreshold, 50);
  assert.equal(co2.attainmentLevel, 1);
});

test("normalisePercent scales to 100 and drops zeros", () => {
  assert.deepEqual(normalisePercent({ A: 1, B: 1, C: 0 }), { A: 50, B: 50 });
  assert.deepEqual(normalisePercent({}), {});
  const n = normalisePercent({ A: 3, B: 7 });
  assert.equal(Math.round(n.A + n.B), 100);
});
