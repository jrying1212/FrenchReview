import type { QuizClientQuestion } from "@/lib/quiz/quiz-api";

type OrderingQuestion = Extract<
  QuizClientQuestion,
  { type: "sentence_ordering" }
>;

export function SentenceOrdering({
  question,
  tokenIds,
  onChange,
}: {
  question: OrderingQuestion;
  tokenIds: string[];
  onChange: (tokenIds: string[]) => void;
}) {
  const tokens = new Map(question.tokens.map((token) => [token.id, token]));

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= tokenIds.length) return;
    const next = [...tokenIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="quiz-question quiz-ordering-question">
      <legend>{question.prompt}</legend>
      <p>Use the Left and Right buttons to arrange the French sentence.</p>
      <ol aria-label="Current sentence order" className="ordering-token-list">
        {tokenIds.map((tokenId, index) => {
          const token = tokens.get(tokenId);
          if (!token) throw new Error("Unknown sentence-ordering token.");
          const position = index + 1;
          return (
            <li key={token.id}>
              <span className="ordering-token" lang="fr">
                {token.text}
              </span>
              <span className="ordering-actions">
                <button
                  aria-label={`Move ${token.text} at position ${position} left`}
                  className="secondary-button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  type="button"
                >
                  ← Left
                </button>
                <button
                  aria-label={`Move ${token.text} at position ${position} right`}
                  className="secondary-button"
                  disabled={index === tokenIds.length - 1}
                  onClick={() => move(index, 1)}
                  type="button"
                >
                  Right →
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
