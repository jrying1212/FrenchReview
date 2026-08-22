type PdfReplacementConfirmationProps = {
  currentName: string | null;
  nextName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PdfReplacementConfirmation({
  currentName,
  nextName,
  onCancel,
  onConfirm,
}: PdfReplacementConfirmationProps) {
  return (
    <div
      aria-describedby="replace-pdf-description"
      aria-labelledby="replace-pdf-heading"
      className="confirmation-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      role="alertdialog"
    >
      <h3 id="replace-pdf-heading">Replace the current PDF?</h3>
      <p id="replace-pdf-description">
        {currentName ? `“${currentName}” will be replaced by “${nextName}”. ` : ""}
        Existing extracted and generated lesson material will be cleared.
      </p>
      <div className="confirmation-actions">
        <button
          autoFocus
          className="primary-button"
          onClick={onConfirm}
          type="button"
        >
          Confirm replacement
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
