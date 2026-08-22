import {
  quizSchema,
  quizSubmissionSchema,
  type Quiz,
  type QuizQuestion,
  type QuizSubmission,
  type QuizSubmittedAnswer,
} from "@/lib/contracts/quiz";

export type QuizQuestionResult = {
  questionId: string;
  correct: boolean;
  normalizedAnswer: string | string[];
};

export type QuizEvaluation = {
  results: QuizQuestionResult[];
  correctCount: number;
  questionCount: number;
  scorePercent: number;
};

export function normalizeQuizTextAnswer(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/[.!?…]+$/u, "")
    .trimEnd()
    .toLocaleLowerCase("fr");
}

export function evaluateQuizSubmission(
  quizInput: Quiz,
  submissionInput: QuizSubmission,
): QuizEvaluation {
  const quiz = quizSchema.parse(quizInput);
  const submission = quizSubmissionSchema.parse(submissionInput);
  if (submission.quizId !== quiz.id) {
    throw new Error("Submission quiz ID does not match the loaded quiz.");
  }

  const answers = new Map(
    submission.answers.map((answer) => [answer.questionId, answer]),
  );
  if (
    answers.size !== quiz.questions.length ||
    quiz.questions.some((question) => !answers.has(question.id)) ||
    submission.answers.some(
      (answer) => !quiz.questions.some((question) => question.id === answer.questionId),
    )
  ) {
    throw new Error("Submit exactly one matching answer for every quiz question.");
  }

  const results = quiz.questions.map((question) =>
    evaluateQuestion(question, answers.get(question.id) as QuizSubmittedAnswer),
  );
  const correctCount = results.filter((result) => result.correct).length;
  const questionCount = results.length;

  return {
    results,
    correctCount,
    questionCount,
    scorePercent: Math.round((correctCount / questionCount) * 100),
  };
}

function evaluateQuestion(
  question: QuizQuestion,
  answer: QuizSubmittedAnswer,
): QuizQuestionResult {
  if (answer.type !== question.type) {
    throw new Error("Submit exactly one matching answer for every quiz question.");
  }

  switch (question.type) {
    case "multiple_choice":
    case "article_blank": {
      if (
        answer.type !== "multiple_choice" &&
        answer.type !== "article_blank"
      ) {
        throw new Error("Submitted answer type does not match the quiz question.");
      }
      if (!question.options.some((option) => option.id === answer.optionId)) {
        throw new Error("Submitted option does not belong to the quiz question.");
      }
      return {
        questionId: question.id,
        correct: answer.optionId === question.correctOptionId,
        normalizedAnswer: answer.optionId,
      };
    }
    case "fr_to_en":
    case "en_to_fr": {
      if (answer.type !== "fr_to_en" && answer.type !== "en_to_fr") {
        throw new Error("Submitted answer type does not match the quiz question.");
      }
      const normalizedAnswer = normalizeQuizTextAnswer(answer.text);
      return {
        questionId: question.id,
        correct: question.acceptedAnswers.some(
          (accepted) => normalizeQuizTextAnswer(accepted) === normalizedAnswer,
        ),
        normalizedAnswer,
      };
    }
    case "sentence_ordering": {
      if (answer.type !== "sentence_ordering") {
        throw new Error("Submitted answer type does not match the quiz question.");
      }
      const validTokenIds = new Set(question.tokens.map((token) => token.id));
      if (
        answer.tokenIds.length !== question.tokens.length ||
        answer.tokenIds.some((id) => !validTokenIds.has(id))
      ) {
        throw new Error("Submitted ordering must use every quiz token exactly once.");
      }
      return {
        questionId: question.id,
        correct: answer.tokenIds.every(
          (id, index) => id === question.correctTokenIds[index],
        ),
        normalizedAnswer: answer.tokenIds,
      };
    }
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}
