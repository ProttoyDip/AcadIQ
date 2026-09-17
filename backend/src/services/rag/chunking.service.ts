import { ParsedPdfPage } from "../pdf/pdfParser.service";

export interface ChunkOptions {
  chunkSize?: number; // Characters per chunk (default: 700)
  chunkOverlap?: number; // Overlap characters (default: 120)
}

export interface ChunkItem {
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  section?: string | null;
  tokenCount?: number;
}

const SECTION_REGEX = /^(?:chapter|section|unit|module|part|\d+\.\d+)\s+[:\w\s-]{3,60}$/im;

export class ChunkingService {
  /**
   * Approximate token count (roughly 4 characters per token for English).
   */
  estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 4));
  }

  /**
   * Split a single string into sentence-aware sliding window chunks.
   */
  splitText(text: string, options: ChunkOptions = {}): string[] {
    const size = options.chunkSize || 700;
    const overlap = options.chunkOverlap || 120;

    const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!clean) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < clean.length) {
      let end = Math.min(clean.length, start + size);
      if (end < clean.length) {
        const window = clean.slice(start, end);
        // Find natural break points (paragraph, sentence, punctuation)
        const paragraphBreak = window.lastIndexOf("\n\n");
        const sentenceBreak = Math.max(
          window.lastIndexOf(". "),
          window.lastIndexOf("? "),
          window.lastIndexOf("! "),
          window.lastIndexOf(";\n")
        );
        const lineBreak = window.lastIndexOf("\n");

        const bestBreak = paragraphBreak > size * 0.4
          ? paragraphBreak
          : sentenceBreak > size * 0.4
          ? sentenceBreak + 1
          : lineBreak > size * 0.6
          ? lineBreak
          : -1;

        if (bestBreak > 0) {
          end = start + bestBreak + 1;
        }
      }

      const chunk = clean.slice(start, end).trim();
      if (chunk.length >= 20) {
        chunks.push(chunk);
      }

      if (end >= clean.length) break;
      start = Math.max(end - overlap, start + 1);
    }

    return chunks;
  }

  /**
   * Detects the prevailing section heading in a block of text.
   */
  detectSection(text: string): string | null {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      if (SECTION_REGEX.test(line) || (line.length < 60 && /^[A-Z0-9\s:-]+$/.test(line) && line.length > 5)) {
        return line.slice(0, 100);
      }
    }
    return null;
  }

  /**
   * Chunks pages from a parsed PDF while tracking page numbers and sections.
   */
  chunkPages(pages: ParsedPdfPage[], options: ChunkOptions = {}): ChunkItem[] {
    const items: ChunkItem[] = [];
    let chunkIndex = 0;
    let currentSection: string | null = null;

    for (const page of pages) {
      const detected = this.detectSection(page.text);
      if (detected) currentSection = detected;

      const pageChunks = this.splitText(page.text, options);
      for (const text of pageChunks) {
        items.push({
          chunkIndex,
          content: text,
          pageNumber: page.pageNumber,
          section: currentSection,
          tokenCount: this.estimateTokens(text),
        });
        chunkIndex += 1;
      }
    }

    return items;
  }

  /**
   * Chunks raw text when page breakdown is not available.
   */
  chunkRawText(text: string, options: ChunkOptions = {}): ChunkItem[] {
    const rawChunks = this.splitText(text, options);
    let currentSection: string | null = null;

    return rawChunks.map((content, chunkIndex) => {
      const detected = this.detectSection(content);
      if (detected) currentSection = detected;

      return {
        chunkIndex,
        content,
        pageNumber: null,
        section: currentSection,
        tokenCount: this.estimateTokens(content),
      };
    });
  }
}

export const chunkingService = new ChunkingService();
