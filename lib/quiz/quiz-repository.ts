import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type { LessonId } from "@/lib/contracts/lesson";
import { quizSchema, type Quiz } from "@/lib/contracts/quiz";
import {
  structuredLessonSchema,
  type StructuredLesson,
} from "@/lib/contracts/structured-lesson";

export type QuizGenerationSource =
  | { status: "not_found" }
  | { status: "structured_lesson_not_ready" }
  | {
      status: "ready";
      lesson: StructuredLesson;
      activeQuiz: Quiz | null;
    };

export type ActiveQuizResult =
  | { status: "not_found" }
  | { status: "no_quiz" }
  | { status: "ready"; quiz: Quiz };

export interface QuizRepository {
  readGenerationSource(lessonId: LessonId): Promise<QuizGenerationSource>;
  readActive(lessonId: LessonId): Promise<ActiveQuizResult>;
  replaceActive(input: {
    quiz: Quiz;
    expectedActiveQuizId: string | null;
  }): Promise<boolean>;
}

type PrismaQuizRepositoryOptions = {
  databaseUrl: string;
};

const activeQuizSelection = {
  where: { isActive: true },
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  take: 1,
};

export class PrismaQuizRepository implements QuizRepository {
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaQuizRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async readGenerationSource(lessonId: LessonId): Promise<QuizGenerationSource> {
    const record = await this.#client.lesson.findUnique({
      select: {
        parseStatus: true,
        parsedContent: true,
        structuredSchemaVersion: true,
        quizzes: activeQuizSelection,
      },
      where: { id: lessonId },
    });

    if (!record) return { status: "not_found" };
    if (
      record.parseStatus !== "ready" ||
      record.parsedContent === null ||
      record.structuredSchemaVersion === null
    ) {
      return { status: "structured_lesson_not_ready" };
    }

    const lesson = structuredLessonSchema.safeParse(record.parsedContent);
    if (
      !lesson.success ||
      lesson.data.schemaVersion !== record.structuredSchemaVersion
    ) {
      return { status: "structured_lesson_not_ready" };
    }

    return {
      status: "ready",
      lesson: lesson.data,
      activeQuiz: record.quizzes[0] ? parseQuizRecord(record.quizzes[0]) : null,
    };
  }

  async readActive(lessonId: LessonId): Promise<ActiveQuizResult> {
    const lesson = await this.#client.lesson.findUnique({
      select: { quizzes: activeQuizSelection },
      where: { id: lessonId },
    });

    if (!lesson) return { status: "not_found" };
    if (!lesson.quizzes[0]) return { status: "no_quiz" };
    return { status: "ready", quiz: parseQuizRecord(lesson.quizzes[0]) };
  }

  async replaceActive(input: {
    quiz: Quiz;
    expectedActiveQuizId: string | null;
  }): Promise<boolean> {
    return this.#client.$transaction(async (transaction) => {
      const active = await transaction.quiz.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
        where: { isActive: true, lessonId: input.quiz.lessonId },
      });

      if ((active?.id ?? null) !== input.expectedActiveQuizId) return false;

      await transaction.quiz.updateMany({
        data: { isActive: false },
        where: { isActive: true, lessonId: input.quiz.lessonId },
      });
      await transaction.quiz.create({
        data: {
          createdAt: new Date(input.quiz.createdAt),
          id: input.quiz.id,
          isActive: true,
          lessonId: input.quiz.lessonId,
          questions: input.quiz.questions as Prisma.InputJsonValue,
          sourceSchemaVersion: input.quiz.sourceSchemaVersion,
        },
      });
      return true;
    });
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}

function parseQuizRecord(record: {
  id: string;
  lessonId: string;
  sourceSchemaVersion: number;
  questions: Prisma.JsonValue;
  createdAt: Date;
}): Quiz {
  return quizSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    lessonId: record.lessonId,
    questions: record.questions,
    sourceSchemaVersion: record.sourceSchemaVersion,
  });
}
