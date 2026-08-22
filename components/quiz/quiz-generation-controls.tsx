import { useState } from "react";

export function QuizGenerationControls({
  hasQuiz,
  isGenerating,
  structuredReviewReady,
  onGenerate,
}: {
  hasQuiz: boolean;
  isGenerating: boolean;
  structuredReviewReady: boolean;
  onGenerate: (confirmReplace: boolean) => Promise<void>;
}) {
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);

  if (!structuredReviewReady) {
    return (
      <p className="quiz-empty">Import or generate a structured review first.</p>
    );
  }

  if (!hasQuiz) {
    return (
      <div className="quiz-generation-actions">
        <p className="quiz-empty">No quiz has been generated yet.</p>
        <button
          className="primary-button"
          disabled={isGenerating}
          onClick={() => onGenerate(false)}
          type="button"
        >
          {isGenerating ? "Generating…" : "Generate quiz"}
        </button>
      </div>
    );
  }

  if (confirmingReplacement) {
    return (
      <div className="quiz-replacement-confirmation">
        <p>
          This replaces the current quiz. Completed attempts remain in your
          lesson history.
        </p>
        <div className="confirmation-actions">
          <button
            className="danger-button"
            disabled={isGenerating}
            onClick={async () => {
              await onGenerate(true);
              setConfirmingReplacement(false);
            }}
            type="button"
          >
            {isGenerating ? "Replacing…" : "Replace current quiz"}
          </button>
          <button
            className="secondary-button"
            disabled={isGenerating}
            onClick={() => setConfirmingReplacement(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="secondary-button quiz-regenerate-button"
      onClick={() => setConfirmingReplacement(true)}
      type="button"
    >
      Generate a new quiz
    </button>
  );
}
