import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Quiz } from "@/components/quiz/quiz";
import type { QuizClient } from "@/lib/quiz/quiz-api";

const quiz: QuizClient = {
  id: "11111111-1111-4111-8111-111111111111",
  lessonId: "22222222-2222-4222-8222-222222222222",
  sourceSchemaVersion: 1,
  createdAt: "2026-08-22T09:00:00.000Z",
  questions: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      type: "multiple_choice",
      prompt: "What does « bonjour » mean?",
      sourceItemIds: ["40000000-0000-4000-8000-000000000001"],
      options: [
        { id: "50000000-0000-4000-8000-000000000001", text: "Hello" },
        { id: "50000000-0000-4000-8000-000000000002", text: "Goodbye" },
      ],
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      type: "article_blank",
      prompt: "Choose the definite article: ___ école",
      sourceItemIds: ["40000000-0000-4000-8000-000000000002"],
      options: [
        { id: "50000000-0000-4000-8000-000000000003", text: "le" },
        { id: "50000000-0000-4000-8000-000000000004", text: "l'" },
      ],
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      type: "fr_to_en",
      prompt: "Translate into English: école",
      sourceItemIds: ["40000000-0000-4000-8000-000000000002"],
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      type: "en_to_fr",
      prompt: "Translate into French: school",
      sourceItemIds: ["40000000-0000-4000-8000-000000000002"],
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      type: "sentence_ordering",
      prompt: "Put the French sentence in the correct order.",
      sourceItemIds: ["40000000-0000-4000-8000-000000000003"],
      tokens: [
        { id: "60000000-0000-4000-8000-000000000001", text: "Bonjour" },
        { id: "60000000-0000-4000-8000-000000000002", text: "!" },
      ],
    },
  ],
};

afterEach(cleanup);

describe("choice and translation quiz UI", () => {
  it("renders native choice controls without pre-submit correctness", () => {
    render(<Quiz quiz={quiz} />);

    const region = screen.getByRole("region", { name: "Lesson quiz" });
    expect(within(region).getByText("Question 1 of 5")).toBeVisible();
    expect(
      within(region).getByRole("group", {
        name: "What does « bonjour » mean?",
      }),
    ).toBeVisible();
    expect(within(region).getByRole("radio", { name: "Hello" })).toBeVisible();
    expect(within(region).queryByText(/correct|incorrect/i)).toBeNull();
    expect(within(region).queryByText(/explanation/i)).toBeNull();
  });

  it("keeps choice and translation answers revisable while navigating", () => {
    render(<Quiz quiz={quiz} />);
    const region = screen.getByRole("region", { name: "Lesson quiz" });

    fireEvent.click(within(region).getByRole("radio", { name: "Hello" }));
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.click(within(region).getByRole("radio", { name: "l'" }));
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.change(
      within(region).getByRole("textbox", {
        name: "Translate into English: école",
      }),
      { target: { value: "school" } },
    );
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.change(
      within(region).getByRole("textbox", {
        name: "Translate into French: school",
      }),
      { target: { value: "école" } },
    );

    fireEvent.click(
      within(region).getByRole("button", { name: "Previous question" }),
    );
    expect(
      within(region).getByRole("textbox", {
        name: "Translate into English: école",
      }),
    ).toHaveValue("school");
    fireEvent.click(
      within(region).getByRole("button", { name: "Previous question" }),
    );
    expect(within(region).getByRole("radio", { name: "l'" })).toBeChecked();
    fireEvent.click(
      within(region).getByRole("button", { name: "Previous question" }),
    );
    expect(within(region).getByRole("radio", { name: "Hello" })).toBeChecked();
  });

  it("announces the deferred ordering interaction without hiding other questions", () => {
    render(<Quiz quiz={quiz} />);
    const region = screen.getByRole("region", { name: "Lesson quiz" });

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    }
    expect(within(region).getByText("Question 5 of 5")).toBeVisible();
    expect(
      within(region).getByText("Sentence ordering will be available next."),
    ).toBeVisible();
    expect(
      within(region).queryByRole("button", { name: "Next question" }),
    ).toBeNull();
  });

  it("renders a useful empty state when no quiz exists", () => {
    render(<Quiz quiz={null} />);

    expect(screen.getByText("No quiz has been generated yet.")).toBeVisible();
  });
});
