import { describe, expect, it } from "vitest";

import {
  masteryLabels,
  reviewItemSchema,
  updateMasterySchema,
} from "@/lib/contracts/mastery";

describe("mastery contracts", () => {
  it("accepts the three approved statuses with exhaustive labels", () => {
    expect(masteryLabels).toEqual({
      known: "Know",
      learning: "Not sure",
      weak: "Don't know",
    });
    expect(updateMasterySchema.parse({ status: "learning" })).toEqual({
      status: "learning",
    });
  });

  it("rejects unknown mutation fields and invalid states", () => {
    expect(updateMasterySchema.safeParse({ status: "new" }).success).toBe(false);
    expect(
      updateMasterySchema.safeParse({ status: "known", lessonId: "private" })
        .success,
    ).toBe(false);
  });

  it("requires server timestamps and nullable initial review time", () => {
    expect(
      reviewItemSchema.parse({
        id: "10000000-0000-4000-8000-000000000000",
        lessonId: "20000000-0000-4000-8000-000000000000",
        structuredItemId: "30000000-0000-4000-8000-000000000000",
        itemType: "vocabulary",
        status: "learning",
        lastReviewedAt: null,
        createdAt: "2026-08-22T09:00:00.000Z",
        updatedAt: "2026-08-22T09:00:00.000Z",
      }).status,
    ).toBe("learning");
  });
});
