import { promises as fs } from "fs";
import pdfParse from "pdf-parse";
import { AppError } from "../../middleware/error.middleware";

export interface ParsedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPdfResult {
  fullText: string;
  pageCount: number;
  pages: ParsedPdfPage[];
  info?: Record<string, any>;
  isScanned?: boolean;
}

const PDF_SIGNATURE = "%PDF-";

export class PdfParserService {
  /**
   * Cleans and normalizes extracted text.
   */
  public cleanText(text: string): string {
    return text
      .replace(/\u0000/g, "") // Remove null bytes
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ") // Normalize spaces
      .replace(/\n{3,}/g, "\n\n") // Collapse blank lines
      .normalize("NFC")
      .trim();
  }

  /**
   * Parses a PDF file from disk, extracting clean text and page breakdown.
   */
  async parsePdf(filePath: string): Promise<ParsedPdfResult> {
    const buffer = await fs.readFile(filePath);

    // Validate PDF magic bytes
    if (buffer.subarray(0, PDF_SIGNATURE.length).toString("ascii") !== PDF_SIGNATURE) {
      throw new AppError("The uploaded file is not a valid PDF document (missing PDF signature).", 400);
    }

    const pages: ParsedPdfPage[] = [];
    let pageCounter = 0;

    // Custom pagerender to capture text page-by-page
    const customPagerender = (pageData: any) => {
      pageCounter += 1;
      const currentPageNum = pageCounter;

      return pageData.getTextContent().then((textContent: any) => {
        let lastY: number | undefined;
        let pageStr = "";
        for (const item of textContent.items) {
          if (lastY === undefined || lastY === item.transform[5]) {
            pageStr += item.str;
          } else {
            pageStr += "\n" + item.str;
          }
          lastY = item.transform[5];
        }

        const cleanedPageText = this.cleanText(pageStr);
        pages.push({
          pageNumber: currentPageNum,
          text: cleanedPageText,
        });

        return pageStr;
      });
    };

    let fullParsedText = "";
    let numPages = 0;
    let info: Record<string, any> = {};

    try {
      const bytes = new Uint8Array(buffer);
      const parsed = await pdfParse(bytes as unknown as Buffer, {
        pagerender: customPagerender,
      });

      fullParsedText = this.cleanText(parsed.text);
      numPages = parsed.numpages || pages.length || 1;
      info = parsed.info || {};
    } catch (parseError: any) {
      // If custom page rendering fails, try standard parsing as fallback
      try {
        const bytes = new Uint8Array(buffer);
        const fallbackParsed = await pdfParse(bytes as unknown as Buffer);
        fullParsedText = this.cleanText(fallbackParsed.text);
        numPages = fallbackParsed.numpages || 1;
        info = fallbackParsed.info || {};
        pages.push({ pageNumber: 1, text: fullParsedText });
      } catch {
        throw new AppError(
          "The PDF document could not be parsed. The file may be corrupt or encrypted with a password.",
          422
        );
      }
    }

    // Sort pages in case async rendering resolved out of order
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    // Check if PDF has no extractable text or appears to be a scanned image
    if (!fullParsedText || fullParsedText.length < 15) {
      throw new AppError(
        "This PDF contains no selectable text and appears to be a scanned document or image-only file. Please upload an image of the page to the Image Assistant for vision analysis, or run OCR on the document.",
        422,
        { isScanned: true, pageCount: numPages }
      );
    }

    return {
      fullText: fullParsedText,
      pageCount: numPages,
      pages,
      info,
      isScanned: false,
    };
  }
}

export const pdfParserService = new PdfParserService();
