import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Quiz } from "@/components/quiz/quiz";
import { QuizResults } from "@/components/quiz/quiz-results";
import { SentenceOrdering } from "@/components/quiz/questions/sentence-ordering";
import type { QuizSubmissionResult } from "@/lib/contracts/quiz";
import type { QuizClient } from "@/lib/quiz/quiz-api";
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

const quiz: QuizClient = {
  id: "44444444-4444-4444-8444-444444444444",
  lessonId: "55555555-5555-4555-8555-555555555555",
  sourceSchemaVersion: 1,
  createdAt: "2026-08-22T09:00:00.000Z",
  questions: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      type: "multiple_choice",
      prompt: "What does « bonjour » mean?",
      sourceItemIds: ["20000000-0000-4000-8000-000000000001"],
      options: [
        { id: "40000000-0000-4000-8000-000000000001", text: "Hello" },
        { id: "40000000-0000-4000-8000-000000000002", text: "Goodbye" },
      ],
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      type: "article_blank",
      prompt: "Choose the article: ___ école",
      sourceItemIds: ["20000000-0000-4000-8000-000000000002"],
      options: [
        { id: "40000000-0000-4000-8000-000000000003", text: "le" },
        { id: "40000000-0000-4000-8000-000000000004", text: "l'" },
      ],
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      type: "fr_to_en",
      prompt: "Translate into English: école",
      sourceItemIds: ["20000000-0000-4000-8000-000000000002"],
    },
    {
      id: "10000000-0000-4000-8000-000000000004",
      type: "en_to_fr",
      prompt: "Translate into French: school",
      sourceItemIds: ["20000000-0000-4000-8000-000000000002"],
    },
    question,
  ],
};

const result: QuizSubmissionResult = {
  replayed: false,
  attempt: {
    id: "66666666-6666-4666-8666-666666666666",
    lessonId: quiz.lessonId,
    quizId: quiz.id,
    correctCount: 5,
    questionCount: 5,
    scorePercent: 100,
    createdAt: "2026-08-22T10:00:00.000Z",
  },
  feedback: [
    {
      questionId: quiz.questions[0].id,
      correct: true,
      normalizedAnswer: "40000000-0000-4000-8000-000000000001",
      explanationEn: "Bonjour means hello.",
      correctAnswer: "40000000-0000-4000-8000-000000000001",
    },
    {
      questionId: quiz.questions[1].id,
      correct: true,
      normalizedAnswer: "40000000-0000-4000-8000-000000000004",
      explanationEn: "École uses l'.",
      correctAnswer: "40000000-0000-4000-8000-000000000004",
    },
    {
      questionId: quiz.questions[2].id,
      correct: true,
      normalizedAnswer: "school",
      explanationEn: "École means school.",
      correctAnswer: "school",
    },
    {
      questionId: quiz.questions[3].id,
      correct: true,
      normalizedAnswer: "école",
      explanationEn: "School is école in French.",
      correctAnswer: "école",
    },
    {
      questionId: question.id,
      correct: true,
      normalizedAnswer: question.tokens.map((token) => token.id),
      explanationEn: "The sentence is Je m’appelle Boris.",
      correctAnswer: [question.tokens[1].id, question.tokens[2].id, question.tokens[0].id],
    },
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

describe("quiz submission and results UI", () => {
  it("renders score, per-question explanations, and formatted correct answers", () => {
    render(<QuizResults quiz={quiz} result={result} />);

    expect(screen.getByText("5 of 5 correct · 100%")).toBeVisible();
    expect(screen.getAllByText("Correct")).toHaveLength(5);
    expect(screen.getByText("Bonjour means hello.")).toBeVisible();
    expect(screen.getByText("Je m’appelle Boris")).toBeVisible();
  });

  it("submits all typed answers once and replaces the form with results", async () => {
    const submitAttempt = vi.fn(async () => result);
    render(
      <Quiz
        createSubmissionId={() => result.attempt.id}
        quiz={quiz}
        submitAttempt={submitAttempt}
      />,
    );
    const region = screen.getByRole("region", { name: "Lesson quiz" });

    fireEvent.click(within(region).getByRole("radio", { name: "Hello" }));
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.click(within(region).getByRole("radio", { name: "l'" }));
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.change(
      within(region).getByRole("textbox", { name: "Translate into English: école" }),
      { target: { value: "school" } },
    );
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.change(
      within(region).getByRole("textbox", { name: "Translate into French: school" }),
      { target: { value: "école" } },
    );
    fireEvent.click(within(region).getByRole("button", { name: "Next question" }));
    fireEvent.click(within(region).getByRole("button", { name: "Submit quiz" }));

    expect(await within(region).findByText("5 of 5 correct · 100%")).toBeVisible();
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(submitAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId: quiz.id,
        submissionId: result.attempt.id,
        answers: expect.arrayContaining([
          expect.objectContaining({ type: "multiple_choice" }),
          expect.objectContaining({ type: "article_blank" }),
          expect.objectContaining({ type: "fr_to_en" }),
          expect.objectContaining({ type: "en_to_fr" }),
          expect.objectContaining({ type: "sentence_ordering" }),
        ]),
      }),
    );
    expect(within(region).queryByRole("button", { name: "Submit quiz" })).toBeNull();
  });
});
