import type { Lesson } from "@/lib/contracts/lesson";
import type { ReviewItem } from "@/lib/contracts/mastery";
import { structuredLessonSchema } from "@/lib/contracts/structured-lesson";

export type WeakReviewItem = {
  french: string;
  meaningEn: string;
  reviewItem: ReviewItem;
};

export type WeakReviewGroup = {
  lessonId: string;
  lessonTitle: string;
  items: WeakReviewItem[];
};

export function groupWeakItems(
  reviewItems: ReviewItem[],
  lessons: Lesson[],
): WeakReviewGroup[] {
  const lessonsById = new Map<string, Lesson>(
    lessons.map((lesson) => [lesson.id, lesson]),
  );
  const groups = new Map<string, WeakReviewGroup>();

  for (const reviewItem of reviewItems) {
    const lesson = lessonsById.get(reviewItem.lessonId);
    if (!lesson) continue;
    const structured = structuredLessonSchema.safeParse(lesson.parsedContent);
    if (!structured.success) continue;
    let french: string;
    let meaningEn: string;
    if (reviewItem.itemType === "vocabulary") {
      const source = structured.data.vocabulary.find(
        (item) => item.id === reviewItem.structuredItemId,
      );
      if (!source) continue;
      french = source.displayForm;
      meaningEn = source.meaningEn;
    } else {
      const source = structured.data.sentences.find(
        (item) => item.id === reviewItem.structuredItemId,
      );
      if (!source) continue;
      french = source.french;
      meaningEn = source.meaningEn;
    }

    const group = groups.get(lesson.id) ?? {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      items: [],
    };
    group.items.push({
      french,
      meaningEn,
      reviewItem,
    });
    groups.set(lesson.id, group);
  }

  return [...groups.values()];
}
