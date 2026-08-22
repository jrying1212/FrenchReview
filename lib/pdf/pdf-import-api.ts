import {
  PDF_MAX_BYTES,
  PdfImportError,
  type PdfImportErrorCode,
} from "@/lib/contracts/pdf-import";
import type { LessonId } from "@/lib/contracts/lesson";
import {
  importPdf,
  type ImportPdfDependencies,
} from "@/lib/pdf/import-pdf";

const ERROR_RESPONSES: Record<
  PdfImportErrorCode,
  { message: string; status: number }
> = {
  ENCRYPTED_PDF: {
    message: "Password-protected PDFs are not supported.",
    status: 422,
  },
  IMPORT_CONFLICT: {
    message: "The lesson source changed. Refresh and try again.",
    status: 409,
  },
  IMPORT_FAILED: {
    message: "The PDF could not be imported. Try again.",
    status: 500,
  },
  INVALID_PDF: {
    message: "Choose a valid PDF file.",
    status: 422,
  },
  LESSON_NOT_FOUND: {
    message: "Lesson not found.",
    status: 404,
  },
  NO_SELECTABLE_TEXT: {
    message: "This PDF has no selectable text. Scanned PDFs are not supported.",
    status: 422,
  },
  PDF_TOO_LARGE: {
    message: "Choose a PDF no larger than 20 MiB.",
    status: 413,
  },
  REPLACEMENT_CONFIRMATION_REQUIRED: {
    message: "Confirm replacement of the existing lesson source.",
    status: 409,
  },
  TEXT_TOO_LONG: {
    message: "The extracted text exceeds 120,000 characters.",
    status: 422,
  },
};

function errorResponse(code: PdfImportErrorCode): Response {
  const error = ERROR_RESPONSES[code];
  return Response.json(
    { error: { code, message: error.message } },
    { status: error.status },
  );
}

function invalidMultipartResponse(): Response {
  return Response.json(
    {
      error: {
        code: "INVALID_MULTIPART",
        message: "Send exactly one PDF file.",
      },
    },
    { status: 400 },
  );
}

export async function pdfImportResponse(
  formData: FormData,
  lessonId: LessonId,
  dependencies: ImportPdfDependencies,
): Promise<Response> {
  const entries = [...formData.entries()];
  const fileEntries = entries.filter(([, value]) => value instanceof File);
  const namedFiles = formData.getAll("file").filter((value) => value instanceof File);
  const unknownField = entries.some(
    ([name]) => name !== "file" && name !== "confirmReplacement",
  );
  const confirmations = formData.getAll("confirmReplacement");

  if (
    unknownField ||
    fileEntries.length !== 1 ||
    namedFiles.length !== 1 ||
    confirmations.length > 1
  ) {
    return invalidMultipartResponse();
  }

  const file = namedFiles[0] as File;
  const confirmation = confirmations[0];

  if (
    (confirmation !== undefined &&
      confirmation !== "true" &&
      confirmation !== "false") ||
    file.size > PDF_MAX_BYTES
  ) {
    return file.size > PDF_MAX_BYTES
      ? errorResponse("PDF_TOO_LARGE")
      : invalidMultipartResponse();
  }

  try {
    const result = await importPdf(
      {
        bytes: new Uint8Array(await file.arrayBuffer()),
        confirmReplacement: confirmation === "true",
        lessonId,
        originalName: file.name,
      },
      dependencies,
    );
    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    return error instanceof PdfImportError
      ? errorResponse(error.code)
      : errorResponse("IMPORT_FAILED");
  }
}
