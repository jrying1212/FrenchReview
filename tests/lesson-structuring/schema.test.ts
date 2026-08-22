import { describe, expect, it } from "vitest";

import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import {
  structuredLessonDraftSchema,
  structuredLessonSchema,
} from "@/lib/contracts/structured-lesson";

import { completeGoldenLesson, minimalGoldenLesson } from "./golden-cases";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
];

describe("structured lesson schema", () => {
  it("accepts every approved category and preserves French diacritics", () => {
    const lesson = structuredLessonDraftSchema.parse(completeGoldenLesson);

    expect(lesson.vocabulary[1].displayForm).toBe("l’école");
    expect(lesson.sentences[0].french).toBe("Où est l’école ?");
    expect(lesson.grammar[0].examples[1].sourceKind).toBe(
      "additional_example",
    );
  });

  it("defaults all optional content categories to empty arrays", () => {
    expect(structuredLessonDraftSchema.parse(minimalGoldenLesson)).toEqual({
      ...minimalGoldenLesson,
      grammar: [],
      keyPoints: [],
      pronunciationFocus: [],
      sentences: [],
      vocabulary: [],
    });
  });

  it("enforces every approved top-level size limit", () => {
    const base = structuredLessonDraftSchema.parse(minimalGoldenLesson);
    const validVocabulary = completeGoldenLesson.vocabulary[0];
    const validSentence = completeGoldenLesson.sentences[0];
    const validGrammar = completeGoldenLesson.grammar[0];
    const validPronunciation = completeGoldenLesson.pronunciationFocus[0];

    expect(() => structuredLessonDraftSchema.parse({ ...base, title: "a".repeat(121) })).toThrow();
    expect(() => structuredLessonDraftSchema.parse({ ...base, summary: "a".repeat(801) })).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        vocabulary: Array.from({ length: 151 }, () => validVocabulary),
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        sentences: Array.from({ length: 101 }, () => validSentence),
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        grammar: Array.from({ length: 31 }, () => validGrammar),
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        pronunciationFocus: Array.from(
          { length: 51 },
          () => validPronunciation,
        ),
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        keyPoints: Array.from({ length: 21 }, () => "Point"),
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...base,
        keyPoints: ["a".repeat(301)],
      }),
    ).toThrow();
  });

  it("rejects noun and non-noun gender/article contradictions", () => {
    const noun = completeGoldenLesson.vocabulary[0];
    const nonNoun = completeGoldenLesson.vocabulary[3];

    const invalidItems = [
      { ...noun, gender: null },
      { ...noun, definiteArticle: "la" },
      { ...noun, indefiniteArticle: "une" },
      { ...noun, gender: "unknown", definiteArticle: "le" },
      { ...noun, gender: "unknown", indefiniteArticle: "un" },
      { ...nonNoun, gender: "feminine" },
      { ...nonNoun, definiteArticle: "le" },
      { ...nonNoun, indefiniteArticle: "un" },
    ];

    for (const item of invalidItems) {
      expect(() =>
        structuredLessonDraftSchema.parse({
          ...minimalGoldenLesson,
          vocabulary: [item],
        }),
      ).toThrow();
    }
  });

  it("rejects unknown fields, provider IDs, and unlabeled examples", () => {
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...minimalGoldenLesson,
        inventedCategory: [],
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...minimalGoldenLesson,
        vocabulary: [{ ...completeGoldenLesson.vocabulary[0], id: ids[0] }],
      }),
    ).toThrow();
    expect(() =>
      structuredLessonDraftSchema.parse({
        ...minimalGoldenLesson,
        grammar: [
          {
            ...completeGoldenLesson.grammar[0],
            examples: [
              {
                french: "Elle est ici.",
                meaningEn: "She is here.",
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("assigns application UUIDs in stable category order after validation", () => {
    let index = 0;
    const lesson = assignStructuredItemIds(completeGoldenLesson, () => ids[index++]);

    expect(lesson.vocabulary.map((item) => item.id)).toEqual(ids.slice(0, 4));
    expect(lesson.sentences[0].id).toBe(ids[4]);
    expect(lesson.grammar[0].id).toBe(ids[5]);
    expect(lesson.pronunciationFocus[0].id).toBe(ids[6]);
    expect(structuredLessonSchema.parse(lesson)).toEqual(lesson);
  });

  it("never assigns IDs to invalid provider output", () => {
    let calls = 0;

    expect(() =>
      assignStructuredItemIds(
        { ...minimalGoldenLesson, unknown: true },
        () => {
          calls += 1;
          return ids[0];
        },
      ),
    ).toThrow();
    expect(calls).toBe(0);
  });
});
