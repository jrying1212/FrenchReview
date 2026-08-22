import { z } from "zod";

declare const lessonIdBrand: unique symbol;

export type LessonId = string & { readonly [lessonIdBrand]: true };

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const importStatusSchema = z.enum([
  "empty",
  "extracting",
  "ready",
  "failed",
]);

export const parseStatusSchema = z.enum([
  "not_started",
  "processing",
  "ready",
  "failed",
]);

export const lessonIdSchema = z.uuid().transform((id) => id as LessonId);

const lessonTitleSchema = z.string().trim().min(1).max(120);

export const createLessonSchema = z
  .object({
    title: lessonTitleSchema,
    lessonDate: z.date().nullable().default(null),
  })
  .strict();

export const updateLessonSchema = z
  .object({
    title: lessonTitleSchema.optional(),
    lessonDate: z.date().nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one lesson field is required.",
  });

export type ImportStatus = z.infer<typeof importStatusSchema>;
export type ParseStatus = z.infer<typeof parseStatusSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export type Lesson = {
  id: LessonId;
  title: string;
  lessonDate: Date | null;
  pdfStorageKey: string | null;
  pdfOriginalName: string | null;
  rawText: string | null;
  parsedContent: JsonValue | null;
  importStatus: ImportStatus;
  parseStatus: ParseStatus;
  parseErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};
