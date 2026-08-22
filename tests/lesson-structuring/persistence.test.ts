import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  replaceStructuredLesson,
  type StructuredLessonRepository,
} from "@/lib/ai/structured-lesson-repository";
import { PrismaStructuredLessonRepository } from "@/lib/ai/prisma-structured-lesson-repository";
import { lessonIdSchema } from "@/lib/contracts/lesson";

import { completeGoldenLesson, minimalGoldenLesson } from "./golden-cases";

const lessonId = lessonIdSchema.parse("11111111-1111-4111-8111-111111111111");
const itemIds = [
  "21111111-1111-4111-8111-111111111111",
  "31111111-1111-4111-8111-111111111111",
  "41111111-1111-4111-8111-111111111111",
  "51111111-1111-4111-8111-111111111111",
  "61111111-1111-4111-8111-111111111111",
  "71111111-1111-4111-8111-111111111111",
  "81111111-1111-4111-8111-111111111111",
];
const provenance = {
  source: "fake",
  promptVersion: "lesson-structure-v1",
  modelId: "fake-lesson-structurer",
} as const;
const temporaryDirectories: string[] = [];

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "french-review-structured-"));
  const databasePath = join(directory, "test.db");
  const migrations = await Promise.all([
    readFile(
      join(process.cwd(), "prisma/migrations/20260822090000_init/migration.sql"),
      "utf8",
    ),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260822230000_review_item/migration.sql",
      ),
      "utf8",
    ),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260822231000_review_item_position/migration.sql",
      ),
      "utf8",
    ),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260822170000_structured_lesson_provenance/migration.sql",
      ),
      "utf8",
    ),
  ]);
  const database = new Database(databasePath);
  database.exec(migrations.join("\n"));
  database
    .prepare(
      `INSERT INTO Lesson (
        id, title, pdfStorageKey, rawText, importStatus, parseStatus, createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      lessonId,
      "Lesson 01",
      "22222222-2222-4222-8222-222222222222.pdf",
      "Bonjour",
      "ready",
      "not_started",
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

function readLessonRecord(databasePath: string) {
  const database = new Database(databasePath, { readonly: true });
  const record = database
    .prepare("SELECT * FROM Lesson WHERE id = ?")
    .get(lessonId) as Record<string, unknown>;
  database.close();
  return record;
}

describe("replaceStructuredLesson", () => {
  it("validates and assigns IDs before calling the repository", async () => {
    const replace = vi.fn<StructuredLessonRepository["replace"]>(async () => true);
    const repository: StructuredLessonRepository = { replace };
    let index = 0;

    const lesson = await replaceStructuredLesson({
      lessonId,
      draft: completeGoldenLesson,
      provenance,
      repository,
      generateId: () => itemIds[index++],
    });

    expect(lesson?.vocabulary.map((item) => item.id)).toEqual(itemIds.slice(0, 4));
    expect(replace).toHaveBeenCalledWith({ lessonId, lesson, provenance });
  });

  it("does not call the repository for invalid content or provenance", async () => {
    const replace = vi.fn<StructuredLessonRepository["replace"]>(async () => true);
    const repository: StructuredLessonRepository = { replace };

    await expect(
      replaceStructuredLesson({
        lessonId,
        draft: { ...minimalGoldenLesson, unknown: true },
        provenance,
        repository,
      }),
    ).rejects.toThrow();
    await expect(
      replaceStructuredLesson({
        lessonId,
        draft: minimalGoldenLesson,
        provenance: { ...provenance, sourceText: "private" },
        repository,
      }),
    ).rejects.toThrow();
    await expect(
      replaceStructuredLesson({
        lessonId,
        draft: minimalGoldenLesson,
        provenance: { ...provenance, modelId: "   " },
        repository,
      }),
    ).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("PrismaStructuredLessonRepository", () => {
  it("atomically persists content and safe provenance for a ready lesson", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const repository = new PrismaStructuredLessonRepository({ databaseUrl });
    let index = 0;

    const lesson = await replaceStructuredLesson({
      lessonId,
      draft: completeGoldenLesson,
      provenance,
      repository,
      generateId: () => itemIds[index++],
    });
    await repository.disconnect();

    const record = readLessonRecord(databasePath);
    expect(JSON.parse(record.parsedContent as string)).toEqual(lesson);
    expect(record).toMatchObject({
      parseErrorCode: null,
      parseStatus: "ready",
      structuredContentSource: "fake",
      structuredModelId: "fake-lesson-structurer",
      structuredPromptVersion: "lesson-structure-v1",
      structuredSchemaVersion: 1,
    });
    const database = new Database(databasePath, { readonly: true });
    const reviewItems = database
      .prepare(
        `SELECT structuredItemId, itemType, status, lastReviewedAt
         FROM ReviewItem ORDER BY structuredItemId`,
      )
      .all() as Array<Record<string, unknown>>;
    database.close();
    expect(reviewItems).toHaveLength(
      completeGoldenLesson.vocabulary.length +
        completeGoldenLesson.sentences.length,
    );
    expect(reviewItems.every((item) => item.status === "learning")).toBe(true);
    expect(reviewItems.every((item) => item.lastReviewedAt === null)).toBe(true);
    expect(new Set(reviewItems.map((item) => item.structuredItemId)).size).toBe(
      reviewItems.length,
    );
  });

  it("refuses a non-ready lesson without changing its prior content", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const database = new Database(databasePath);
    const prior = JSON.stringify({ existing: true });
    database
      .prepare(
        `UPDATE Lesson SET
          importStatus = 'failed', parsedContent = ?,
          structuredContentSource = 'manual', structuredSchemaVersion = 1,
          structuredPromptVersion = 'old-prompt', structuredModelId = 'manual-import'
        WHERE id = ?`,
      )
      .run(prior, lessonId);
    database.close();
    const repository = new PrismaStructuredLessonRepository({ databaseUrl });

    await expect(
      replaceStructuredLesson({
        lessonId,
        draft: minimalGoldenLesson,
        provenance,
        repository,
      }),
    ).resolves.toBeNull();
    await repository.disconnect();

    const record = readLessonRecord(databasePath);
    expect(record).toMatchObject({
      parsedContent: prior,
      structuredContentSource: "manual",
      structuredPromptVersion: "old-prompt",
      structuredModelId: "manual-import",
    });
  });

  it("prevents a claimed result from overwriting a replaced PDF source", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const repository = new PrismaStructuredLessonRepository({ databaseUrl });
    const claim = await repository.claim(lessonId);
    expect(claim).toMatchObject({ status: "claimed" });
    if (claim.status !== "claimed") throw new Error("Expected a source claim.");
    await expect(repository.claim(lessonId)).resolves.toEqual({
      status: "already_processing",
    });

    const replacement = new Database(databasePath);
    replacement
      .prepare(
        `UPDATE Lesson SET
          pdfStorageKey = '33333333-3333-4333-8333-333333333333.pdf',
          rawText = 'replacement source', parseStatus = 'not_started'
        WHERE id = ?`,
      )
      .run(lessonId);
    replacement.close();

    await expect(
      replaceStructuredLesson({
        lessonId,
        draft: minimalGoldenLesson,
        guard: { parseStatus: "processing", storageKey: claim.storageKey },
        provenance,
        repository,
      }),
    ).resolves.toBeNull();
    await repository.disconnect();

    expect(readLessonRecord(databasePath)).toMatchObject({
      parsedContent: null,
      parseStatus: "not_started",
      rawText: "replacement source",
      structuredContentSource: null,
    });
  });

  it("does not claim persisted blank source text", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const database = new Database(databasePath);
    database.prepare("UPDATE Lesson SET rawText = '   ' WHERE id = ?").run(lessonId);
    database.close();
    const repository = new PrismaStructuredLessonRepository({ databaseUrl });

    await expect(repository.claim(lessonId)).resolves.toEqual({
      status: "source_not_ready",
    });
    await repository.disconnect();
    expect(readLessonRecord(databasePath).parseStatus).toBe("not_started");
  });
});
