import type { QuizSubmissionResult } from "@/lib/contracts/quiz";
import type { QuizClient, QuizClientQuestion } from "@/lib/quiz/quiz-api";

export function QuizResults({
  quiz,
  result,
}: {
  quiz: QuizClient;
  result: QuizSubmissionResult;
}) {
  const feedback = new Map(
    result.feedback.map((item) => [item.questionId, item]),
  );

  return (
    <div className="quiz-results" aria-live="polite">
      <p className="quiz-score-label">Quiz complete</p>
      <h3>
        {result.attempt.correctCount} of {result.attempt.questionCount} correct ·{" "}
        {result.attempt.scorePercent}%
      </h3>
      <ol className="quiz-result-list">
        {quiz.questions.map((question) => {
          const item = feedback.get(question.id);
          if (!item) throw new Error("Quiz result is missing question feedback.");
          return (
            <li
              className={
                item.correct ? "quiz-result-correct" : "quiz-result-review"
              }
              key={question.id}
            >
              <p className="quiz-result-state">
                {item.correct ? "Correct" : "Review this one"}
              </p>
              <h4>{question.prompt}</h4>
              <p>{item.explanationEn}</p>
              <p>
                <strong>Correct answer:</strong>{" "}
                <span lang={question.type === "en_to_fr" ? "fr" : undefined}>
                  {formatCorrectAnswer(question, item.correctAnswer)}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatCorrectAnswer(
  question: QuizClientQuestion,
  correctAnswer: string | string[],
) {
  if (
    (question.type === "multiple_choice" || question.type === "article_blank") &&
    typeof correctAnswer === "string"
  ) {
    return (
      question.options.find((option) => option.id === correctAnswer)?.text ??
      "Unavailable"
    );
  }
  if (question.type === "sentence_ordering" && Array.isArray(correctAnswer)) {
    const tokens = new Map(
      question.tokens.map((token) => [token.id, token.text]),
    );
    return correctAnswer.map((id) => tokens.get(id) ?? "").join(" ");
  }
  return typeof correctAnswer === "string" ? correctAnswer : "Unavailable";
}
