"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { ManualImportConfirmation } from "@/components/ai/manual-import-confirmation";
import { ManualPromptCopyControls } from "@/components/ai/manual-prompt-copy-controls";
import { useManualLessonPrompt } from "@/components/ai/use-manual-lesson-prompt";
import type {
  LessonId,
  StructuredContentSource,
} from "@/lib/contracts/lesson";

const errorResponseSchema = z.object({
  error: z.object({ message: z.string() }),
});

const importResponseSchema = z.object({
  data: z.object({
    lesson: z.object({ title: z.string() }),
    provenance: z.object({ source: z.literal("manual") }),
  }),
});

type ManualLessonImportProps = {
  contentSource: StructuredContentSource | null;
  contentTitle: string | null;
  isSourceReady: boolean;
  lessonId: LessonId;
  sourceKey: string | null;
};

export function ManualLessonImport({
  contentSource,
  contentTitle,
  isSourceReady,
  lessonId,
  sourceKey,
}: ManualLessonImportProps) {
  const router = useRouter();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const { prompt, promptError } = useManualLessonPrompt(
    isSourceReady,
    lessonId,
    sourceKey,
  );
  const [pastedJson, setPastedJson] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isConfirming) confirmButtonRef.current?.focus();
  }, [isConfirming]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setIsError(false);
      setMessage(`${label} copied.`);
    } catch {
      setIsError(true);
      setMessage(`${label} could not be copied. Try again.`);
    }
  }

  function cancelReplacement() {
    setIsConfirming(false);
    queueMicrotask(() => reviewButtonRef.current?.focus());
  }

  async function importLesson() {
    if (!pastedJson.trim() || isProcessing) return;
    setIsConfirming(false);
    setIsProcessing(true);
    setIsError(false);
    setMessage("Validating and saving manual lesson…");

    try {
      const response = await fetch(
        `/api/lessons/${lessonId}/structured-content`,
        {
          body: pastedJson,
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const error = errorResponseSchema.safeParse(body);
        setIsError(true);
        setMessage(
          error.success
            ? error.data.error.message
            : "The manual lesson could not be imported. Try again.",
        );
        return;
      }
      if (!importResponseSchema.safeParse(body).success) {
        setIsError(true);
        setMessage("The lesson was saved, but the response was invalid. Refresh the page.");
        return;
      }

      setMessage("Manual lesson imported successfully.");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("The manual lesson could not be imported. Try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pastedJson.trim() || isProcessing) return;
    if (contentTitle) setIsConfirming(true);
    else void importLesson();
  }

  const hasManualContent = contentSource === "manual" && contentTitle !== null;
  const displayMessage = message || promptError;
  const displayError = message ? isError : Boolean(promptError);

  return (
    <section className="manual-import" aria-labelledby="manual-import-heading">
      <p className="section-label">No-API workflow</p>
      <h2 id="manual-import-heading">Use your own AI tool</h2>
      <p>
        The app does not send your PDF or prompt anywhere. Copy them only if you
        choose to paste them into an external tool, then paste its JSON result here.
      </p>

      {hasManualContent ? (
        <aside className="manual-notice" role="note">
          <strong>Manual content</strong>
          <span>This review was imported by you and validated locally.</span>
          <span>Current manual review: {contentTitle}</span>
        </aside>
      ) : null}
      {contentTitle ? (
        <p className="current-review">Current saved review: {contentTitle}</p>
      ) : null}

      {!isSourceReady ? (
        <p className="manual-help">
          Import a readable PDF to use the manual workflow.
        </p>
      ) : (
        <>
          <ManualPromptCopyControls
            onCopy={(value, label) => void copy(value, label)}
            prompt={prompt}
          />

          <form aria-busy={isProcessing} onSubmit={submit}>
            <label htmlFor="manual-lesson-json">Paste structured lesson JSON</label>
            <textarea
              disabled={isProcessing}
              id="manual-lesson-json"
              onChange={(event) => setPastedJson(event.target.value)}
              spellCheck={false}
              value={pastedJson}
            />
            <p className="field-help">
              JSON must be 1 MiB or smaller. Validation happens locally.
            </p>
            {displayMessage ? (
              <p
                className={displayError ? "form-alert" : "form-status"}
                role={displayError ? "alert" : "status"}
              >
                {displayMessage}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={!pastedJson.trim() || isProcessing}
              ref={reviewButtonRef}
              type="submit"
            >
              {isProcessing
                ? "Importing…"
                : contentTitle
                  ? "Review import"
                  : "Import JSON"}
            </button>
          </form>

          {isConfirming && contentTitle ? (
            <ManualImportConfirmation
              confirmButtonRef={confirmButtonRef}
              contentTitle={contentTitle}
              onCancel={cancelReplacement}
              onConfirm={() => void importLesson()}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
