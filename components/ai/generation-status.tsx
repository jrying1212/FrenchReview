"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import type {
  LessonId,
  ParseStatus,
  StructuredContentSource,
} from "@/lib/contracts/lesson";

const errorResponseSchema = z.object({
  error: z.object({ message: z.string() }),
});

const successResponseSchema = z.object({
  data: z.object({
    lesson: z.object({ title: z.string() }),
    provenance: z.object({ source: z.literal("fake") }),
  }),
});

const persistedErrorMessages: Record<string, string> = {
  INVALID_AI_OUTPUT: "The generated lesson was invalid. Try again.",
  PROVIDER_RATE_LIMIT:
    "Lesson generation is temporarily unavailable. Try again.",
  PROVIDER_TIMEOUT: "Lesson generation timed out. Try again.",
};

type GenerationStatusProps = {
  contentSource: StructuredContentSource | null;
  contentTitle: string | null;
  isSourceReady: boolean;
  lessonId: LessonId;
  parseErrorCode: string | null;
  parseStatus: ParseStatus;
};

export function GenerationStatus({
  contentSource,
  contentTitle,
  isSourceReady,
  lessonId,
  parseErrorCode,
  parseStatus,
}: GenerationStatusProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(
    parseStatus === "processing",
  );
  const [isError, setIsError] = useState(parseStatus === "failed");
  const [message, setMessage] = useState(
    parseStatus === "processing"
      ? "Generating demo lesson…"
      : parseStatus === "failed"
        ? (persistedErrorMessages[parseErrorCode ?? ""] ??
          "The demo lesson could not be generated. Try again.")
        : "",
  );

  const hasDemoContent = contentSource === "fake" && contentTitle !== null;
  const buttonLabel = isProcessing
    ? "Generating demo lesson…"
    : isError
      ? "Retry demo generation"
      : hasDemoContent
        ? "Regenerate demo lesson"
        : "Generate demo lesson";

  async function generate() {
    if (!isSourceReady || isProcessing) return;

    setIsProcessing(true);
    setIsError(false);
    setMessage("Generating demo lesson…");

    try {
      const response = await fetch(`/api/lessons/${lessonId}/structure`, {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const error = errorResponseSchema.safeParse(body);
        setIsError(true);
        setMessage(
          error.success
            ? error.data.error.message
            : "The demo lesson could not be generated. Try again.",
        );
        return;
      }

      if (!successResponseSchema.safeParse(body).success) {
        setIsError(true);
        setMessage(
          "The lesson was generated, but the response was invalid. Refresh the page.",
        );
        return;
      }

      setMessage("Demo lesson generated successfully.");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("The demo lesson could not be generated. Try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section
      aria-busy={isProcessing}
      aria-labelledby="generation-heading"
      className="lesson-generation"
    >
      <p className="section-label">Review structure</p>
      <h2 id="generation-heading">Build a demo review</h2>
      <p>
        Test the complete local workflow with deterministic sample content. No API
        key, external request, or usage charge is involved.
      </p>

      {hasDemoContent ? (
        <aside className="demo-notice" role="note">
          <strong>Demo content</strong>
          <span>
            This is deterministic demo content. It was not derived from your PDF.
          </span>
          <span>Current demo: {contentTitle}</span>
        </aside>
      ) : null}

      {!isSourceReady ? (
        <p className="generation-help">
          Import a readable PDF to unlock demo generation.
        </p>
      ) : (
        <>
          {message ? (
            <p
              className={isError ? "form-alert" : "form-status"}
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
          <button
            className="primary-button"
            disabled={isProcessing}
            onClick={() => void generate()}
            type="button"
          >
            {buttonLabel}
          </button>
        </>
      )}
    </section>
  );
}
