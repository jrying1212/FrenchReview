import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type { LessonId } from "@/lib/contracts/lesson";
import type {
  ActivatePdfSourceInput,
  PdfImportRepository,
  PdfSourceState,
} from "@/lib/pdf/import-pdf";

type PrismaPdfImportRepositoryOptions = {
  databaseUrl: string;
};

export class PrismaPdfImportRepository implements PdfImportRepository {
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaPdfImportRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async findSourceState(lessonId: LessonId): Promise<PdfSourceState | null> {
    const lesson = await this.#client.lesson.findUnique({
      select: { pdfStorageKey: true },
      where: { id: lessonId },
    });

    return lesson ? { storageKey: lesson.pdfStorageKey } : null;
  }

  async activateSource(input: ActivatePdfSourceInput): Promise<boolean> {
    return this.#client.$transaction(async (transaction) => {
      const result = await transaction.lesson.updateMany({
        data: {
          importStatus: "ready",
          parsedContent: Prisma.DbNull,
          parseErrorCode: null,
          parseStatus: "not_started",
          pdfOriginalName: input.originalName,
          pdfStorageKey: input.storageKey,
          rawText: input.rawText,
        },
        where: {
          id: input.lessonId,
          pdfStorageKey: input.expectedStorageKey,
        },
      });

      return result.count === 1;
    });
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
