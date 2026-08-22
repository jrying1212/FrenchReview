import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { z } from "zod";

import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type { LessonId } from "@/lib/contracts/lesson";
import {
  quizSchema,
  quizSubmissionSchema,
  type Quiz,
  type QuizSubmittedAnswer,
} from "@/lib/contracts/quiz";
import type { QuizQuestionResult } from "@/lib/quiz/evaluate-answer";

const storedResultSchema = z.strictObject({
  questionId: z.uuid(),
  correct: z.boolean(),
  normalizedAnswer: z.union([z.string(), z.array(z.uuid())]),
});

const storedAttemptSchema = z.strictObject({
  id: z.uuid(),
  lessonId: z.uuid(),
  quizId: z.uuid(),
  requestHash: z.string().regex(/^[0-9a-f]{64}$/),
  answers: quizSubmissionSchema.shape.answers,
  results: z.array(storedResultSchema).min(1).max(10),
  correctCount: z.number().int().nonnegative(),
  questionCount: z.number().int().min(1).max(10),
  scorePercent: z.number().int().min(0).max(100),
  createdAt: z.iso.datetime(),
});

export type StoredQuizAttempt = Omit<
  z.infer<typeof storedAttemptSchema>,
  "answers" | "results"
> & {
  answers: QuizSubmittedAnswer[];
  results: QuizQuestionResult[];
};

export type QuizAttemptWithQuiz = {
  attempt: StoredQuizAttempt;
  quiz: Quiz;
};

export type ActiveSubmissionQuiz =
  | { status: "lesson_not_found" }
  | { status: "quiz_not_found" }
  | { status: "ready"; quiz: Quiz };

export interface QuizAttemptRepository {
  readAttempt(submissionId: string): Promise<QuizAttemptWithQuiz | null>;
  readActiveQuiz(lessonId: LessonId): Promise<ActiveSubmissionQuiz>;
  saveAttempt(input: QuizAttemptWithQuiz): Promise<
    | { status: "saved"; value: QuizAttemptWithQuiz }
    | { status: "replayed"; value: QuizAttemptWithQuiz }
    | { status: "idempotency_conflict" }
  >;
}

type PrismaQuizAttemptRepositoryOptions = {
  databaseUrl: string;
};

export class PrismaQuizAttemptRepository implements QuizAttemptRepository {
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaQuizAttemptRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async readAttempt(submissionId: string): Promise<QuizAttemptWithQuiz | null> {
    const record = await this.#client.quizAttempt.findUnique({
      include: { quiz: true },
      where: { id: submissionId },
    });
    return record ? parseAttemptRecord(record) : null;
  }

  async readLatestForQuiz(quizId: string): Promise<QuizAttemptWithQuiz | null> {
    const record = await this.#client.quizAttempt.findFirst({
      include: { quiz: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { quizId },
    });
    return record ? parseAttemptRecord(record) : null;
  }

  async readActiveQuiz(lessonId: LessonId): Promise<ActiveSubmissionQuiz> {
    const lesson = await this.#client.lesson.findUnique({
      select: {
        quizzes: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          where: { isActive: true },
        },
      },
      where: { id: lessonId },
    });

    if (!lesson) return { status: "lesson_not_found" };
    if (!lesson.quizzes[0]) return { status: "quiz_not_found" };
    return { status: "ready", quiz: parseQuizRecord(lesson.quizzes[0]) };
  }

  async saveAttempt(input: QuizAttemptWithQuiz): Promise<
    | { status: "saved"; value: QuizAttemptWithQuiz }
    | { status: "replayed"; value: QuizAttemptWithQuiz }
    | { status: "idempotency_conflict" }
  > {
    try {
      await this.#client.quizAttempt.create({
        data: {
          answers: input.attempt.answers as Prisma.InputJsonValue,
          correctCount: input.attempt.correctCount,
          createdAt: new Date(input.attempt.createdAt),
          id: input.attempt.id,
          lessonId: input.attempt.lessonId,
          questionCount: input.attempt.questionCount,
          quizId: input.attempt.quizId,
          requestHash: input.attempt.requestHash,
          results: input.attempt.results as Prisma.InputJsonValue,
          scorePercent: input.attempt.scorePercent,
        },
      });
      return { status: "saved", value: input };
    } catch (error) {
      const existing = await this.readAttempt(input.attempt.id);
      if (!existing) throw error;
      return existing.attempt.requestHash === input.attempt.requestHash
        ? { status: "replayed", value: existing }
        : { status: "idempotency_conflict" };
    }
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}

function parseAttemptRecord(record: {
  id: string;
  lessonId: string;
  quizId: string;
  requestHash: string;
  answers: Prisma.JsonValue;
  results: Prisma.JsonValue;
  correctCount: number;
  questionCount: number;
  scorePercent: number;
  createdAt: Date;
  quiz: {
    id: string;
    lessonId: string;
    sourceSchemaVersion: number;
    questions: Prisma.JsonValue;
    createdAt: Date;
  };
}): QuizAttemptWithQuiz {
  const attempt = storedAttemptSchema.parse({
    answers: record.answers,
    correctCount: record.correctCount,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    lessonId: record.lessonId,
    questionCount: record.questionCount,
    quizId: record.quizId,
    requestHash: record.requestHash,
    results: record.results,
    scorePercent: record.scorePercent,
  }) as StoredQuizAttempt;
  return { attempt, quiz: parseQuizRecord(record.quiz) };
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
