import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type {
  PersistStructuredLessonInput,
  StructuredLessonRepository,
} from "@/lib/ai/structured-lesson-repository";

type PrismaStructuredLessonRepositoryOptions = {
  databaseUrl: string;
};

export class PrismaStructuredLessonRepository
  implements StructuredLessonRepository
{
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaStructuredLessonRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async replace(input: PersistStructuredLessonInput): Promise<boolean> {
    const result = await this.#client.lesson.updateMany({
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
      },
    });

    return result.count === 1;
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
