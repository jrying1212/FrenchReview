import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { POST as POST_ATTEMPT } from "@/app/api/lessons/[id]/quiz/attempts/route";
import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import { lessonIdSchema } from "@/lib/contracts/lesson";
import type { Quiz, QuizSubmittedAnswer } from "@/lib/contracts/quiz";
import { generateQuiz } from "@/lib/quiz/quiz-api";
import { PrismaQuizAttemptRepository } from "@/lib/quiz/quiz-attempt-repository";
import { PrismaQuizRepository } from "@/lib/quiz/quiz-repository";
import {
  submitQuizAttempt,
  submitQuizAttemptResponse,
} from "@/lib/quiz/submit-attempt";

import { completeGoldenLesson } from "../lesson-structuring/golden-cases";

const lessonId = lessonIdSchema.parse("11111111-1111-4111-8111-111111111111");
const submissionId = "22222222-2222-4222-8222-222222222222";
const ids = Array.from(
  { length: 100 },
  (_, index) => `a0000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);
const temporaryDirectories: string[] = [];

function idSequence(start: number) {
  let index = start;
  return () => ids[index++];
}

function structuredLesson() {
  let index = 0;
  return assignStructuredItemIds(completeGoldenLesson, () => ids[index++]);
}

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "french-review-attempt-"));
  const databasePath = join(directory, "test.db");
  const migrationNames = [
    "20260822090000_init",
    "20260822170000_structured_lesson_provenance",
    "20260822210000_lesson_quiz",
    "20260822211000_one_active_quiz",
    "20260822220000_quiz_attempt",
  ];
  const migrations = await Promise.all(
    migrationNames.map((name) =>
      readFile(
        join(process.cwd(), "prisma/migrations", name, "migration.sql"),
        "utf8",
      ),
    ),
  );
  const database = new Database(databasePath);
  database.exec(migrations.join("\n"));
  database
    .prepare(
      `INSERT INTO Lesson (
        id, title, parsedContent, importStatus, parseStatus,
        structuredSchemaVersion, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      lessonId,
      "Lesson 01",
      JSON.stringify(structuredLesson()),
      "ready",
      "ready",
      1,
      "2026-08-22T00:00:00.000Z",
      "2026-08-22T00:00:00.000Z",
    );
  database.close();
  temporaryDirectories.push(directory);
  return { databasePath, databaseUrl: `file:${databasePath}` };
}

async function createActiveQuiz(databaseUrl: string, start = 10) {
  const repository = new PrismaQuizRepository({ databaseUrl });
  await generateQuiz({
    confirmReplace: false,
    generateId: idSequence(start),
    lessonId,
    now: () => new Date("2026-08-22T09:00:00.000Z"),
    repository,
  });
  const active = await repository.readActive(lessonId);
  await repository.disconnect();
  if (active.status !== "ready") throw new Error("Expected an active quiz.");
  return active.quiz;
}

function correctAnswers(quiz: Quiz): QuizSubmittedAnswer[] {
  return quiz.questions.map((question) => {
    switch (question.type) {
      case "multiple_choice":
      case "article_blank":
        return {
          questionId: question.id,
          type: question.type,
          optionId: question.correctOptionId,
        };
      case "fr_to_en":
      case "en_to_fr":
        return {
          questionId: question.id,
          type: question.type,
          text: question.referenceAnswer,
        };
      case "sentence_ordering":
        return {
          questionId: question.id,
          type: question.type,
          tokenIds: question.correctTokenIds,
        };
      default: {
        const exhaustive: never = question;
        throw new Error(`Unsupported fixture question: ${String(exhaustive)}`);
      }
    }
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("quiz attempts", () => {
  it("saves one immutable completed attempt with deterministic feedback", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const repository = new PrismaQuizAttemptRepository({ databaseUrl });

    const result = await submitQuizAttempt(
      {
        answers: correctAnswers(quiz),
        quizId: quiz.id,
        submissionId,
      },
      lessonId,
      {
        now: () => new Date("2026-08-22T10:00:00.000Z"),
        repository,
      },
    );
    await repository.disconnect();

    expect(result).toMatchObject({
      replayed: false,
      attempt: {
        id: submissionId,
        quizId: quiz.id,
        correctCount: 5,
        questionCount: 5,
        scorePercent: 100,
      },
    });
    expect(result.feedback.every((item) => item.correct)).toBe(true);
    expect(result.feedback.every((item) => item.explanationEn.length > 0)).toBe(true);

    const database = new Database(databasePath, { readonly: true });
    const saved = database.prepare("SELECT * FROM QuizAttempt").get() as Record<
      string,
      unknown
    >;
    database.close();
    expect(saved).toMatchObject({ id: submissionId, quizId: quiz.id, scorePercent: 100 });
    expect(saved.answers).not.toContain("correctOptionId");
  });

  it("replays equivalent reordered answers without creating a duplicate", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const repository = new PrismaQuizAttemptRepository({ databaseUrl });
    const submission = {
      answers: correctAnswers(quiz),
      quizId: quiz.id,
      submissionId,
    };

    const first = await submitQuizAttempt(submission, lessonId, {
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      repository,
    });
    const replay = await submitQuizAttempt(
      { ...submission, answers: [...submission.answers].reverse() },
      lessonId,
      {
        now: () => new Date("2026-08-22T11:00:00.000Z"),
        repository,
      },
    );
    await repository.disconnect();

    expect(replay).toEqual({ ...first, replayed: true });
    const database = new Database(databasePath, { readonly: true });
    const count = database
      .prepare("SELECT COUNT(*) AS count FROM QuizAttempt")
      .get() as { count: number };
    database.close();
    expect(count.count).toBe(1);
  });

  it("rejects reuse of a submission ID with different answers", async () => {
    const { databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const repository = new PrismaQuizAttemptRepository({ databaseUrl });
    const answers = correctAnswers(quiz);
    await submitQuizAttempt(
      { answers, quizId: quiz.id, submissionId },
      lessonId,
      { repository },
    );

    const changedAnswers = answers.map((answer) =>
      "text" in answer ? { ...answer, text: `${answer.text} changed` } : answer,
    );
    await expect(
      submitQuizAttempt(
        { answers: changedAnswers, quizId: quiz.id, submissionId },
        lessonId,
        { repository },
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await repository.disconnect();
  });

  it("preserves and replays the historical attempt after regeneration", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const originalQuiz = await createActiveQuiz(databaseUrl);
    const attemptRepository = new PrismaQuizAttemptRepository({ databaseUrl });
    const submission = {
      answers: correctAnswers(originalQuiz),
      quizId: originalQuiz.id,
      submissionId,
    };
    const original = await submitQuizAttempt(submission, lessonId, {
      repository: attemptRepository,
    });

    const quizRepository = new PrismaQuizRepository({ databaseUrl });
    await generateQuiz({
      confirmReplace: true,
      generateId: idSequence(50),
      lessonId,
      repository: quizRepository,
    });
    await quizRepository.disconnect();

    const replay = await submitQuizAttempt(submission, lessonId, {
      repository: attemptRepository,
    });
    await attemptRepository.disconnect();
    expect(replay).toEqual({ ...original, replayed: true });

    const database = new Database(databasePath, { readonly: true });
    const saved = database
      .prepare("SELECT quizId FROM QuizAttempt WHERE id = ?")
      .get(submissionId) as { quizId: string };
    database.close();
    expect(saved.quizId).toBe(originalQuiz.id);
  });

  it("cascades quizzes and attempts when their lesson is deleted", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const repository = new PrismaQuizAttemptRepository({ databaseUrl });
    await submitQuizAttempt(
      {
        answers: correctAnswers(quiz),
        quizId: quiz.id,
        submissionId,
      },
      lessonId,
      { repository },
    );
    await repository.disconnect();

    const database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    database.prepare("DELETE FROM Lesson WHERE id = ?").run(lessonId);
    const quizCount = database.prepare("SELECT COUNT(*) AS count FROM Quiz").get() as {
      count: number;
    };
    const attemptCount = database
      .prepare("SELECT COUNT(*) AS count FROM QuizAttempt")
      .get() as { count: number };
    database.close();

    expect(quizCount.count).toBe(0);
    expect(attemptCount.count).toBe(0);
  });
});

describe("quiz attempt API", () => {
  it("returns safe validation and idempotency conflict envelopes", async () => {
    const { databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const repository = new PrismaQuizAttemptRepository({ databaseUrl });

    const invalid = await submitQuizAttemptResponse(
      { quizId: quiz.id, submissionId, answers: [], sourceText: "private" },
      lessonId,
      { repository },
    );
    expect(invalid.status).toBe(400);

    const submission = {
      answers: correctAnswers(quiz),
      quizId: quiz.id,
      submissionId,
    };
    const success = await submitQuizAttemptResponse(submission, lessonId, {
      repository,
    });
    expect(success.status).toBe(201);

    const changedAnswers = submission.answers.map((answer) =>
      "text" in answer ? { ...answer, text: "different" } : answer,
    );
    const conflict = await submitQuizAttemptResponse(
      { ...submission, answers: changedAnswers },
      lessonId,
      { repository },
    );
    await repository.disconnect();
    expect(conflict.status).toBe(422);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("bounds route bodies and persists a valid submission", async () => {
    const { databaseUrl } = await createTestDatabase();
    const quiz = await createActiveQuiz(databaseUrl);
    const priorDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;
    const context = { params: Promise.resolve({ id: lessonId }) };

    try {
      const oversized = await POST_ATTEMPT(
        new Request(`http://localhost/api/lessons/${lessonId}/quiz/attempts`, {
          body: JSON.stringify({ value: "x".repeat(64 * 1_024) }),
          method: "POST",
        }),
        context,
      );
      expect(oversized.status).toBe(400);

      const response = await POST_ATTEMPT(
        new Request(`http://localhost/api/lessons/${lessonId}/quiz/attempts`, {
          body: JSON.stringify({
            answers: correctAnswers(quiz),
            quizId: quiz.id,
            submissionId,
          }),
          method: "POST",
        }),
        context,
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        data: { attempt: { scorePercent: 100 }, replayed: false },
      });
    } finally {
      if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });
});
