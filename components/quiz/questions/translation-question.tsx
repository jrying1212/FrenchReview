import type { QuizClientQuestion } from "@/lib/quiz/quiz-api";

type TranslationQuestion = Extract<
  QuizClientQuestion,
  { type: "fr_to_en" | "en_to_fr" }
>;

export function TranslationQuestion({
  question,
  value,
  onChange,
}: {
  question: TranslationQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="quiz-question quiz-translation-question">
      <label htmlFor={`answer-${question.id}`}>{question.prompt}</label>
      <input
        autoComplete="off"
        id={`answer-${question.id}`}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        type="text"
        value={value}
      />
      <p>Accents matter in French. You can revise this answer before submitting.</p>
    </div>
  );
}
