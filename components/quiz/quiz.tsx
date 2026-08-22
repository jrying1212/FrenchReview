"use client";

import { useRef, useState } from "react";

import { ChoiceQuestion } from "@/components/quiz/questions/choice-question";
import { SentenceOrdering } from "@/components/quiz/questions/sentence-ordering";
import { TranslationQuestion } from "@/components/quiz/questions/translation-question";
import { QuizResults } from "@/components/quiz/quiz-results";
import { QuizGenerationControls } from "@/components/quiz/quiz-generation-controls";
import {
  quizSubmissionResultSchema,
  type QuizSubmission,
  type QuizSubmissionResult,
} from "@/lib/contracts/quiz";
import type { QuizClient, QuizClientQuestion } from "@/lib/quiz/quiz-api";
import { quizClientSchema } from "@/lib/quiz/quiz-client-contract";

type DraftAnswer =
  | { kind: "choice"; optionId: string }
  | { kind: "translation"; text: string }
  | { kind: "ordering"; tokenIds: string[] };

export function Quiz({
  quiz,
  completedAttempt = null,
  generateQuiz,
  lessonId,
  submitAttempt,
  structuredReviewReady = false,
  createSubmissionId = () => globalThis.crypto.randomUUID(),
}: {
  quiz: QuizClient | null;
  completedAttempt?: QuizSubmissionResult | null;
  generateQuiz?: (confirmReplace: boolean) => Promise<QuizClient>;
  lessonId?: string;
  submitAttempt?: (submission: QuizSubmission) => Promise<QuizSubmissionResult>;
  structuredReviewReady?: boolean;
  createSubmissionId?: () => string;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuiz, setCurrentQuiz] = useState(quiz);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(
    completedAttempt,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionId = useRef<string | null>(null);

  const resolvedLessonId = lessonId ?? currentQuiz?.lessonId;

  async function handleGenerate(confirmReplace: boolean) {
    if (!resolvedLessonId || isGenerating) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const generated = generateQuiz
        ? await generateQuiz(confirmReplace)
        : await generateLessonQuiz(confirmReplace, resolvedLessonId);
      setCurrentQuiz(generated);
      setQuestionIndex(0);
      setAnswers({});
      setResult(null);
      submissionId.current = null;
    } catch {
      setGenerationError("The quiz could not be generated. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!currentQuiz) {
    return (
      <section className="lesson-quiz" aria-label="Lesson quiz">
        <p className="section-label">Lesson quiz</p>
        <h2 id="lesson-quiz-heading">Check your review</h2>
        <QuizGenerationControls
          hasQuiz={false}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          structuredReviewReady={structuredReviewReady}
        />
        {generationError ? (
          <p className="form-alert" role="alert">
            {generationError}
          </p>
        ) : null}
      </section>
    );
  }

  const activeQuiz = currentQuiz;
  const submit =
    submitAttempt ??
    ((submission: QuizSubmission) =>
      submitQuizAttempt(activeQuiz.lessonId, submission));
  const question = activeQuiz.questions[questionIndex];
  const isComplete = activeQuiz.questions.every((item) => {
    const answer = answers[item.id];
    if (item.type === "sentence_ordering") return true;
    if (item.type === "multiple_choice" || item.type === "article_blank") {
      return answer?.kind === "choice";
    }
    return answer?.kind === "translation" && answer.text.trim().length > 0;
  });

  function setAnswer(questionId: string, answer: DraftAnswer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  async function handleSubmit() {
    if (!isComplete || isSubmitting) return;
    submissionId.current ??= createSubmissionId();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const completed = await submit({
        answers: activeQuiz.questions.map((item) =>
          submittedAnswer(item, answers),
        ),
        quizId: activeQuiz.id,
        submissionId: submissionId.current,
      });
      setResult(completed);
    } catch {
      setSubmitError("The quiz could not be submitted. Your answers are still here.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="lesson-quiz" aria-label="Lesson quiz">
      <p className="section-label">Lesson quiz</p>
      <h2 id="lesson-quiz-heading">Check your review</h2>
      <QuizGenerationControls
        hasQuiz
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        structuredReviewReady={structuredReviewReady}
      />
      {generationError ? (
        <p className="form-alert" role="alert">
          {generationError}
        </p>
      ) : null}
      {result ? <QuizResults quiz={activeQuiz} result={result} /> : null}
      {!result ? (
        <>
          <p className="quiz-progress" aria-live="polite">
            Question {questionIndex + 1} of {activeQuiz.questions.length}
          </p>
          <div className="quiz-question-shell">
            {renderQuestion(question, answers, setAnswer)}
          </div>
          <nav className="quiz-navigation" aria-label="Quiz questions">
            {questionIndex > 0 ? (
              <button
                className="secondary-button"
                onClick={() => setQuestionIndex((index) => index - 1)}
                type="button"
              >
                Previous question
              </button>
            ) : (
              <span />
            )}
            {questionIndex < activeQuiz.questions.length - 1 ? (
              <button
                className="primary-button"
                onClick={() => setQuestionIndex((index) => index + 1)}
                type="button"
              >
                Next question
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!isComplete || isSubmitting}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting ? "Submitting…" : "Submit quiz"}
              </button>
            )}
          </nav>
          {!isComplete && questionIndex === activeQuiz.questions.length - 1 ? (
            <p className="quiz-submit-help">
              Answer every question before submitting.
            </p>
          ) : null}
          {submitError ? (
            <p className="form-alert" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function renderQuestion(
  question: QuizClientQuestion,
  answers: Record<string, DraftAnswer>,
  setAnswer: (questionId: string, answer: DraftAnswer) => void,
) {
  const answer = answers[question.id];

  switch (question.type) {
    case "multiple_choice":
    case "article_blank":
      return (
        <ChoiceQuestion
          onChange={(optionId) =>
            setAnswer(question.id, { kind: "choice", optionId })
          }
          question={question}
          selectedOptionId={answer?.kind === "choice" ? answer.optionId : undefined}
        />
      );
    case "fr_to_en":
    case "en_to_fr":
      return (
        <TranslationQuestion
          onChange={(text) =>
            setAnswer(question.id, { kind: "translation", text })
          }
          question={question}
          value={answer?.kind === "translation" ? answer.text : ""}
        />
      );
    case "sentence_ordering":
      return (
        <SentenceOrdering
          onChange={(tokenIds) =>
            setAnswer(question.id, { kind: "ordering", tokenIds })
          }
          question={question}
          tokenIds={
            answer?.kind === "ordering"
              ? answer.tokenIds
              : question.tokens.map((token) => token.id)
          }
        />
      );
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}

function submittedAnswer(
  question: QuizClientQuestion,
  answers: Record<string, DraftAnswer>,
): QuizSubmission["answers"][number] {
  const answer = answers[question.id];
  switch (question.type) {
    case "multiple_choice":
    case "article_blank":
      if (answer?.kind !== "choice") throw new Error("Missing choice answer.");
      return {
        optionId: answer.optionId,
        questionId: question.id,
        type: question.type,
      };
    case "fr_to_en":
    case "en_to_fr":
      if (answer?.kind !== "translation") {
        throw new Error("Missing translation answer.");
      }
      return { questionId: question.id, text: answer.text, type: question.type };
    case "sentence_ordering":
      return {
        questionId: question.id,
        tokenIds:
          answer?.kind === "ordering"
            ? answer.tokenIds
            : question.tokens.map((token) => token.id),
        type: question.type,
      };
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}

async function submitQuizAttempt(
  lessonId: string,
  submission: QuizSubmission,
): Promise<QuizSubmissionResult> {
  const response = await fetch(`/api/lessons/${lessonId}/quiz/attempts`, {
    body: JSON.stringify(submission),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) {
    throw new Error("Quiz submission failed.");
  }
  const parsed = quizSubmissionResultSchema.safeParse(body.data);
  if (!parsed.success) throw new Error("Quiz submission response was invalid.");
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function generateLessonQuiz(
  confirmReplace: boolean,
  lessonId: string,
): Promise<QuizClient> {
  const response = await fetch(`/api/lessons/${lessonId}/quiz`, {
    body: JSON.stringify({ confirmReplace }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || !isRecord(body.data)) {
    throw new Error("Quiz generation failed.");
  }
  return quizClientSchema.parse(body.data.quiz);
}
