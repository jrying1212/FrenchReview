import type { RefObject } from "react";

type ManualImportConfirmationProps = {
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  contentTitle: string;
  onCancel(): void;
  onConfirm(): void;
};

export function ManualImportConfirmation({
  confirmButtonRef,
  contentTitle,
  onCancel,
  onConfirm,
}: ManualImportConfirmationProps) {
  return (
    <div
      aria-labelledby="manual-confirm-heading"
      className="confirmation-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      role="alertdialog"
    >
      <h3 id="manual-confirm-heading">Replace “{contentTitle}”?</h3>
      <p>
        The current saved review will be replaced only after the pasted JSON passes
        validation.
      </p>
      <div className="confirmation-actions">
        <button
          className="primary-button"
          onClick={onConfirm}
          ref={confirmButtonRef}
          type="button"
        >
          Replace saved review
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
