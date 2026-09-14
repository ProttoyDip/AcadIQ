const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const JSZip = require("jszip");
const { extractDocumentText, extractPptxText } = require("../dist/ai/documentTextExtractor");
const { chunkText } = require("../dist/services/copilot/rag.service");

function slideXml(paragraphs) {
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${paragraphs
    .map((runs) => `<p:sp><p:txBody><a:p>${runs.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join("")}</a:p></p:txBody></p:sp>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;
}

test("PPTX extractor reads slides in order, joins runs, keeps slide markers and notes", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("ppt/slides/slide2.xml", slideXml([["Two-phase ", "locking"], ["Growing &amp; shrinking phases"]]));
  zip.file("ppt/slides/slide1.xml", slideXml([["ACID properties"], ["Atomicity, Consistency"]]));
  zip.file("ppt/notesSlides/notesSlide1.xml", slideXml([["Mention the bank transfer example"]]));
  zip.file("ppt/slides/slide10.xml", slideXml([["Deadlocks"]]));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const file = path.join(os.tmpdir(), `acadiq-test-${Date.now()}.pptx`);
  fs.writeFileSync(file, buffer);
  try {
    const text = await extractPptxText(file);
    const slide1 = text.indexOf("Slide 1\nACID properties");
    const slide2 = text.indexOf("Slide 2\nTwo-phase locking");
    const slide3 = text.indexOf("Slide 3\nDeadlocks");
    assert.ok(slide1 >= 0 && slide2 > slide1 && slide3 > slide2, text);
    assert.match(text, /Growing & shrinking phases/);
    assert.match(text, /Notes: Mention the bank transfer example/);
    // Dispatch by MIME type and by extension both reach the PPTX path.
    assert.equal(await extractDocumentText(file, "application/vnd.openxmlformats-officedocument.presentationml.presentation"), text);
    assert.equal(await extractDocumentText(file, "application/octet-stream"), text);
  } finally {
    fs.unlinkSync(file);
  }
});

test("declared MIME type wins over a misleading extension", async () => {
  const file = path.join(os.tmpdir(), `acadiq-test-${Date.now()}.txt`);
  fs.writeFileSync(file, "plain text");
  try {
    await assert.rejects(() => extractDocumentText(file, "application/pdf"), { message: "The uploaded file is not a valid PDF" });
    assert.equal(await extractDocumentText(file, "text/plain"), "plain text");
    assert.equal(await extractDocumentText(file), "plain text");
  } finally {
    fs.unlinkSync(file);
  }
});

test("chunkText produces overlapping, sentence-aware windows", () => {
  const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i + 1} explains a concept in the lecture.`).join(" ");
  const chunks = chunkText(text, 300, 40);
  assert.ok(chunks.length > 3);
  assert.ok(chunks.every((c) => c.length <= 300));
  assert.ok(chunks.slice(0, -1).every((c) => /\.$/.test(c)), "chunks end at sentence boundaries");
});
