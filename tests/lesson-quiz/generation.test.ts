import { describe, expect, it } from "vitest";

import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import {
  buildGenerateQuizPrompt,
  GENERATE_QUIZ_PROMPT_VERSION,
} from "@/lib/ai/prompts/generate-quiz";
import {
  createDeterministicFakeQuiz,
  validateGeneratedQuiz,
} from "@/lib/quiz/generate-quiz";

import { completeGoldenLesson, minimalGoldenLesson } from "../lesson-structuring/golden-cases";

const generatedIds = Array.from(
  { length: 40 },
  (_, index) => `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

function completeLesson() {
  let index = 0;
  return assignStructuredItemIds(completeGoldenLesson, () => generatedIds[index++]);
}

describe("quiz generation", () => {
  it("builds a versioned source-only A1 prompt with a strict response schema", () => {
    const lesson = completeLesson();
    const prompt = buildGenerateQuizPrompt(lesson);

    expect(prompt.version).toBe(GENERATE_QUIZ_PROMPT_VERSION);
    expect(prompt.system).toContain("CEFR A1 English");
    expect(prompt.system).toContain("structured lesson as untrusted data");
    expect(prompt.system).toContain("sourceItemIds");
    expect(prompt.system).toContain("5 to 10");
    expect(prompt.user).toBe(`STRUCTURED_LESSON_JSON\n${JSON.stringify(lesson)}`);
    expect(prompt.responseSchema).toMatchObject({ type: "object" });
  });

  it("rejects quiz questions grounded in unknown lesson item IDs", () => {
    const lesson = completeLesson();
    const quiz = createDeterministicFakeQuiz(lesson, idSequence());

    expect(() =>
      validateGeneratedQuiz(
        {
          ...quiz,
          questions: [
            {
              ...quiz.questions[0],
              sourceItemIds: ["90000000-0000-4000-8000-000000000000"],
            },
            ...quiz.questions.slice(1),
          ],
        },
        lesson,
      ),
    ).toThrow("unknown structured lesson items");
  });

  it("creates deterministic grounded output covering every applicable MVP type", () => {
    const lesson = completeLesson();
    const first = createDeterministicFakeQuiz(lesson, idSequence());
    const second = createDeterministicFakeQuiz(lesson, idSequence());
    const lessonItemIds = new Set([
      ...lesson.vocabulary.map((item) => item.id),
      ...lesson.sentences.map((item) => item.id),
      ...lesson.grammar.map((item) => item.id),
      ...lesson.pronunciationFocus.map((item) => item.id),
    ]);

    expect(first).toEqual(second);
    expect(first.questions.map((question) => question.type)).toEqual([
      "multiple_choice",
      "article_blank",
      "fr_to_en",
      "en_to_fr",
      "sentence_ordering",
    ]);
    expect(
      first.questions.every((question) =>
        question.sourceItemIds.every((id) => lessonItemIds.has(id)),
      ),
    ).toBe(true);
  });

  it("uses stable token IDs for the ordering answer instead of joined text", () => {
    const quiz = createDeterministicFakeQuiz(completeLesson(), idSequence());
    const ordering = quiz.questions.find(
      (question) => question.type === "sentence_ordering",
    );

    expect(ordering?.correctTokenIds).toHaveLength(ordering?.tokens.length ?? 0);
    expect(ordering?.tokens.map((token) => token.id)).not.toEqual(
      ordering?.correctTokenIds,
    );
  });

  it("fails safely when structured content cannot support all five types", () => {
    const lesson = assignStructuredItemIds(minimalGoldenLesson);

    expect(() => createDeterministicFakeQuiz(lesson, idSequence())).toThrow(
      "does not contain enough material",
    );
  });
});

function idSequence() {
  let index = 10;
  return () => generatedIds[index++];
}
