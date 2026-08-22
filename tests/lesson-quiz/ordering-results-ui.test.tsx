import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SentenceOrdering } from "@/components/quiz/questions/sentence-ordering";
import type { QuizClientQuestion } from "@/lib/quiz/quiz-api";

const question: Extract<
  QuizClientQuestion,
  { type: "sentence_ordering" }
> = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "sentence_ordering",
  prompt: "Put the French sentence in the correct order.",
  sourceItemIds: ["22222222-2222-4222-8222-222222222222"],
  tokens: [
    { id: "30000000-0000-4000-8000-000000000003", text: "Boris" },
    { id: "30000000-0000-4000-8000-000000000001", text: "Je" },
    { id: "30000000-0000-4000-8000-000000000002", text: "m’appelle" },
  ],
};

afterEach(cleanup);

describe("sentence ordering UI", () => {
  it("moves stable token IDs without joining untrusted text", () => {
    const onChange = vi.fn();
    render(
      <SentenceOrdering
        onChange={onChange}
        question={question}
        tokenIds={question.tokens.map((token) => token.id)}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Move Boris at position 1 right",
      }),
    );

    expect(onChange).toHaveBeenCalledWith([
      question.tokens[1].id,
      question.tokens[0].id,
      question.tokens[2].id,
    ]);
  });

  it("provides keyboard-native controls and disables impossible moves", () => {
    render(
      <SentenceOrdering
        onChange={() => undefined}
        question={question}
        tokenIds={question.tokens.map((token) => token.id)}
      />,
    );
    const list = screen.getByRole("list", { name: "Current sentence order" });
    const first = within(list).getAllByRole("listitem")[0];
    const last = within(list).getAllByRole("listitem")[2];

    expect(
      within(first).getByRole("button", { name: /move boris.*left/i }),
    ).toBeDisabled();
    expect(
      within(last).getByRole("button", { name: /move m’appelle.*right/i }),
    ).toBeDisabled();
    within(first).getByRole("button", { name: /move boris.*right/i }).focus();
    expect(within(first).getByRole("button", { name: /move boris.*right/i })).toHaveFocus();
  });
});
