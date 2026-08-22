type ManualPromptCopyControlsProps = {
  prompt: { schema: string; text: string } | null;
  onCopy(value: string, label: string): void;
};

export function ManualPromptCopyControls({
  prompt,
  onCopy,
}: ManualPromptCopyControlsProps) {
  return (
    <div className="copy-actions" aria-label="Manual prompt copy controls">
      <button
        className="secondary-button"
        disabled={!prompt}
        onClick={() => prompt && onCopy(prompt.text, "Prompt")}
        type="button"
      >
        Copy prompt
      </button>
      <button
        className="secondary-button"
        disabled={!prompt}
        onClick={() => prompt && onCopy(prompt.schema, "JSON Schema")}
        type="button"
      >
        Copy JSON Schema
      </button>
    </div>
  );
}
