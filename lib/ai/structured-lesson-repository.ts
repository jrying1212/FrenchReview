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
  guard?: {
    storageKey: string;
    parseStatus: "processing";
  };
};

export interface StructuredLessonRepository {
  replace(input: PersistStructuredLessonInput): Promise<boolean>;
}

export type LessonSourceClaim =
  | { status: "claimed"; sourceText: string; storageKey: string }
  | { status: "not_found" | "source_not_ready" | "already_processing" };

export interface LessonStructureOrchestrationRepository
  extends StructuredLessonRepository {
  claim(lessonId: LessonId): Promise<LessonSourceClaim>;
  fail(
    lessonId: LessonId,
    expectedStorageKey: string,
    errorCode: string,
  ): Promise<boolean>;
}

type ReplaceStructuredLessonInput = {
  lessonId: LessonId;
  draft: unknown;
  provenance: unknown;
  repository: StructuredLessonRepository;
  generateId?: () => string;
  guard?: PersistStructuredLessonInput["guard"];
};

export async function replaceStructuredLesson({
  lessonId,
  draft,
  provenance: unknownProvenance,
  repository,
  generateId,
  guard,
}: ReplaceStructuredLessonInput): Promise<StructuredLesson | null> {
  const provenance = structuredLessonProvenanceSchema.parse(unknownProvenance);
  const lesson = assignStructuredItemIds(draft, generateId);
  const replaced = await repository.replace({
    lessonId,
    lesson,
    provenance,
    ...(guard ? { guard } : {}),
  });

  return replaced ? lesson : null;
}
