import { describe, expect, it } from "vitest";

import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import { quizSubmissionSchema, type Quiz } from "@/lib/contracts/quiz";
import {
  evaluateQuizSubmission,
  normalizeQuizTextAnswer,
} from "@/lib/quiz/evaluate-answer";
import { createDeterministicFakeQuiz } from "@/lib/quiz/generate-quiz";

import { completeGoldenLesson } from "../lesson-structuring/golden-cases";

const lessonId = "11111111-1111-4111-8111-111111111111";
const quizId = "22222222-2222-4222-8222-222222222222";
const submissionId = "33333333-3333-4333-8333-333333333333";
const ids = Array.from(
  { length: 60 },
  (_, index) => `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

function quizFixture(): Quiz {
  let lessonIndex = 0;
  const lesson = assignStructuredItemIds(
    completeGoldenLesson,
    () => ids[lessonIndex++],
  );
  let quizIndex = 10;
  return {
    ...createDeterministicFakeQuiz(lesson, () => ids[quizIndex++]),
    id: quizId,
    lessonId,
    sourceSchemaVersion: 1,
    createdAt: "2026-08-22T09:00:00.000Z",
  };
}

function correctAnswers(quiz: Quiz) {
  return quiz.questions.map((question) => {
    switch (question.type) {
      case "multiple_choice":
      case "article_blank":
        return {
          questionId: question.id,
          type: question.type,
          optionId: question.correctOptionId,
        };
      case "fr_to_en":
      case "en_to_fr":
        return {
          questionId: question.id,
          type: question.type,
          text: `  ${question.referenceAnswer.toLocaleUpperCase("fr")}!  `,
        };
      case "sentence_ordering":
        return {
          questionId: question.id,
          type: question.type,
          tokenIds: question.correctTokenIds,
        };
      default: {
        const exhaustive: never = question;
        throw new Error(`Unsupported fixture question: ${String(exhaustive)}`);
      }
    }
  });
}

describe("quiz grading", () => {
  it("normalizes composition, case, whitespace, and terminal punctuation", () => {
    expect(normalizeQuizTextAnswer("  TRE\u0300S   BIEN ?!  ")).toBe("très bien");
  });

  it("keeps French accents significant", () => {
    expect(normalizeQuizTextAnswer("école")).not.toBe(
      normalizeQuizTextAnswer("ecole"),
    );
  });

  it("grades all five answer types deterministically", () => {
    const quiz = quizFixture();
    const submission = quizSubmissionSchema.parse({
      submissionId,
      quizId,
      answers: correctAnswers(quiz),
    });

    const result = evaluateQuizSubmission(quiz, submission);

    expect(result.correctCount).toBe(5);
    expect(result.questionCount).toBe(5);
    expect(result.scorePercent).toBe(100);
    expect(result.results.every((item) => item.correct)).toBe(true);
  });

  it("identifies answers by question ID regardless of submission order", () => {
    const quiz = quizFixture();
    const answers = correctAnswers(quiz).reverse();
    const submission = quizSubmissionSchema.parse({
      submissionId,
      quizId,
      answers,
    });

    expect(evaluateQuizSubmission(quiz, submission).scorePercent).toBe(100);
  });

  it("rejects missing, duplicate, unknown, and mismatched answer forms", () => {
    const quiz = quizFixture();
    const answers = correctAnswers(quiz);

    expect(() =>
      quizSubmissionSchema.parse({
        submissionId,
        quizId,
        answers: [answers[0], answers[0], ...answers.slice(2)],
      }),
    ).toThrow();

    for (const invalidAnswers of [
      answers.slice(1),
      [
        { ...answers[0], questionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        ...answers.slice(1),
      ],
      [
        { questionId: answers[0].questionId, type: "fr_to_en", text: "hello" },
        ...answers.slice(1),
      ],
    ]) {
      const submission = quizSubmissionSchema.parse({
        submissionId,
        quizId,
        answers: invalidAnswers,
      });
      expect(() => evaluateQuizSubmission(quiz, submission)).toThrow(
        "exactly one matching answer",
      );
    }
  });

  it("keeps aggregate scores within zero and one hundred", () => {
    const quiz = quizFixture();
    const answers = correctAnswers(quiz).map((answer, index) => {
      const question = quiz.questions[index];
      if (
        "optionId" in answer &&
        (question.type === "multiple_choice" || question.type === "article_blank")
      ) {
        const wrongOption = question.options.find(
          (option) => option.id !== question.correctOptionId,
        );
        if (!wrongOption) throw new Error("Expected a wrong fixture option.");
        return { ...answer, optionId: wrongOption.id };
      }
      if ("text" in answer) return { ...answer, text: "incorrect" };
      const tokenIds = "tokenIds" in answer ? answer.tokenIds : undefined;
      if (tokenIds) {
        return { ...answer, tokenIds: [...tokenIds].reverse() };
      }
      throw new Error("Unsupported fixture answer.");
    });
    const submission = quizSubmissionSchema.parse({
      submissionId,
      quizId,
      answers,
    });

    const result = evaluateQuizSubmission(quiz, submission);
    expect(result.correctCount).toBe(0);
    expect(result.scorePercent).toBe(0);
    expect(result.scorePercent).toBeGreaterThanOrEqual(0);
    expect(result.scorePercent).toBeLessThanOrEqual(100);
  });
});
