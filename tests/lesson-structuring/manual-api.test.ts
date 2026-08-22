import { describe, expect, it, vi } from "vitest";

import {
  manualImportResponse,
  manualPromptResponse,
  type ManualLessonRepository,
} from "@/lib/ai/manual-lesson-api";
import type { PersistStructuredLessonInput } from "@/lib/ai/structured-lesson-repository";
import { lessonIdSchema } from "@/lib/contracts/lesson";

import { completeGoldenLesson, minimalGoldenLesson } from "./golden-cases";

const lessonId = lessonIdSchema.parse("11111111-1111-4111-8111-111111111111");
const sourceText = "Leçon privée\nBonjour, Élise !";

function createRepository(
  source: Awaited<ReturnType<ManualLessonRepository["readSource"]>> = {
    status: "ready",
    sourceText,
  },
) {
  const state = {
    content: { previous: true } as unknown,
    provenance: { source: "fake" } as unknown,
  };
  const repository: ManualLessonRepository = {
    readSource: vi.fn(async () => source),
    replace: vi.fn(async (input: PersistStructuredLessonInput) => {
      state.content = input.lesson;
      state.provenance = input.provenance;
      return true;
    }),
  };
  return { repository, state };
}

function putRequest(body: string) {
  return new Request("http://localhost/api/lessons/example/structured-content", {
    body,
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

describe("manual lesson prompt API", () => {
  it("builds the versioned prompt and schema from persisted ready source", async () => {
    const { repository } = createRepository();

    const response = await manualPromptResponse(lessonId, { repository });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        prompt: {
          responseSchema: { type: "object" },
          system: expect.stringContaining("Do not generate item IDs"),
          user: expect.stringContaining(JSON.stringify(sourceText)),
          version: "lesson-structure-v1",
        },
      },
    });
    expect(repository.readSource).toHaveBeenCalledOnce();
  });

  it.each([
    [{ status: "not_found" } as const, 404, "LESSON_NOT_FOUND"],
    [{ status: "source_not_ready" } as const, 409, "SOURCE_NOT_READY"],
  ])("maps unavailable source to a safe response", async (source, status, code) => {
    const { repository } = createRepository(source);

    const response = await manualPromptResponse(lessonId, { repository });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});

describe("manual structured lesson import API", () => {
  it.each([
    ["{not json", "INVALID_JSON"],
    [JSON.stringify({ ...minimalGoldenLesson, unknown: true }), "INVALID_CONTENT"],
    [
      JSON.stringify({
        ...minimalGoldenLesson,
        sentences: [
          {
            id: "21111111-1111-4111-8111-111111111111",
            french: "Bonjour !",
            meaningEn: "Hello!",
            noteEn: null,
            sourceKind: "source",
          },
        ],
      }),
      "INVALID_CONTENT",
    ],
  ])("rejects invalid input without replacing prior content", async (body, code) => {
    const { repository, state } = createRepository();

    const response = await manualImportResponse(putRequest(body), lessonId, {
      repository,
    });

    expect(response.status).toBe(code === "INVALID_JSON" ? 400 : 422);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(repository.replace).not.toHaveBeenCalled();
    expect(state.content).toEqual({ previous: true });
  });

  it("rejects a body over 1 MiB before validation", async () => {
    const { repository, state } = createRepository();
    const body = JSON.stringify({ value: "é".repeat(600_000) });

    const response = await manualImportResponse(putRequest(body), lessonId, {
      repository,
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BODY_TOO_LARGE" },
    });
    expect(repository.replace).not.toHaveBeenCalled();
    expect(state.content).toEqual({ previous: true });
  });

  it("assigns fresh IDs and atomically persists manual provenance", async () => {
    const { repository, state } = createRepository();

    const response = await manualImportResponse(
      putRequest(JSON.stringify(completeGoldenLesson)),
      lessonId,
      { repository },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.lesson.vocabulary[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.lesson.sentences[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.provenance).toEqual({
      modelId: "manual-import",
      promptVersion: "lesson-structure-v1",
      source: "manual",
    });
    expect(state).toEqual({
      content: body.data.lesson,
      provenance: body.data.provenance,
    });
  });
});
