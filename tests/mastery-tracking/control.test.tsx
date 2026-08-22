import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasteryControl } from "@/components/review/mastery-control";
import type { MasteryStatus, ReviewItem } from "@/lib/contracts/mastery";

const reviewItem: ReviewItem = {
  id: "10000000-0000-4000-8000-000000000000",
  lessonId: "20000000-0000-4000-8000-000000000000",
  structuredItemId: "30000000-0000-4000-8000-000000000000",
  itemType: "vocabulary",
  status: "learning",
  lastReviewedAt: null,
  createdAt: "2026-08-22T09:00:00.000Z",
  updatedAt: "2026-08-22T09:00:00.000Z",
};

function savedItem(status: MasteryStatus): ReviewItem {
  return {
    ...reviewItem,
    status,
    lastReviewedAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

afterEach(cleanup);

describe("mastery control", () => {
  it("shows all three textual choices and supports native keyboard selection", () => {
    const saveStatus = vi.fn().mockResolvedValue(savedItem("known"));
    render(
      <MasteryControl
        item={reviewItem}
        itemLabel="bonjour"
        saveStatus={saveStatus}
      />,
    );

    const learning = screen.getByRole("radio", { name: "Not sure" });
    expect(screen.getByRole("group", { name: "Mastery for bonjour" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Know" })).toBeVisible();
    expect(learning).toBeChecked();
    expect(screen.getByRole("radio", { name: "Don't know" })).toBeVisible();

    learning.focus();
    fireEvent.keyDown(learning, { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("radio", { name: "Know" }));
    expect(saveStatus).toHaveBeenCalledWith(reviewItem.id, "known");
  });

  it("serializes rapid saves without allowing an older response to replace the latest choice", async () => {
    const first = deferred<ReviewItem>();
    const second = deferred<ReviewItem>();
    const saveStatus = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(
      <MasteryControl
        item={reviewItem}
        itemLabel="bonjour"
        saveStatus={saveStatus}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Don't know" }));
    fireEvent.click(screen.getByRole("radio", { name: "Know" }));
    expect(screen.getByRole("radio", { name: "Know" })).toBeChecked();
    expect(saveStatus).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(savedItem("weak")));
    expect(screen.getByRole("radio", { name: "Know" })).toBeChecked();
    expect(saveStatus).toHaveBeenNthCalledWith(2, reviewItem.id, "known");

    await act(async () => second.resolve(savedItem("known")));
    expect(screen.getByRole("radio", { name: "Know" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Saved as Know.");
  });

  it("rolls a failed latest choice back to the last saved status", async () => {
    const request = deferred<ReviewItem>();
    render(
      <MasteryControl
        item={reviewItem}
        itemLabel="bonjour"
        saveStatus={() => request.promise}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Don't know" }));
    expect(screen.getByRole("radio", { name: "Don't know" })).toBeChecked();
    await act(async () => request.reject(new Error("offline")));

    expect(screen.getByRole("radio", { name: "Not sure" })).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save. Your previous choice was restored.",
    );
  });
});
