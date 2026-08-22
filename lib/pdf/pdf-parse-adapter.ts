import {
  FormatError,
  InvalidPDFException,
  PasswordException,
  PDFParse,
} from "pdf-parse";

import {
  PdfImportError,
  type PdfTextExtractor,
} from "@/lib/contracts/pdf-import";

function isNamedError(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

export const pdfParseAdapter: PdfTextExtractor = {
  async extract(bytes) {
    const parser = new PDFParse({
      data: bytes.slice(),
      isEvalSupported: false,
      stopAtErrors: true,
    });

    try {
      const result = await parser.getText();

      return {
        text: result.pages.map((page) => page.text).join("\n"),
        pageCount: result.total,
      };
    } catch (error) {
      if (error instanceof PasswordException || isNamedError(error, "PasswordException")) {
        throw new PdfImportError("ENCRYPTED_PDF");
      }

      if (
        error instanceof InvalidPDFException ||
        error instanceof FormatError ||
        isNamedError(error, "InvalidPDFException") ||
        isNamedError(error, "FormatError")
      ) {
        throw new PdfImportError("INVALID_PDF");
      }

      throw error;
    } finally {
      await parser.destroy();
    }
  },
};
