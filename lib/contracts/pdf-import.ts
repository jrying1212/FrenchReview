export const PDF_TEXT_CODE_POINT_LIMIT = 120_000;

export const PDF_IMPORT_ERROR_CODES = [
  "PDF_TOO_LARGE",
  "NO_SELECTABLE_TEXT",
  "ENCRYPTED_PDF",
  "INVALID_PDF",
  "TEXT_TOO_LONG",
  "IMPORT_FAILED",
] as const;

export type PdfImportErrorCode = (typeof PDF_IMPORT_ERROR_CODES)[number];

export class PdfImportError extends Error {
  readonly code: PdfImportErrorCode;

  constructor(code: PdfImportErrorCode) {
    super(code);
    this.name = "PdfImportError";
    this.code = code;
  }
}

export type PdfExtractionResult = {
  text: string;
  pageCount: number;
};

export type PdfImportExtractionResult = PdfExtractionResult & {
  characterCount: number;
};

export interface PdfTextExtractor {
  extract(bytes: Uint8Array): Promise<PdfExtractionResult>;
}
