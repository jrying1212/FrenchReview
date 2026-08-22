import { describe, expect, it } from "vitest";

import {
  generatedQuizDraftSchema,
  quizSchema,
} from "@/lib/contracts/quiz";

const ids = {
  quiz: "10000000-0000-4000-8000-000000000000",
  lesson: "20000000-0000-4000-8000-000000000000",
  source: "30000000-0000-4000-8000-000000000000",
  questions: [
    "40000000-0000-4000-8000-000000000001",
    "40000000-0000-4000-8000-000000000002",
    "40000000-0000-4000-8000-000000000003",
    "40000000-0000-4000-8000-000000000004",
    "40000000-0000-4000-8000-000000000005",
  ],
  options: [
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000002",
    "50000000-0000-4000-8000-000000000003",
  ],
  tokens: [
    "60000000-0000-4000-8000-000000000001",
    "60000000-0000-4000-8000-000000000002",
    "60000000-0000-4000-8000-000000000003",
  ],
};

function completeDraft() {
  return {
    questions: [
      {
        id: ids.questions[0],
        type: "multiple_choice",
        prompt: "What does « bonjour » mean?",
        explanationEn: "Bonjour means hello.",
        sourceItemIds: [ids.source],
        options: [
          { id: ids.options[0], text: "Hello" },
          { id: ids.options[1], text: "Goodbye" },
        ],
        correctOptionId: ids.options[0],
      },
      {
        id: ids.questions[1],
        type: "article_blank",
        prompt: "Choose the article: ___ école",
        explanationEn: "École uses the elided definite article l'.",
        sourceItemIds: [ids.source],
        options: [
          { id: ids.options[0], text: "l'" },
          { id: ids.options[1], text: "le" },
          { id: ids.options[2], text: "la" },
        ],
        correctOptionId: ids.options[0],
      },
      {
        id: ids.questions[2],
        type: "fr_to_en",
        prompt: "Translate: Bonjour",
        explanationEn: "Bonjour is a greeting.",
        sourceItemIds: [ids.source],
        acceptedAnswers: ["hello", "good morning"],
        referenceAnswer: "Hello",
      },
      {
        id: ids.questions[3],
        type: "en_to_fr",
        prompt: "Translate: Hello",
        explanationEn: "Use bonjour as the greeting.",
        sourceItemIds: [ids.source],
        acceptedAnswers: ["bonjour"],
        referenceAnswer: "Bonjour",
      },
      {
        id: ids.questions[4],
        type: "sentence_ordering",
        prompt: "Put the sentence in order.",
        explanationEn: "French uses subject, verb, then complement here.",
        sourceItemIds: [ids.source],
        tokens: [
          { id: ids.tokens[1], text: "m'appelle" },
          { id: ids.tokens[2], text: "Boris" },
          { id: ids.tokens[0], text: "Je" },
        ],
        correctTokenIds: ids.tokens,
      },
    ],
  };
}

describe("quiz schema", () => {
  it("accepts all five supported question variants", () => {
    const draft = generatedQuizDraftSchema.parse(completeDraft());
    const quiz = quizSchema.parse({
      ...draft,
      id: ids.quiz,
      lessonId: ids.lesson,
      sourceSchemaVersion: 1,
      createdAt: "2026-08-22T08:00:00.000Z",
    });

    expect(quiz.questions.map((question) => question.type)).toEqual([
      "multiple_choice",
      "article_blank",
      "fr_to_en",
      "en_to_fr",
      "sentence_ordering",
    ]);
  });

  it("requires between five and ten questions", () => {
    const draft = completeDraft();

    expect(() =>
      generatedQuizDraftSchema.parse({ questions: draft.questions.slice(0, 4) }),
    ).toThrow();
    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [...draft.questions, ...draft.questions, draft.questions[0]],
      }),
    ).toThrow();
  });

  it("rejects duplicate question IDs and source IDs", () => {
    const draft = completeDraft();

    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          draft.questions[0],
          { ...draft.questions[1], id: ids.questions[0] },
          ...draft.questions.slice(2),
        ],
      }),
    ).toThrow();
    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          {
            ...draft.questions[0],
            sourceItemIds: [ids.source, ids.source],
          },
          ...draft.questions.slice(1),
        ],
      }),
    ).toThrow();
  });

  it("rejects ambiguous choices and invalid answer keys", () => {
    const draft = completeDraft();
    const choice = draft.questions[0];

    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          {
            ...choice,
            options: [
              { id: ids.options[0], text: "École" },
              { id: ids.options[1], text: "  ÉCOLE  " },
            ],
          },
          ...draft.questions.slice(1),
        ],
      }),
    ).toThrow();
    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          { ...choice, correctOptionId: ids.options[2] },
          ...draft.questions.slice(1),
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate translation answers after safe normalization", () => {
    const draft = completeDraft();

    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          ...draft.questions.slice(0, 2),
          {
            ...draft.questions[2],
            acceptedAnswers: ["très bien", "  TRE\u0300S   BIEN  "],
          },
          ...draft.questions.slice(3),
        ],
      }),
    ).toThrow();
  });

  it("requires an exact ordering-token permutation", () => {
    const draft = completeDraft();

    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          ...draft.questions.slice(0, 4),
          {
            ...draft.questions[4],
            correctTokenIds: [ids.tokens[0], ids.tokens[1]],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects unknown fields in every question variant", () => {
    const draft = completeDraft();

    expect(() =>
      generatedQuizDraftSchema.parse({
        questions: [
          { ...draft.questions[0], leakedHint: "hello" },
          ...draft.questions.slice(1),
        ],
      }),
    ).toThrow();
  });
});
