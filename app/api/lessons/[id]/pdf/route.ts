import { lessonIdSchema } from "@/lib/contracts/lesson";
import { pdfParseAdapter } from "@/lib/pdf/pdf-parse-adapter";
import { pdfImportResponse } from "@/lib/pdf/pdf-import-api";
import { PrismaPdfImportRepository } from "@/lib/pdf/prisma-pdf-import-repository";
import { LocalPdfStore } from "@/lib/storage/local-pdf-store";

export const runtime = "nodejs";

type PdfRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: PdfRouteContext,
): Promise<Response> {
  const id = lessonIdSchema.safeParse((await context.params).id);

  if (!id.success) {
    return Response.json(
      { error: { code: "INVALID_ID", message: "Invalid lesson identifier." } },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
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

  const repository = new PrismaPdfImportRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });

  try {
    return await pdfImportResponse(formData, id.data, {
      extractor: pdfParseAdapter,
      repository,
      reportCleanupFailure: () => {
        console.error("PDF import file cleanup failed.");
      },
      reportUnexpectedFailure: (error) => {
        console.error("PDF extraction failed unexpectedly.", error);
      },
      store: new LocalPdfStore(),
    });
  } finally {
    await repository.disconnect();
  }
}
