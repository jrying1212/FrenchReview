import {
  PDF_MAX_BYTES,
  PdfImportError,
  type PdfTextExtractor,
} from "@/lib/contracts/pdf-import";
import type { LessonId } from "@/lib/contracts/lesson";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";
import type { PdfStore, StagedPdf } from "@/lib/storage/local-pdf-store";

const PDF_SIGNATURE = new TextEncoder().encode("%PDF-");

export type PdfSourceState = {
  storageKey: string | null;
};

export type ActivatePdfSourceInput = {
  expectedStorageKey: string | null;
  lessonId: LessonId;
  originalName: string;
  rawText: string;
  storageKey: string;
};

export interface PdfImportRepository {
  findSourceState(lessonId: LessonId): Promise<PdfSourceState | null>;
  activateSource(input: ActivatePdfSourceInput): Promise<boolean>;
}

export type ImportPdfInput = {
  bytes: Uint8Array;
  confirmReplacement?: boolean;
  lessonId: LessonId;
  originalName: string;
};

export type ImportPdfResult = {
  characterCount: number;
  importStatus: "ready";
  lessonId: LessonId;
  originalName: string;
  pageCount: number;
};

export type ImportPdfDependencies = {
  extractor: PdfTextExtractor;
  repository: PdfImportRepository;
  reportCleanupFailure?: () => void;
  store: PdfStore;
};

function validatePdfInput(input: ImportPdfInput): void {
  if (input.bytes.byteLength > PDF_MAX_BYTES) {
    throw new PdfImportError("PDF_TOO_LARGE");
  }

  if (
    input.bytes.byteLength < PDF_SIGNATURE.length ||
    PDF_SIGNATURE.some((byte, index) => input.bytes[index] !== byte)
  ) {
    throw new PdfImportError("INVALID_PDF");
  }

  if (
    input.originalName.length === 0 ||
    input.originalName.length > 255 ||
    !input.originalName.toLowerCase().endsWith(".pdf") ||
    input.originalName.includes("/") ||
    input.originalName.includes("\\") ||
    input.originalName.includes("\0")
  ) {
    throw new PdfImportError("INVALID_PDF");
  }
}

async function cleanupImport(
  store: PdfStore,
  staged: StagedPdf,
  activated: boolean,
  reportCleanupFailure: () => void,
): Promise<void> {
  try {
    if (activated) {
      await store.remove(staged.key);
    } else {
      await store.discard(staged);
    }
  } catch {
    reportCleanupFailure();
  }
}

export async function importPdf(
  input: ImportPdfInput,
  dependencies: ImportPdfDependencies,
): Promise<ImportPdfResult> {
  validatePdfInput(input);

  const { extractor, repository, store } = dependencies;
  const reportCleanupFailure = dependencies.reportCleanupFailure ?? (() => undefined);
  const source = await repository.findSourceState(input.lessonId);

  if (!source) {
    throw new PdfImportError("LESSON_NOT_FOUND");
  }

  if (source.storageKey && !input.confirmReplacement) {
    throw new PdfImportError("REPLACEMENT_CONFIRMATION_REQUIRED");
  }

  const staged = await store.stage(input.bytes);
  let activated = false;

  try {
    const extraction = await extractPdfText(input.bytes, extractor);
    await store.activate(staged);
    activated = true;

    const committed = await repository.activateSource({
      expectedStorageKey: source.storageKey,
      lessonId: input.lessonId,
      originalName: input.originalName,
      rawText: extraction.text,
      storageKey: staged.key,
    });

    if (!committed) {
      throw new PdfImportError("IMPORT_CONFLICT");
    }

    if (source.storageKey) {
      try {
        await store.remove(source.storageKey);
      } catch {
        reportCleanupFailure();
      }
    }

    return {
      characterCount: extraction.characterCount,
      importStatus: "ready",
      lessonId: input.lessonId,
      originalName: input.originalName,
      pageCount: extraction.pageCount,
    };
  } catch (error) {
    await cleanupImport(store, staged, activated, reportCleanupFailure);

    if (error instanceof PdfImportError) {
      throw error;
    }

    throw new PdfImportError("IMPORT_FAILED");
  }
}
