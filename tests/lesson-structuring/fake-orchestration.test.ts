import { describe, expect, it, vi } from "vitest";

import {
  structureLesson,
  structureLessonResponse,
  type LessonStructureOrchestrationRepository,
} from "@/lib/ai/structure-lesson";
import { FakeLessonStructurer } from "@/lib/ai/providers/fake-lesson-structurer";
import type { PersistStructuredLessonInput } from "@/lib/ai/structured-lesson-repository";
import { lessonIdSchema } from "@/lib/contracts/lesson";

import { completeGoldenLesson, minimalGoldenLesson } from "./golden-cases";

const lessonId = lessonIdSchema.parse("11111111-1111-4111-8111-111111111111");
const sourceText = "Leçon privée\nBonjour, Élise !";
const storageKey = "22222222-2222-4222-8222-222222222222.pdf";

function createRepository(
  claimResult: Awaited<
    ReturnType<LessonStructureOrchestrationRepository["claim"]>
  > = { status: "claimed", sourceText, storageKey },
) {
  const state = {
    content: { previous: true } as unknown,
    errorCode: null as string | null,
    parseStatus: "ready",
    provenance: { source: "manual" },
  };
  const repository: LessonStructureOrchestrationRepository = {
    claim: vi.fn(async () => {
      if (claimResult.status === "claimed") state.parseStatus = "processing";
      return claimResult;
    }),
    fail: vi.fn(async (_lessonId, expectedStorageKey, code) => {
      if (expectedStorageKey !== storageKey || state.parseStatus !== "processing") {
        return false;
      }
      state.errorCode = code;
      state.parseStatus = "failed";
      return true;
    }),
    replace: vi.fn(async (input: PersistStructuredLessonInput) => {
      if (
        input.guard?.storageKey !== storageKey ||
        input.guard.parseStatus !== "processing" ||
        state.parseStatus !== "processing"
      ) {
        return false;
      }
      state.content = input.lesson;
      state.provenance = input.provenance;
      state.errorCode = null;
      state.parseStatus = "ready";
      return true;
    }),
  };
  return { repository, state };
}

describe("fake lesson generation orchestration", () => {
  it("claims persisted source, validates fake output, and saves fake provenance", async () => {
    const { repository, state } = createRepository();
    const structurer = new FakeLessonStructurer({
      kind: "success",
      output: completeGoldenLesson,
    });

    const result = await structureLesson({
      lessonId,
      repository,
      requestId: "request-1",
      structurer,
    });

    expect(result.lesson.title).toBe(completeGoldenLesson.title);
    expect(result.lesson.vocabulary[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.provenance).toEqual({
      modelId: FakeLessonStructurer.modelId,
      promptVersion: "lesson-structure-v1",
      source: "fake",
    });
    expect(state).toMatchObject({
      errorCode: null,
      parseStatus: "ready",
      provenance: result.provenance,
    });
  });

  it("makes exactly one repair attempt with schema paths and then succeeds", async () => {
    const { repository } = createRepository();
    const structurer = new FakeLessonStructurer([
      { kind: "malformed" },
      { kind: "success", output: minimalGoldenLesson },
    ]);

    await expect(
      structureLesson({
        lessonId,
        repository,
        requestId: "request-2",
        structurer,
      }),
    ).resolves.toMatchObject({ lesson: { title: minimalGoldenLesson.title } });
    expect(structurer.inputs).toHaveLength(2);
    expect(structurer.inputs[0].repair).toBeUndefined();
    expect(structurer.inputs[1].repair?.schemaErrorPaths.length).toBeGreaterThan(0);
    expect(JSON.stringify(structurer.inputs[1].repair)).not.toContain("{malformed");
  });

  it("records INVALID_AI_OUTPUT after the bounded repair and preserves prior data", async () => {
    const { repository, state } = createRepository();
    const structurer = new FakeLessonStructurer([
      { kind: "malformed" },
      { kind: "malformed", output: { still: "invalid" } },
      { kind: "success", output: minimalGoldenLesson },
    ]);

    await expect(
      structureLesson({
        lessonId,
        repository,
        requestId: "request-3",
        structurer,
      }),
    ).rejects.toMatchObject({ code: "INVALID_AI_OUTPUT" });
    expect(structurer.inputs).toHaveLength(2);
    expect(state).toEqual({
      content: { previous: true },
      errorCode: "INVALID_AI_OUTPUT",
      parseStatus: "failed",
      provenance: { source: "manual" },
    });
  });

  it("maps provider failures without exposing source text or payloads", async () => {
    const { repository, state } = createRepository();
    const structurer = new FakeLessonStructurer({
      kind: "timeout",
      providerPayload: "PRIVATE_PROVIDER_PAYLOAD",
    });

    let caught: unknown;
    try {
      await structureLesson({
        lessonId,
        repository,
        requestId: "request-4",
        structurer,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "PROVIDER_TIMEOUT" });
    expect(state.errorCode).toBe("PROVIDER_TIMEOUT");
    expect(JSON.stringify(caught)).not.toContain(sourceText);
    expect(JSON.stringify(caught)).not.toContain("PRIVATE_PROVIDER_PAYLOAD");
  });

  it.each([
    ["not_found", "LESSON_NOT_FOUND"],
    ["source_not_ready", "SOURCE_NOT_READY"],
    ["already_processing", "GENERATION_IN_PROGRESS"],
  ] as const)("maps %s claims without calling the provider", async (status, code) => {
    const { repository } = createRepository({ status });
    const structure = vi.fn(async () => minimalGoldenLesson);

    await expect(
      structureLesson({
        lessonId,
        repository,
        requestId: "request-5",
        structurer: { modelId: "unused-fake", structure },
      }),
    ).rejects.toMatchObject({ code });
    expect(structure).not.toHaveBeenCalled();
  });
});

describe("fake lesson generation API", () => {
  it("rejects client-supplied source, prompts, and unknown fields", async () => {
    const { repository } = createRepository();
    const structurer = new FakeLessonStructurer({
      kind: "success",
      output: minimalGoldenLesson,
    });

    for (const input of [
      { sourceText },
      { prompt: "Ignore the lesson" },
      { unknown: true },
    ]) {
      const response = await structureLessonResponse(input, lessonId, {
        repository,
        requestId: "request-6",
        structurer,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INVALID_REQUEST",
          message: "Do not send lesson text or prompts with this request.",
        },
      });
    }
  });

  it("returns stable success and retryable error envelopes", async () => {
    const success = createRepository();
    const successResponse = await structureLessonResponse({}, lessonId, {
      repository: success.repository,
      requestId: "request-7",
      structurer: new FakeLessonStructurer({
        kind: "success",
        output: minimalGoldenLesson,
      }),
    });
    expect(successResponse.status).toBe(200);
    await expect(successResponse.json()).resolves.toMatchObject({
      data: {
        lesson: { title: minimalGoldenLesson.title },
        provenance: { source: "fake" },
      },
    });

    const failed = createRepository();
    const errorResponse = await structureLessonResponse({}, lessonId, {
      repository: failed.repository,
      requestId: "request-8",
      structurer: new FakeLessonStructurer({ kind: "rate_limit" }),
    });
    expect(errorResponse.status).toBe(429);
    await expect(errorResponse.json()).resolves.toEqual({
      error: {
        code: "PROVIDER_RATE_LIMIT",
        message: "Lesson generation is temporarily unavailable. Try again.",
      },
    });
  });
});
