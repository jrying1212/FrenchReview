import { z } from "zod";

const sourceKindSchema = z.enum(["source", "additional_example"]);
const genderSchema = z.enum(["masculine", "feminine", "unknown"]).nullable();
const definiteArticleSchema = z.enum(["le", "la", "l'", "les"]).nullable();
const indefiniteArticleSchema = z.enum(["un", "une", "des"]).nullable();

const nonBlankString = (maximum?: number) => {
  const schema = maximum ? z.string().min(1).max(maximum) : z.string().min(1);
  return schema.refine((value) => value.trim().length > 0, {
    message: "Value must contain non-whitespace characters.",
  });
};

const vocabularyFields = {
  french: nonBlankString(),
  meaningEn: nonBlankString(),
  partOfSpeech: z.enum([
    "noun",
    "verb",
    "adjective",
    "adverb",
    "pronoun",
    "preposition",
    "conjunction",
    "expression",
    "other",
  ]),
  gender: genderSchema,
  definiteArticle: definiteArticleSchema,
  indefiniteArticle: indefiniteArticleSchema,
  displayForm: nonBlankString(),
  exampleFrench: nonBlankString().nullable(),
  exampleMeaningEn: nonBlankString().nullable(),
  sourceKind: sourceKindSchema,
};

type VocabularyInvariantInput = {
  partOfSpeech: z.infer<typeof vocabularyFields.partOfSpeech>;
  gender: z.infer<typeof genderSchema>;
  definiteArticle: z.infer<typeof definiteArticleSchema>;
  indefiniteArticle: z.infer<typeof indefiniteArticleSchema>;
};

function hasValidGenderAndArticles(item: VocabularyInvariantInput) {
  if (item.partOfSpeech !== "noun") {
    return (
      item.gender === null &&
      item.definiteArticle === null &&
      item.indefiniteArticle === null
    );
  }

  if (item.gender === null) {
    return false;
  }

  if (item.gender === "masculine") {
    return item.definiteArticle !== "la" && item.indefiniteArticle !== "une";
  }

  if (item.gender === "feminine") {
    return item.definiteArticle !== "le" && item.indefiniteArticle !== "un";
  }

  return (
    item.definiteArticle !== "le" &&
    item.definiteArticle !== "la" &&
    item.indefiniteArticle !== "un" &&
    item.indefiniteArticle !== "une"
  );
}

const vocabularyDraftSchema = z
  .strictObject(vocabularyFields)
  .refine(hasValidGenderAndArticles, {
    message: "Gender and articles must be consistent with the part of speech.",
  });

const vocabularyItemSchema = z
  .strictObject({ id: z.uuid(), ...vocabularyFields })
  .refine(hasValidGenderAndArticles, {
    message: "Gender and articles must be consistent with the part of speech.",
  });

const sentenceFields = {
  french: nonBlankString(),
  meaningEn: nonBlankString(),
  noteEn: nonBlankString().nullable(),
  sourceKind: sourceKindSchema,
};

const grammarExampleSchema = z.strictObject({
  french: nonBlankString(),
  meaningEn: nonBlankString().nullable(),
  sourceKind: sourceKindSchema,
});

const grammarFields = {
  topic: nonBlankString(),
  explanationEn: nonBlankString(),
  examples: z.array(grammarExampleSchema),
};

const pronunciationFields = {
  text: nonBlankString(),
  noteEn: nonBlankString(),
  sourceKind: sourceKindSchema,
};

const lessonFields = {
  schemaVersion: z.literal(1),
  title: nonBlankString(120),
  summary: nonBlankString(800),
  keyPoints: z.array(nonBlankString(300)).max(20).default(() => []),
};

export const structuredLessonDraftSchema = z.strictObject({
  ...lessonFields,
  vocabulary: z.array(vocabularyDraftSchema).max(150).default(() => []),
  sentences: z
    .array(z.strictObject(sentenceFields))
    .max(100)
    .default(() => []),
  grammar: z
    .array(z.strictObject(grammarFields))
    .max(30)
    .default(() => []),
  pronunciationFocus: z
    .array(z.strictObject(pronunciationFields))
    .max(50)
    .default(() => []),
});

export const structuredLessonSchema = z.strictObject({
  ...lessonFields,
  vocabulary: z.array(vocabularyItemSchema).max(150).default(() => []),
  sentences: z
    .array(z.strictObject({ id: z.uuid(), ...sentenceFields }))
    .max(100)
    .default(() => []),
  grammar: z
    .array(z.strictObject({ id: z.uuid(), ...grammarFields }))
    .max(30)
    .default(() => []),
  pronunciationFocus: z
    .array(z.strictObject({ id: z.uuid(), ...pronunciationFields }))
    .max(50)
    .default(() => []),
});

export type StructuredLessonDraft = z.infer<typeof structuredLessonDraftSchema>;
export type StructuredLesson = z.infer<typeof structuredLessonSchema>;
