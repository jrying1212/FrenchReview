import { createHash } from "node:crypto";

import type { LessonId } from "@/lib/contracts/lesson";
import {
  quizSubmissionResultSchema,
  quizSubmissionSchema,
  type QuizQuestion,
  type QuizSubmission,
} from "@/lib/contracts/quiz";
import { evaluateQuizSubmission } from "@/lib/quiz/evaluate-answer";
import type {
  QuizAttemptRepository,
  QuizAttemptWithQuiz,
  StoredQuizAttempt,
} from "@/lib/quiz/quiz-attempt-repository";

export type SubmitQuizAttemptErrorCode =
  | "LESSON_NOT_FOUND"
  | "QUIZ_NOT_FOUND"
  | "QUIZ_CHANGED"
  | "INVALID_ANSWERS"
  | "IDEMPOTENCY_CONFLICT"
  | "ATTEMPT_SAVE_FAILED";

export class SubmitQuizAttemptError extends Error {
  constructor(readonly code: SubmitQuizAttemptErrorCode) {
    super(code);
    this.name = "SubmitQuizAttemptError";
  }
}

type SubmitAttemptDependencies = {
  repository: QuizAttemptRepository;
  now?: () => Date;
};

export async function submitQuizAttempt(
  requestInput: unknown,
  lessonId: LessonId,
  dependencies: SubmitAttemptDependencies,
) {
  const submission = quizSubmissionSchema.parse(requestInput);
  const requestHash = hashSubmission(submission);

  let existing;
  try {
    existing = await dependencies.repository.readAttempt(submission.submissionId);
  } catch {
    throw new SubmitQuizAttemptError("ATTEMPT_SAVE_FAILED");
  }
  if (existing) {
    if (
      existing.attempt.lessonId !== lessonId ||
      existing.attempt.requestHash !== requestHash
    ) {
      throw new SubmitQuizAttemptError("IDEMPOTENCY_CONFLICT");
    }
    return toQuizSubmissionResult(existing, true);
  }

  let active;
  try {
    active = await dependencies.repository.readActiveQuiz(lessonId);
  } catch {
    throw new SubmitQuizAttemptError("ATTEMPT_SAVE_FAILED");
  }
  if (active.status === "lesson_not_found") {
    throw new SubmitQuizAttemptError("LESSON_NOT_FOUND");
  }
  if (active.status === "quiz_not_found") {
    throw new SubmitQuizAttemptError("QUIZ_NOT_FOUND");
  }
  if (active.quiz.id !== submission.quizId) {
    throw new SubmitQuizAttemptError("QUIZ_CHANGED");
  }

  let evaluation;
  try {
    evaluation = evaluateQuizSubmission(active.quiz, submission);
  } catch {
    throw new SubmitQuizAttemptError("INVALID_ANSWERS");
  }

  const attempt: StoredQuizAttempt = {
    answers: submission.answers,
    correctCount: evaluation.correctCount,
    createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    id: submission.submissionId,
    lessonId,
    questionCount: evaluation.questionCount,
    quizId: submission.quizId,
    requestHash,
    results: evaluation.results,
    scorePercent: evaluation.scorePercent,
  };

  let saved;
  try {
    saved = await dependencies.repository.saveAttempt({
      attempt,
      quiz: active.quiz,
    });
  } catch {
    throw new SubmitQuizAttemptError("ATTEMPT_SAVE_FAILED");
  }
  if (saved.status === "idempotency_conflict") {
    throw new SubmitQuizAttemptError("IDEMPOTENCY_CONFLICT");
  }
  return toQuizSubmissionResult(saved.value, saved.status === "replayed");
}

function hashSubmission(submission: QuizSubmission) {
  const answers = [...submission.answers].sort((left, right) =>
    left.questionId.localeCompare(right.questionId),
  );
  return createHash("sha256")
    .update(JSON.stringify({ quizId: submission.quizId, answers }))
    .digest("hex");
}

export function toQuizSubmissionResult(
  value: QuizAttemptWithQuiz,
  replayed: boolean,
) {
  const { attempt, quiz } = value;
  const results = new Map(
    attempt.results.map((result) => [result.questionId, result]),
  );

  return quizSubmissionResultSchema.parse({
    replayed,
    attempt: {
      id: attempt.id,
      lessonId: attempt.lessonId,
      quizId: attempt.quizId,
      correctCount: attempt.correctCount,
      questionCount: attempt.questionCount,
      scorePercent: attempt.scorePercent,
      createdAt: attempt.createdAt,
    },
    feedback: quiz.questions.map((question) => {
      const result = results.get(question.id);
      if (!result) throw new Error("Saved attempt is missing a question result.");
      return {
        ...result,
        explanationEn: question.explanationEn,
        correctAnswer: correctAnswerFor(question),
      };
    }),
  });
}

function correctAnswerFor(question: QuizQuestion): string | string[] {
  switch (question.type) {
    case "multiple_choice":
    case "article_blank":
      return question.correctOptionId;
    case "fr_to_en":
    case "en_to_fr":
      return question.referenceAnswer;
    case "sentence_ordering":
      return question.correctTokenIds;
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}

const errorResponses: Record<
  SubmitQuizAttemptErrorCode,
  { message: string; status: number }
> = {
  LESSON_NOT_FOUND: { message: "Lesson not found.", status: 404 },
  QUIZ_NOT_FOUND: { message: "Generate a quiz before submitting.", status: 409 },
  QUIZ_CHANGED: {
    message: "The quiz changed. Refresh before submitting answers.",
    status: 409,
  },
  INVALID_ANSWERS: {
    message: "Submit one valid answer for every quiz question.",
    status: 422,
  },
  IDEMPOTENCY_CONFLICT: {
    message: "This submission identifier was already used for different answers.",
    status: 422,
  },
  ATTEMPT_SAVE_FAILED: {
    message: "The quiz attempt could not be saved.",
    status: 500,
  },
};

export async function submitQuizAttemptResponse(
  requestInput: unknown,
  lessonId: LessonId,
  dependencies: SubmitAttemptDependencies,
): Promise<Response> {
  const request = quizSubmissionSchema.safeParse(requestInput);
  if (!request.success) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Submit a valid quiz identifier and typed answers.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitQuizAttempt(request.data, lessonId, dependencies);
    return Response.json(
      { data: result },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    const code =
      error instanceof SubmitQuizAttemptError
        ? error.code
        : "ATTEMPT_SAVE_FAILED";
    const response = errorResponses[code];
    return Response.json(
      { error: { code, message: response.message } },
      { status: response.status },
    );
  }
}
