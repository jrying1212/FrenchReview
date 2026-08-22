import type { QuizClientQuestion } from "@/lib/quiz/quiz-api";

type ChoiceQuestion = Extract<
  QuizClientQuestion,
  { type: "multiple_choice" | "article_blank" }
>;

export function ChoiceQuestion({
  question,
  selectedOptionId,
  onChange,
}: {
  question: ChoiceQuestion;
  selectedOptionId: string | undefined;
  onChange: (optionId: string) => void;
}) {
  return (
    <fieldset className="quiz-question quiz-choice-question">
      <legend>{question.prompt}</legend>
      <div className="quiz-options">
        {question.options.map((option) => (
          <label className="quiz-option" key={option.id}>
            <input
              checked={selectedOptionId === option.id}
              name={`answer-${question.id}`}
              onChange={() => onChange(option.id)}
              type="radio"
              value={option.id}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
