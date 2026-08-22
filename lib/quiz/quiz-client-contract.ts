import { z } from "zod";

const commonQuestionFields = {
  id: z.uuid(),
  prompt: z.string().min(1),
  sourceItemIds: z.array(z.uuid()).min(1),
};

const choiceQuestionSchema = (type: "multiple_choice" | "article_blank") =>
  z.strictObject({
    ...commonQuestionFields,
    type: z.literal(type),
    options: z
      .array(z.strictObject({ id: z.uuid(), text: z.string().min(1) }))
      .min(2)
      .max(6),
  });

const translationQuestionSchema = (type: "fr_to_en" | "en_to_fr") =>
  z.strictObject({ ...commonQuestionFields, type: z.literal(type) });

const orderingQuestionSchema = z.strictObject({
  ...commonQuestionFields,
  type: z.literal("sentence_ordering"),
  tokens: z
    .array(z.strictObject({ id: z.uuid(), text: z.string().min(1) }))
    .min(2)
    .max(20),
});

export const quizClientSchema = z.strictObject({
  id: z.uuid(),
  lessonId: z.uuid(),
  sourceSchemaVersion: z.number().int().positive(),
  questions: z
    .array(
      z.discriminatedUnion("type", [
        choiceQuestionSchema("multiple_choice"),
        choiceQuestionSchema("article_blank"),
        translationQuestionSchema("fr_to_en"),
        translationQuestionSchema("en_to_fr"),
        orderingQuestionSchema,
      ]),
    )
    .min(5)
    .max(10),
  createdAt: z.iso.datetime(),
});

export type QuizClient = z.infer<typeof quizClientSchema>;
export type QuizClientQuestion = QuizClient["questions"][number];
