import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  createLessonSchema,
  lessonIdSchema,
  updateLessonSchema,
} from "@/lib/contracts/lesson";
import { PrismaLessonRepository } from "@/lib/lessons/prisma-lesson-repository";

const temporaryDirectories: string[] = [];

async function createTestDatabase(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "french-review-test-"));
  const databasePath = join(directory, "test.db");
  const migration = await readFile(
    join(process.cwd(), "prisma/migrations/20260822090000_init/migration.sql"),
    "utf8",
  );
  const database = new Database(databasePath);

  database.exec(migration);
  database.close();
  temporaryDirectories.push(directory);

  return `file:${databasePath}`;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("lesson contracts", () => {
  it("normalizes valid creation input and supplies a null lesson date", () => {
    const input = createLessonSchema.parse({ title: "  Lesson 01  " });

    expect(input).toEqual({ title: "Lesson 01", lessonDate: null });
  });

  it("rejects empty, oversized, and unknown creation fields", () => {
    expect(() => createLessonSchema.parse({ title: "   " })).toThrow();
    expect(() =>
      createLessonSchema.parse({ title: "a".repeat(121) }),
    ).toThrow();
    expect(() =>
      createLessonSchema.parse({ title: "Lesson", importStatus: "ready" }),
    ).toThrow();
  });

  it("requires updates to contain a supported field", () => {
    expect(() => updateLessonSchema.parse({})).toThrow();
    expect(() => updateLessonSchema.parse({ parseStatus: "ready" })).toThrow();
    expect(updateLessonSchema.parse({ title: "  Updated  " })).toEqual({
      title: "Updated",
    });
  });

  it("accepts UUID lesson identifiers only", () => {
    expect(() => lessonIdSchema.parse("lesson-1")).toThrow();
    expect(
      lessonIdSchema.parse("6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98"),
    ).toBe("6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98");
  });
});

describe("PrismaLessonRepository", () => {
  it("creates a lesson with server-owned defaults and finds it by ID", async () => {
    const repository = new PrismaLessonRepository({
      databaseUrl: await createTestDatabase(),
    });

    const lesson = await repository.create(
      createLessonSchema.parse({
        title: "Lesson 01",
        lessonDate: new Date("2026-08-22T00:00:00.000Z"),
      }),
    );

    expect(lesson).toMatchObject({
      title: "Lesson 01",
      lessonDate: new Date("2026-08-22T00:00:00.000Z"),
      pdfStorageKey: null,
      pdfOriginalName: null,
      rawText: null,
      parsedContent: null,
      importStatus: "empty",
      parseStatus: "not_started",
      parseErrorCode: null,
    });
    expect(lesson.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(lesson.createdAt).toBeInstanceOf(Date);
    expect(lesson.updatedAt).toBeInstanceOf(Date);
    await expect(repository.findById(lesson.id)).resolves.toEqual(lesson);

    await repository.disconnect();
  });

  it("lists newest lessons first and persists updates across connections", async () => {
    const databaseUrl = await createTestDatabase();
    const firstConnection = new PrismaLessonRepository({ databaseUrl });
    const first = await firstConnection.create(
      createLessonSchema.parse({ title: "Lesson 01" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await firstConnection.create(
      createLessonSchema.parse({ title: "Lesson 02" }),
    );

    await firstConnection.update(
      first.id,
      updateLessonSchema.parse({ title: "Updated lesson" }),
    );
    await firstConnection.disconnect();

    const secondConnection = new PrismaLessonRepository({ databaseUrl });
    await expect(secondConnection.list()).resolves.toEqual([
      expect.objectContaining({ id: second.id, title: "Lesson 02" }),
      expect.objectContaining({ id: first.id, title: "Updated lesson" }),
    ]);
    await secondConnection.disconnect();
  });

  it("returns null for missing records and reports whether deletion occurred", async () => {
    const repository = new PrismaLessonRepository({
      databaseUrl: await createTestDatabase(),
    });
    const missingId = lessonIdSchema.parse(
      "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98",
    );

    await expect(repository.findById(missingId)).resolves.toBeNull();
    await expect(repository.update(missingId, { title: "Missing" })).resolves.toBeNull();
    await expect(repository.delete(missingId)).resolves.toBe(false);

    const lesson = await repository.create(
      createLessonSchema.parse({ title: "Delete me" }),
    );
    await expect(repository.delete(lesson.id)).resolves.toBe(true);
    await expect(repository.findById(lesson.id)).resolves.toBeNull();

    await repository.disconnect();
  });
});
