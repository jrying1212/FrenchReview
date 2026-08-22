import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/lessons/route";
import type {
  Lesson,
  LessonId,
} from "@/lib/contracts/lesson";
import {
  createLessonResponse,
  listLessonsResponse,
} from "@/lib/lessons/lesson-api";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";

const lesson: Lesson = {
  id: "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98" as LessonId,
  title: "Les salutations",
  lessonDate: new Date("2026-08-22T00:00:00.000Z"),
  pdfStorageKey: null,
  pdfOriginalName: null,
  rawText: null,
  parsedContent: null,
  importStatus: "empty",
  parseStatus: "not_started",
  parseErrorCode: null,
  createdAt: new Date("2026-08-22T09:00:00.000Z"),
  updatedAt: new Date("2026-08-22T09:00:00.000Z"),
};

function createRepository(): LessonRepository {
  return {
    create: vi.fn(async () => lesson),
    list: vi.fn(async () => [lesson]),
    findById: vi.fn(async () => null),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
  };
}

describe("lesson collection API", () => {
  it("rejects malformed JSON before opening the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Send a valid JSON request body.",
      },
    });
  });

  it("creates a lesson from validated JSON and returns the stable envelope", async () => {
    const repository = createRepository();

    const response = await createLessonResponse(repository, {
      title: "  Les salutations  ",
      lessonDate: "2026-08-22",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        ...lesson,
        lessonDate: "2026-08-22T00:00:00.000Z",
        createdAt: "2026-08-22T09:00:00.000Z",
        updatedAt: "2026-08-22T09:00:00.000Z",
      },
    });
    expect(repository.create).toHaveBeenCalledWith({
      title: "Les salutations",
      lessonDate: new Date("2026-08-22T00:00:00.000Z"),
    });
  });

  it("returns accessible field errors without writing invalid input", async () => {
    const repository = createRepository();

    const response = await createLessonResponse(repository, {
      title: "   ",
      lessonDate: "not-a-date",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields and try again.",
        fieldErrors: {
          lessonDate: ["Enter a valid lesson date."],
          title: ["Enter a lesson title."],
        },
      },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("lists lessons in the repository order and hides persistence details", async () => {
    const repository = createRepository();

    const response = await listLessonsResponse(repository);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          ...lesson,
          lessonDate: "2026-08-22T00:00:00.000Z",
          createdAt: "2026-08-22T09:00:00.000Z",
          updatedAt: "2026-08-22T09:00:00.000Z",
        },
      ],
    });
  });

  it("returns a generic persistence error without exposing internals", async () => {
    const repository = createRepository();
    vi.mocked(repository.create).mockRejectedValue(
      new Error("SQLite file /private/path could not be opened"),
    );

    const response = await createLessonResponse(repository, {
      title: "Lesson 01",
      lessonDate: null,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PERSISTENCE_ERROR",
        message: "The lesson could not be saved. Please try again.",
      },
    });
  });
});
