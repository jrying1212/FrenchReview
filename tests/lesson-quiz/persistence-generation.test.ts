import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/lessons/[id]/quiz/route";
import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import { lessonIdSchema } from "@/lib/contracts/lesson";
import {
  generateQuiz,
  generateQuizResponse,
  getQuizResponse,
} from "@/lib/quiz/quiz-api";
import { PrismaQuizRepository } from "@/lib/quiz/quiz-repository";

import { completeGoldenLesson } from "../lesson-structuring/golden-cases";

const lessonId = lessonIdSchema.parse("11111111-1111-4111-8111-111111111111");
const generatedIds = Array.from(
  { length: 80 },
  (_, index) => `80000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);
const temporaryDirectories: string[] = [];

function idSequence(start = 10) {
  let index = start;
  return () => generatedIds[index++];
}

function structuredLesson() {
  let index = 0;
  return assignStructuredItemIds(completeGoldenLesson, () => generatedIds[index++]);
}

async function createTestDatabase(options?: { withStructuredLesson?: boolean }) {
  const directory = await mkdtemp(join(tmpdir(), "french-review-quiz-"));
  const databasePath = join(directory, "test.db");
  const migrationPaths = [
    "20260822090000_init",
    "20260822170000_structured_lesson_provenance",
    "20260822210000_lesson_quiz",
    "20260822211000_one_active_quiz",
  ];
  const migrations = await Promise.all(
    migrationPaths.map((migration) =>
      readFile(
        join(process.cwd(), "prisma/migrations", migration, "migration.sql"),
        "utf8",
      ),
    ),
  );
  const database = new Database(databasePath);
  database.exec(migrations.join("\n"));
  const parsedContent = options?.withStructuredLesson === false
    ? null
    : JSON.stringify(structuredLesson());
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
      parsedContent,
      "ready",
      parsedContent ? "ready" : "not_started",
      parsedContent ? 1 : null,
      "2026-08-22T00:00:00.000Z",
      "2026-08-22T00:00:00.000Z",
    );
  database.close();
  temporaryDirectories.push(directory);

  return { databasePath, databaseUrl: `file:${databasePath}` };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("quiz persistence and generation", () => {
  it("persists one active quiz and exposes an answer-free client DTO", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const repository = new PrismaQuizRepository({ databaseUrl });

    const result = await generateQuiz({
      confirmReplace: false,
      generateId: idSequence(),
      lessonId,
      now: () => new Date("2026-08-22T09:00:00.000Z"),
      repository,
    });
    await repository.disconnect();

    expect(result.replaced).toBe(false);
    expect(result.quiz.questions).toHaveLength(5);
    const clientJson = JSON.stringify(result.quiz);
    expect(clientJson).not.toContain("correctOptionId");
    expect(clientJson).not.toContain("acceptedAnswers");
    expect(clientJson).not.toContain("referenceAnswer");
    expect(clientJson).not.toContain("correctTokenIds");
    expect(clientJson).not.toContain("explanationEn");

    const database = new Database(databasePath, { readonly: true });
    const saved = database.prepare("SELECT * FROM Quiz").get() as Record<
      string,
      unknown
    >;
    database.close();
    expect(saved).toMatchObject({ isActive: 1, lessonId });
    expect(saved.questions).toContain("correctOptionId");

    const writableDatabase = new Database(databasePath);
    expect(() =>
      writableDatabase
        .prepare(
          `INSERT INTO Quiz (
            id, lessonId, sourceSchemaVersion, questions, isActive, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          generatedIds[70],
          lessonId,
          1,
          saved.questions,
          1,
          "2026-08-22T09:01:00.000Z",
        ),
    ).toThrow(/unique/i);
    writableDatabase.close();
  });

  it("requires confirmation to replace and retains the prior quiz row", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const repository = new PrismaQuizRepository({ databaseUrl });
    const first = await generateQuiz({
      confirmReplace: false,
      generateId: idSequence(10),
      lessonId,
      now: () => new Date("2026-08-22T09:00:00.000Z"),
      repository,
    });

    await expect(
      generateQuiz({
        confirmReplace: false,
        generateId: idSequence(30),
        lessonId,
        now: () => new Date("2026-08-22T10:00:00.000Z"),
        repository,
      }),
    ).rejects.toMatchObject({ code: "QUIZ_REPLACEMENT_CONFIRMATION_REQUIRED" });

    const replacement = await generateQuiz({
      confirmReplace: true,
      generateId: idSequence(30),
      lessonId,
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      repository,
    });
    await repository.disconnect();

    expect(replacement.replaced).toBe(true);
    expect(replacement.quiz.id).not.toBe(first.quiz.id);
    const database = new Database(databasePath, { readonly: true });
    const rows = database
      .prepare("SELECT id, isActive FROM Quiz ORDER BY createdAt")
      .all() as Array<{ id: string; isActive: number }>;
    database.close();
    expect(rows).toEqual([
      { id: first.quiz.id, isActive: 0 },
      { id: replacement.quiz.id, isActive: 1 },
    ]);
  });

  it("rejects missing and stale structured content without writing a quiz", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase({
      withStructuredLesson: false,
    });
    const repository = new PrismaQuizRepository({ databaseUrl });

    await expect(
      generateQuiz({
        confirmReplace: false,
        generateId: idSequence(),
        lessonId,
        now: () => new Date(),
        repository,
      }),
    ).rejects.toMatchObject({ code: "STRUCTURED_LESSON_NOT_READY" });
    await repository.disconnect();

    const database = new Database(databasePath, { readonly: true });
    const count = database.prepare("SELECT COUNT(*) AS count FROM Quiz").get() as {
      count: number;
    };
    database.close();
    expect(count.count).toBe(0);
  });
});

describe("quiz API responses", () => {
  it("rejects unknown generation fields and returns stable confirmation errors", async () => {
    const { databaseUrl } = await createTestDatabase();
    const repository = new PrismaQuizRepository({ databaseUrl });

    const invalid = await generateQuizResponse(
      { sourceText: "private", confirmReplace: true },
      lessonId,
      {
        generateId: idSequence(),
        now: () => new Date("2026-08-22T09:00:00.000Z"),
        repository,
      },
    );
    expect(invalid.status).toBe(400);

    await generateQuiz({
      confirmReplace: false,
      generateId: idSequence(),
      lessonId,
      now: () => new Date("2026-08-22T09:00:00.000Z"),
      repository,
    });
    const confirmation = await generateQuizResponse({}, lessonId, {
      generateId: idSequence(30),
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      repository,
    });
    await repository.disconnect();

    expect(confirmation.status).toBe(409);
    await expect(confirmation.json()).resolves.toEqual({
      error: {
        code: "QUIZ_REPLACEMENT_CONFIRMATION_REQUIRED",
        message: "Confirm before replacing the current quiz.",
      },
    });
  });

  it("returns the active quiz without server-only answer fields", async () => {
    const { databaseUrl } = await createTestDatabase();
    const repository = new PrismaQuizRepository({ databaseUrl });
    await generateQuiz({
      confirmReplace: false,
      generateId: idSequence(),
      lessonId,
      now: () => new Date("2026-08-22T09:00:00.000Z"),
      repository,
    });

    const response = await getQuizResponse(lessonId, { repository });
    await repository.disconnect();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.quiz.questions).toHaveLength(5);
    expect(JSON.stringify(body)).not.toContain("correctOptionId");
  });
});

describe("quiz route", () => {
  it("bounds request bodies and serves only the answer-free active quiz", async () => {
    const { databaseUrl } = await createTestDatabase();
    const priorDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;
    const context = { params: Promise.resolve({ id: lessonId }) };

    try {
      const oversized = await POST(
        new Request(`http://localhost/api/lessons/${lessonId}/quiz`, {
          body: JSON.stringify({ value: "x".repeat(1_024) }),
          method: "POST",
        }),
        context,
      );
      expect(oversized.status).toBe(400);

      const generated = await POST(
        new Request(`http://localhost/api/lessons/${lessonId}/quiz`, {
          body: "{}",
          method: "POST",
        }),
        context,
      );
      expect(generated.status).toBe(200);

      const loaded = await GET(
        new Request(`http://localhost/api/lessons/${lessonId}/quiz`),
        context,
      );
      expect(loaded.status).toBe(200);
      expect(JSON.stringify(await loaded.json())).not.toContain("correctOptionId");
    } finally {
      if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });
});
