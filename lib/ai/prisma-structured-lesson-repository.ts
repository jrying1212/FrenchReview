import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type {
  LessonSourceClaim,
  LessonStructureOrchestrationRepository,
  PersistStructuredLessonInput,
} from "@/lib/ai/structured-lesson-repository";
import type {
  ManualLessonRepository,
  ManualLessonSource,
} from "@/lib/ai/manual-lesson-api";
import type { LessonId } from "@/lib/contracts/lesson";

type PrismaStructuredLessonRepositoryOptions = {
  databaseUrl: string;
};

export class PrismaStructuredLessonRepository
  implements LessonStructureOrchestrationRepository, ManualLessonRepository
{
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaStructuredLessonRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async replace(input: PersistStructuredLessonInput): Promise<boolean> {
    return this.#client.$transaction(async (transaction) => {
      const result = await transaction.lesson.updateMany({
        data: {
          parsedContent: input.lesson as Prisma.InputJsonValue,
          parseErrorCode: null,
          parseStatus: "ready",
          structuredContentSource: input.provenance.source,
          structuredModelId: input.provenance.modelId,
          structuredPromptVersion: input.provenance.promptVersion,
          structuredSchemaVersion: input.lesson.schemaVersion,
        },
        where: {
          id: input.lessonId,
          importStatus: "ready",
          ...(input.guard
            ? {
                pdfStorageKey: input.guard.storageKey,
                parseStatus: input.guard.parseStatus,
              }
            : {}),
        },
      });
      if (result.count !== 1) return false;

      await transaction.reviewItem.deleteMany({
        where: { lessonId: input.lessonId },
      });
      const reviewItems = [
        ...input.lesson.vocabulary.map((item) => ({
          itemType: "vocabulary" as const,
          lessonId: input.lessonId,
          structuredItemId: item.id,
        })),
        ...input.lesson.sentences.map((item) => ({
          itemType: "sentence" as const,
          lessonId: input.lessonId,
          structuredItemId: item.id,
        })),
      ];
      if (reviewItems.length > 0) {
        await transaction.reviewItem.createMany({ data: reviewItems });
      }
      return true;
    });
  }

  async readSource(lessonId: LessonId): Promise<ManualLessonSource> {
    const lesson = await this.#client.lesson.findUnique({
      select: { importStatus: true, pdfStorageKey: true, rawText: true },
      where: { id: lessonId },
    });

    if (!lesson) return { status: "not_found" };
    if (
      lesson.importStatus !== "ready" ||
      lesson.pdfStorageKey === null ||
      lesson.rawText === null ||
      lesson.rawText.trim().length === 0
    ) {
      return { status: "source_not_ready" };
    }

    return { sourceText: lesson.rawText, status: "ready" };
  }

  async claim(lessonId: LessonId): Promise<LessonSourceClaim> {
    const lesson = await this.#client.lesson.findUnique({
      select: {
        importStatus: true,
        parseStatus: true,
        pdfStorageKey: true,
        rawText: true,
      },
      where: { id: lessonId },
    });

    if (!lesson) return { status: "not_found" };
    if (
      lesson.importStatus !== "ready" ||
      lesson.pdfStorageKey === null ||
      lesson.rawText === null ||
      lesson.rawText.trim().length === 0
    ) {
      return { status: "source_not_ready" };
    }
    if (lesson.parseStatus === "processing") {
      return { status: "already_processing" };
    }

    const claimed = await this.#client.lesson.updateMany({
      data: { parseErrorCode: null, parseStatus: "processing" },
      where: {
        id: lessonId,
        importStatus: "ready",
        parseStatus: { not: "processing" },
        pdfStorageKey: lesson.pdfStorageKey,
      },
    });

    return claimed.count === 1
      ? {
          status: "claimed",
          sourceText: lesson.rawText,
          storageKey: lesson.pdfStorageKey,
        }
      : { status: "already_processing" };
  }

  async fail(
    lessonId: LessonId,
    expectedStorageKey: string,
    errorCode: string,
  ): Promise<boolean> {
    const result = await this.#client.lesson.updateMany({
      data: { parseErrorCode: errorCode, parseStatus: "failed" },
      where: {
        id: lessonId,
        importStatus: "ready",
        parseStatus: "processing",
        pdfStorageKey: expectedStorageKey,
      },
    });

    return result.count === 1;
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
