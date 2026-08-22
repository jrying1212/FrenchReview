import {
  PDF_TEXT_CODE_POINT_LIMIT,
  PdfImportError,
  type PdfImportExtractionResult,
  type PdfTextExtractor,
} from "@/lib/contracts/pdf-import";
import { pdfParseAdapter } from "@/lib/pdf/pdf-parse-adapter";

function normalizeExtractedText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trimEnd())
    .join("\n")
    .trim();
}

function countCodePointsThroughLimit(text: string): number {
  let count = 0;

  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = text.charCodeAt(index + 1);

      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        index += 1;
      }
    }

    count += 1;

    if (count > PDF_TEXT_CODE_POINT_LIMIT) {
      break;
    }
  }

  return count;
}

export async function extractPdfText(
  bytes: Uint8Array,
  extractor: PdfTextExtractor = pdfParseAdapter,
): Promise<PdfImportExtractionResult> {
  try {
    const result = await extractor.extract(bytes);
    const text = normalizeExtractedText(result.text);
    const characterCount = countCodePointsThroughLimit(text);

    if (characterCount === 0) {
      throw new PdfImportError("NO_SELECTABLE_TEXT");
    }

    if (characterCount > PDF_TEXT_CODE_POINT_LIMIT) {
      throw new PdfImportError("TEXT_TOO_LONG");
    }

    return {
      text,
      pageCount: result.pageCount,
      characterCount,
    };
  } catch (error) {
    if (error instanceof PdfImportError) {
      throw error;
    }

    throw new PdfImportError("IMPORT_FAILED");
  }
}
