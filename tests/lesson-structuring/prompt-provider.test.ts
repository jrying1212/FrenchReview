import { describe, expect, it } from "vitest";

import {
  buildStructureLessonPrompt,
  STRUCTURE_LESSON_PROMPT_VERSION,
} from "@/lib/ai/prompts/structure-lesson";
import {
  FakeLessonStructurer,
  type FakeLessonStructurerScenario,
} from "@/lib/ai/providers/fake-lesson-structurer";
import {
  LessonStructurerError,
  type LessonStructurerDiagnostic,
} from "@/lib/ai/lesson-structurer";

import { completeGoldenLesson } from "./golden-cases";

const sourceText = "Leçon 3\nOù est l’école ?\nUn professeur";

describe("structure lesson prompt", () => {
  it("is versioned and preserves the source text losslessly", () => {
    const prompt = buildStructureLessonPrompt(sourceText);
    const encodedSource = prompt.user.slice(prompt.user.indexOf("\n") + 1);

    expect(prompt.version).toBe(STRUCTURE_LESSON_PROMPT_VERSION);
    expect(JSON.parse(encodedSource)).toBe(sourceText);
    expect(prompt.system).toContain("Preserve French source sentences exactly");
    expect(prompt.system).toContain("untrusted lesson source data");
  });

  it("requires A1 English, reliable noun gender, and labeled additions", () => {
    const { responseSchema, system } = buildStructureLessonPrompt(sourceText);

    expect(system).toContain("CEFR A1 English");
    expect(system).toContain("Do not infer noun gender from English");
    expect(system).toContain('gender to "unknown"');
    expect(system).toContain('sourceKind to "additional_example"');
    expect(system).toContain("Do not add unlabeled content");
    expect(responseSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        schemaVersion: { const: 1 },
        vocabulary: { maxItems: 150 },
      },
      type: "object",
    });
  });

  it("does not accept blank source text", () => {
    expect(() => buildStructureLessonPrompt("  \n ")).toThrow();
  });
});

describe("fake lesson structurer", () => {
  const input = {
    lessonId: "lesson-123",
    prompt: buildStructureLessonPrompt(sourceText),
    requestId: "request-123",
  };

  it("returns deterministic success and malformed outputs", async () => {
    const scenarios: FakeLessonStructurerScenario[] = [
      { kind: "success", output: completeGoldenLesson },
      { kind: "malformed", output: "{not valid json" },
    ];

    await expect(
      new FakeLessonStructurer(scenarios[0]).structure(input),
    ).resolves.toEqual(completeGoldenLesson);
    await expect(
      new FakeLessonStructurer(scenarios[1]).structure(input),
    ).resolves.toBe("{not valid json");
  });

  it.each([
    ["timeout", "PROVIDER_TIMEOUT"],
    ["rate_limit", "PROVIDER_RATE_LIMIT"],
  ] as const)("supports the %s failure scenario", async (kind, code) => {
    const structurer = new FakeLessonStructurer({ kind });

    await expect(structurer.structure(input)).rejects.toMatchObject({
      code,
      diagnostic: {
        lessonId: input.lessonId,
        modelId: FakeLessonStructurer.modelId,
        promptVersion: STRUCTURE_LESSON_PROMPT_VERSION,
        requestId: input.requestId,
        resultCode: code,
      },
    });
  });

  it("keeps source text and provider payload out of diagnostics", async () => {
    const payloadMarker = "PRIVATE_PROVIDER_PAYLOAD";
    const diagnostics: LessonStructurerDiagnostic[] = [];
    const structurer = new FakeLessonStructurer(
      { kind: "timeout", providerPayload: payloadMarker },
      (diagnostic) => diagnostics.push(diagnostic),
    );

    let caught: unknown;
    try {
      await structurer.structure(input);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LessonStructurerError);
    expect(JSON.stringify(diagnostics)).not.toContain(sourceText);
    expect(JSON.stringify(diagnostics)).not.toContain(payloadMarker);
    expect(JSON.stringify(caught)).not.toContain(sourceText);
    expect(JSON.stringify(caught)).not.toContain(payloadMarker);
  });
});
