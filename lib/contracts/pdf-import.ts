export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_TEXT_CODE_POINT_LIMIT = 120_000;

export const PDF_IMPORT_ERROR_CODES = [
  "PDF_TOO_LARGE",
  "NO_SELECTABLE_TEXT",
  "ENCRYPTED_PDF",
  "INVALID_PDF",
  "TEXT_TOO_LONG",
  "LESSON_NOT_FOUND",
  "REPLACEMENT_CONFIRMATION_REQUIRED",
  "IMPORT_CONFLICT",
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
