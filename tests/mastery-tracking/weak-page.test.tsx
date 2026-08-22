import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WeakItemList } from "@/components/review/weak-item-list";
import { lessonIdSchema, type Lesson } from "@/lib/contracts/lesson";
import type { ReviewItem } from "@/lib/contracts/mastery";
import { groupWeakItems } from "@/lib/mastery/list-weak-items";

const lessonId = lessonIdSchema.parse("20000000-0000-4000-8000-000000000000");
const structuredItemId = "30000000-0000-4000-8000-000000000000";
const reviewItem: ReviewItem = {
  id: "10000000-0000-4000-8000-000000000000",
  lessonId,
  structuredItemId,
  itemType: "vocabulary",
  status: "weak",
  lastReviewedAt: null,
  createdAt: "2026-08-22T09:00:00.000Z",
  updatedAt: "2026-08-22T09:00:00.000Z",
};
const lesson: Lesson = {
  id: lessonId,
  title: "Greetings",
  lessonDate: null,
  pdfStorageKey: null,
  pdfOriginalName: null,
  rawText: null,
  parsedContent: {
    schemaVersion: 1,
    title: "Greetings",
    summary: "Greetings.",
    keyPoints: [], grammar: [], pronunciationFocus: [], sentences: [],
    vocabulary: [{
      id: structuredItemId, french: "bonjour", displayForm: "bonjour",
      meaningEn: "hello", partOfSpeech: "expression", gender: null,
      definiteArticle: null, indefiniteArticle: null, exampleFrench: null,
      exampleMeaningEn: null, sourceKind: "source",
    }],
  },
  importStatus: "ready", parseStatus: "ready", parseErrorCode: null,
  structuredContentSource: "manual", structuredSchemaVersion: 1,
  structuredPromptVersion: null, structuredModelId: null,
  createdAt: new Date(), updatedAt: new Date(),
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("weak review page", () => {
  it("preserves repository order while grouping and resolving French-first content", () => {
    const groups = groupWeakItems([reviewItem], [lesson]);
    expect(groups).toMatchObject([{ lessonTitle: "Greetings", items: [{ french: "bonjour", meaningEn: "hello" }] }]);
  });

  it("keeps TTS and mastery controls, then shows the empty state when all are known", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { item: { ...reviewItem, status: "known", lastReviewedAt: "2026-08-22T10:00:00.000Z", updatedAt: "2026-08-22T10:00:00.000Z" } },
    }), { status: 200 })));
    render(<WeakItemList groups={groupWeakItems([reviewItem], [lesson])} />);

    expect(screen.getByText("bonjour")).toBeVisible();
    expect(screen.getByText("hello")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hear bonjour in French" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Know" }));

    await waitFor(() => expect(screen.getByText("Nothing needs extra review.")).toBeVisible());
    expect(screen.getByRole("link", { name: "Return to lessons" })).toHaveAttribute("href", "/");
  });
});
