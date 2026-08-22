import { z } from "zod";

import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import {
  structuredContentSourceSchema,
  type LessonId,
} from "@/lib/contracts/lesson";
import type { StructuredLesson } from "@/lib/contracts/structured-lesson";

const structuredLessonProvenanceSchema = z.strictObject({
  source: structuredContentSourceSchema,
  promptVersion: z.string().min(1).refine((value) => value.trim().length > 0),
  modelId: z.string().min(1).refine((value) => value.trim().length > 0),
});

export type StructuredLessonProvenance = z.infer<
  typeof structuredLessonProvenanceSchema
>;

export type PersistStructuredLessonInput = {
  lessonId: LessonId;
  lesson: StructuredLesson;
  provenance: StructuredLessonProvenance;
};

export interface StructuredLessonRepository {
  replace(input: PersistStructuredLessonInput): Promise<boolean>;
}

type ReplaceStructuredLessonInput = {
  lessonId: LessonId;
  draft: unknown;
  provenance: unknown;
  repository: StructuredLessonRepository;
  generateId?: () => string;
};

export async function replaceStructuredLesson({
  lessonId,
  draft,
  provenance: unknownProvenance,
  repository,
  generateId,
}: ReplaceStructuredLessonInput): Promise<StructuredLesson | null> {
  const provenance = structuredLessonProvenanceSchema.parse(unknownProvenance);
  const lesson = assignStructuredItemIds(draft, generateId);
  const replaced = await repository.replace({ lessonId, lesson, provenance });

  return replaced ? lesson : null;
}
