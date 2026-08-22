"use client";

import { useState } from "react";

import { ChoiceQuestion } from "@/components/quiz/questions/choice-question";
import { TranslationQuestion } from "@/components/quiz/questions/translation-question";
import type { QuizClient, QuizClientQuestion } from "@/lib/quiz/quiz-api";

type DraftAnswer =
  | { kind: "choice"; optionId: string }
  | { kind: "translation"; text: string };

export function Quiz({ quiz }: { quiz: QuizClient | null }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});

  if (!quiz) {
    return (
      <section className="lesson-quiz" aria-label="Lesson quiz">
        <p className="section-label">Lesson quiz</p>
        <h2 id="lesson-quiz-heading">Check your review</h2>
        <p className="quiz-empty">No quiz has been generated yet.</p>
      </section>
    );
  }

  const question = quiz.questions[questionIndex];

  function setAnswer(questionId: string, answer: DraftAnswer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  return (
    <section className="lesson-quiz" aria-label="Lesson quiz">
      <p className="section-label">Lesson quiz</p>
      <h2 id="lesson-quiz-heading">Check your review</h2>
      <p className="quiz-progress" aria-live="polite">
        Question {questionIndex + 1} of {quiz.questions.length}
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
        {questionIndex < quiz.questions.length - 1 ? (
          <button
            className="primary-button"
            onClick={() => setQuestionIndex((index) => index + 1)}
            type="button"
          >
            Next question
          </button>
        ) : null}
      </nav>
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
        <div className="quiz-question quiz-ordering-placeholder">
          <h3>{question.prompt}</h3>
          <p>Sentence ordering will be available next.</p>
        </div>
      );
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}
