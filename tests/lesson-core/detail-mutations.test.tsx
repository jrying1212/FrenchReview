import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/lessons/[id]/route";
import type { Lesson, LessonId } from "@/lib/contracts/lesson";
import {
  deleteLessonResponse,
  getLessonResponse,
  updateLessonResponse,
} from "@/lib/lessons/lesson-api";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";
import {
  deleteLessonAndFile,
  resolveUploadPath,
} from "@/lib/lessons/delete-lesson";

const lessonId = "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98" as LessonId;
const lesson: Lesson = {
  id: lessonId,
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
    findById: vi.fn(async () => lesson),
    update: vi.fn(async () => ({
      ...lesson,
      lessonDate: null,
      title: "Les nombres",
    })),
    delete: vi.fn(async () => true),
  };
}

describe("lesson detail API", () => {
  it("rejects an invalid path identifier before opening the database", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/lessons/not-a-uuid", {
        body: JSON.stringify({ title: "Lesson" }),
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_ID", message: "Invalid lesson identifier." },
    });
  });

  it("rejects malformed update JSON", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/lessons/${lessonId}`, {
        body: "{",
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: lessonId }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_JSON" },
    });
  });

  it("returns a lesson for a valid identifier", async () => {
    const response = await getLessonResponse(createRepository(), lessonId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: lessonId, title: "Les salutations" },
    });
  });

  it("returns not found when a valid identifier has no lesson", async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(null);

    const response = await getLessonResponse(repository, lessonId);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Lesson not found." },
    });
  });

  it("normalizes and persists supported lesson updates", async () => {
    const repository = createRepository();

    const response = await updateLessonResponse(repository, lessonId, {
      lessonDate: null,
      title: "  Les nombres  ",
    });

    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith(lessonId, {
      lessonDate: null,
      title: "Les nombres",
    });
  });

  it("rejects empty or invalid updates without writing", async () => {
    const repository = createRepository();

    const response = await updateLessonResponse(repository, lessonId, {
      title: "   ",
    });

    expect(response.status).toBe(422);
    expect(repository.update).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { title: ["Enter a lesson title."] },
      },
    });
  });
});

describe("lesson deletion", () => {
  it("resolves generated storage keys only beneath the upload root", () => {
    const uploadRoot = join(process.cwd(), "data", "uploads");

    expect(resolveUploadPath("lesson.pdf", uploadRoot)).toBe(
      join(uploadRoot, "lesson.pdf"),
    );
    expect(() => resolveUploadPath("../outside.pdf", uploadRoot)).toThrow(
      "Unsafe PDF storage key.",
    );
    expect(() => resolveUploadPath("/tmp/outside.pdf", uploadRoot)).toThrow(
      "Unsafe PDF storage key.",
    );
    expect(() => resolveUploadPath("..\\outside.pdf", uploadRoot)).toThrow(
      "Unsafe PDF storage key.",
    );
  });

  it("deletes the database record before removing its local file", async () => {
    const events: string[] = [];
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue({
      ...lesson,
      pdfStorageKey: "lesson.pdf",
    });
    vi.mocked(repository.delete).mockImplementation(async () => {
      events.push("database");
      return true;
    });
    const removeFile = vi.fn(async () => {
      events.push("file");
    });

    const result = await deleteLessonAndFile(repository, lessonId, {
      removeFile,
      uploadRoot: join(process.cwd(), "data", "uploads"),
    });

    expect(result).toEqual({ status: "deleted" });
    expect(events).toEqual(["database", "file"]);
  });

  it("reports cleanup failure without resurrecting deleted data", async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue({
      ...lesson,
      pdfStorageKey: "../outside.pdf",
    });
    const reportCleanupFailure = vi.fn();

    const result = await deleteLessonAndFile(repository, lessonId, {
      reportCleanupFailure,
      uploadRoot: join(process.cwd(), "data", "uploads"),
    });

    expect(result).toEqual({ status: "deleted_with_cleanup_error" });
    expect(repository.delete).toHaveBeenCalledWith(lessonId);
    expect(reportCleanupFailure).toHaveBeenCalledWith(lessonId);
  });

  it("returns the cleanup outcome in the delete API envelope", async () => {
    const repository = createRepository();

    const response = await deleteLessonResponse(repository, lessonId, {
      uploadRoot: join(process.cwd(), "data", "uploads"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { cleanupStatus: "complete", deleted: true, id: lessonId },
    });
  });
});
