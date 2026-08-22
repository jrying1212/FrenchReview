import { randomUUID } from "node:crypto";

import {
  structuredLessonDraftSchema,
  structuredLessonSchema,
  type StructuredLesson,
} from "@/lib/contracts/structured-lesson";

export function assignStructuredItemIds(
  input: unknown,
  generateId: () => string = randomUUID,
): StructuredLesson {
  const draft = structuredLessonDraftSchema.parse(input);

  return structuredLessonSchema.parse({
    ...draft,
    vocabulary: draft.vocabulary.map((item) => ({
      id: generateId(),
      ...item,
    })),
    sentences: draft.sentences.map((item) => ({
      id: generateId(),
      ...item,
    })),
    grammar: draft.grammar.map((item) => ({
      id: generateId(),
      ...item,
    })),
    pronunciationFocus: draft.pronunciationFocus.map((item) => ({
      id: generateId(),
      ...item,
    })),
  });
}
