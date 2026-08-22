import { z } from "zod";

export const masteryStatusSchema = z.enum(["known", "learning", "weak"]);
export const reviewItemTypeSchema = z.enum(["vocabulary", "sentence"]);

export const updateMasterySchema = z.strictObject({
  status: masteryStatusSchema,
});

export const reviewItemSchema = z.strictObject({
  id: z.uuid(),
  lessonId: z.uuid(),
  structuredItemId: z.uuid(),
  itemType: reviewItemTypeSchema,
  status: masteryStatusSchema,
  lastReviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MasteryStatus = z.infer<typeof masteryStatusSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const masteryLabels: Record<MasteryStatus, string> = {
  known: "Know",
  learning: "Not sure",
  weak: "Don't know",
};
