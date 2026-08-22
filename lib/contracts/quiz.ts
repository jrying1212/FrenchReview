import { z } from "zod";

const nonBlankString = z.string().min(1).refine((value) => value.trim().length > 0, {
  message: "Value must contain non-whitespace characters.",
});

function normalizedComparable(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr");
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}

const sourceItemIdsSchema = z
  .array(z.uuid())
  .min(1)
  .refine(hasUniqueValues, { message: "Source item IDs must be unique." });

const commonQuestionFields = {
  id: z.uuid(),
  prompt: nonBlankString,
  explanationEn: nonBlankString,
  sourceItemIds: sourceItemIdsSchema,
};

const optionSchema = z.strictObject({
  id: z.uuid(),
  text: nonBlankString,
});

const choiceFields = {
  ...commonQuestionFields,
  options: z.array(optionSchema).min(2).max(6),
  correctOptionId: z.uuid(),
};

function hasValidChoiceOptions(question: {
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
}) {
  const optionIds = question.options.map((option) => option.id);
  const optionTexts = question.options.map((option) =>
    normalizedComparable(option.text),
  );

  return (
    hasUniqueValues(optionIds) &&
    hasUniqueValues(optionTexts) &&
    optionIds.includes(question.correctOptionId)
  );
}

const multipleChoiceQuestionSchema = z
  .strictObject({ type: z.literal("multiple_choice"), ...choiceFields })
  .refine(hasValidChoiceOptions, {
    message: "Choice IDs and text must be unique and include the answer key.",
  });

const articleBlankQuestionSchema = z
  .strictObject({ type: z.literal("article_blank"), ...choiceFields })
  .refine(hasValidChoiceOptions, {
    message: "Choice IDs and text must be unique and include the answer key.",
  });

const translationFields = {
  ...commonQuestionFields,
  acceptedAnswers: z
    .array(nonBlankString)
    .min(1)
    .max(5)
    .refine(
      (answers) =>
        hasUniqueValues(answers.map((answer) => normalizedComparable(answer))),
      { message: "Accepted answers must be unique." },
    ),
  referenceAnswer: nonBlankString,
};

const frenchToEnglishQuestionSchema = z.strictObject({
  type: z.literal("fr_to_en"),
  ...translationFields,
});

const englishToFrenchQuestionSchema = z.strictObject({
  type: z.literal("en_to_fr"),
  ...translationFields,
});

const orderingTokenSchema = z.strictObject({
  id: z.uuid(),
  text: nonBlankString,
});

const sentenceOrderingQuestionSchema = z
  .strictObject({
    type: z.literal("sentence_ordering"),
    ...commonQuestionFields,
    tokens: z.array(orderingTokenSchema).min(2).max(20),
    correctTokenIds: z.array(z.uuid()).min(2).max(20),
  })
  .refine(
    (question) => {
      const tokenIds = question.tokens.map((token) => token.id);
      return (
        hasUniqueValues(tokenIds) &&
        hasUniqueValues(question.correctTokenIds) &&
        tokenIds.length === question.correctTokenIds.length &&
        tokenIds.every((id) => question.correctTokenIds.includes(id))
      );
    },
    { message: "The answer must be an exact permutation of unique token IDs." },
  );

export const quizQuestionSchema = z.discriminatedUnion("type", [
  multipleChoiceQuestionSchema,
  articleBlankQuestionSchema,
  frenchToEnglishQuestionSchema,
  englishToFrenchQuestionSchema,
  sentenceOrderingQuestionSchema,
]);

const quizQuestionsSchema = z
  .array(quizQuestionSchema)
  .min(5)
  .max(10)
  .refine(
    (questions) => hasUniqueValues(questions.map((question) => question.id)),
    { message: "Question IDs must be unique." },
  );

export const generatedQuizDraftSchema = z.strictObject({
  questions: quizQuestionsSchema,
});

export const quizSchema = z.strictObject({
  id: z.uuid(),
  lessonId: z.uuid(),
  sourceSchemaVersion: z.number().int().positive(),
  questions: quizQuestionsSchema,
  createdAt: z.iso.datetime(),
});

const submittedChoiceAnswerSchema = (type: "multiple_choice" | "article_blank") =>
  z.strictObject({
    questionId: z.uuid(),
    type: z.literal(type),
    optionId: z.uuid(),
  });

const submittedTranslationAnswerSchema = (type: "fr_to_en" | "en_to_fr") =>
  z.strictObject({
    questionId: z.uuid(),
    type: z.literal(type),
    text: z.string().max(1_000),
  });

const submittedOrderingAnswerSchema = z.strictObject({
  questionId: z.uuid(),
  type: z.literal("sentence_ordering"),
  tokenIds: z
    .array(z.uuid())
    .min(2)
    .max(20)
    .refine(hasUniqueValues, { message: "Submitted token IDs must be unique." }),
});

export const quizSubmittedAnswerSchema = z.discriminatedUnion("type", [
  submittedChoiceAnswerSchema("multiple_choice"),
  submittedChoiceAnswerSchema("article_blank"),
  submittedTranslationAnswerSchema("fr_to_en"),
  submittedTranslationAnswerSchema("en_to_fr"),
  submittedOrderingAnswerSchema,
]);

export const quizSubmissionSchema = z.strictObject({
  submissionId: z.uuid(),
  quizId: z.uuid(),
  answers: z
    .array(quizSubmittedAnswerSchema)
    .min(1)
    .max(10)
    .refine(
      (answers) =>
        hasUniqueValues(answers.map((answer) => answer.questionId)),
      { message: "Each question may be answered only once." },
    ),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type GeneratedQuizDraft = z.infer<typeof generatedQuizDraftSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type QuizSubmittedAnswer = z.infer<typeof quizSubmittedAnswerSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
