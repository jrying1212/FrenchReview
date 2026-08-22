import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Quiz } from "@/components/quiz/quiz";
import type { QuizClient } from "@/lib/quiz/quiz-api";

const lessonId = "22222222-2222-4222-8222-222222222222";
const quiz: QuizClient = {
  id: "11111111-1111-4111-8111-111111111111",
  lessonId,
  sourceSchemaVersion: 1,
  createdAt: "2026-08-22T09:00:00.000Z",
  questions: Array.from({ length: 5 }, (_, index) => ({
    id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: "fr_to_en" as const,
    prompt: `Translate question ${index + 1}`,
    sourceItemIds: [
      `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    ],
  })),
};

afterEach(cleanup);

describe("quiz generation UI", () => {
  it("generates the first quiz from ready structured content", async () => {
    const generateQuiz = vi.fn(async () => quiz);
    render(
      <Quiz
        generateQuiz={generateQuiz}
        lessonId={lessonId}
        quiz={null}
        structuredReviewReady
      />,
    );
    const region = screen.getByRole("region", { name: "Lesson quiz" });

    fireEvent.click(within(region).getByRole("button", { name: "Generate quiz" }));

    expect(await within(region).findByText("Question 1 of 5")).toBeVisible();
    expect(generateQuiz).toHaveBeenCalledWith(false);
  });

  it("requires explicit confirmation before replacing an existing quiz", async () => {
    const replacement = { ...quiz, id: "55555555-5555-4555-8555-555555555555" };
    const generateQuiz = vi.fn(async () => replacement);
    render(
      <Quiz
        generateQuiz={generateQuiz}
        lessonId={lessonId}
        quiz={quiz}
        structuredReviewReady
      />,
    );
    const region = screen.getByRole("region", { name: "Lesson quiz" });

    fireEvent.click(
      within(region).getByRole("button", { name: "Generate a new quiz" }),
    );
    expect(generateQuiz).not.toHaveBeenCalled();
    fireEvent.click(
      within(region).getByRole("button", { name: "Replace current quiz" }),
    );

    expect(await within(region).findByText("Question 1 of 5")).toBeVisible();
    expect(generateQuiz).toHaveBeenCalledWith(true);
  });

  it("does not offer generation before structured content is ready", () => {
    render(<Quiz lessonId={lessonId} quiz={null} structuredReviewReady={false} />);

    expect(screen.queryByRole("button", { name: "Generate quiz" })).toBeNull();
    expect(screen.getByText("Import or generate a structured review first.")).toBeVisible();
  });
});
