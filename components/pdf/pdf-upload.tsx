"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { z } from "zod";

import { PDF_MAX_BYTES } from "@/lib/contracts/pdf-import";
import type { LessonId } from "@/lib/contracts/lesson";
import { PdfReplacementConfirmation } from "@/components/pdf/pdf-replacement-confirmation";

const errorResponseSchema = z.object({
  error: z.object({ message: z.string() }),
});

const successResponseSchema = z.object({
  data: z.object({
    characterCount: z.number().int().nonnegative(),
    importStatus: z.literal("ready"),
    lessonId: z.string(),
    originalName: z.string(),
    pageCount: z.number().int().positive(),
  }),
});

type PdfUploadProps = {
  hasPdf: boolean;
  lessonId: LessonId;
  originalName: string | null;
};
export function PdfUpload({ hasPdf, lessonId, originalName }: PdfUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function selectFile(nextFile: File | undefined) {
    setMessage("");
    setIsError(false);
    setIsConfirming(false);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!nextFile.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setIsError(true);
      setMessage("Choose a PDF file.");
      return;
    }

    if (nextFile.size > PDF_MAX_BYTES) {
      setFile(null);
      setIsError(true);
      setMessage("Choose a PDF no larger than 20 MiB.");
      return;
    }

    setFile(nextFile);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!isProcessing) selectFile(event.dataTransfer.files[0]);
  }

  function cancelReplacement() {
    setIsConfirming(false);
    queueMicrotask(() => replaceButtonRef.current?.focus());
  }

  async function upload(confirmReplacement: boolean) {
    if (!file || isProcessing) return;

    setIsConfirming(false);
    setIsProcessing(true);
    setIsError(false);
    setMessage("Uploading and extracting text…");

    const formData = new FormData();
    formData.append("file", file);
    if (confirmReplacement) formData.append("confirmReplacement", "true");

    try {
      const response = await fetch(`/api/lessons/${lessonId}/pdf`, {
        body: formData,
        method: "POST",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const error = errorResponseSchema.safeParse(body);
        setIsError(true);
        setMessage(
          error.success
            ? error.data.error.message
            : "The PDF could not be imported. Try again.",
        );
        return;
      }

      if (!successResponseSchema.safeParse(body).success) {
        setIsError(true);
        setMessage("The PDF was imported, but the response was invalid. Refresh the page.");
        return;
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("PDF imported successfully.");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("The PDF could not be imported. Check the app and try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isProcessing) return;

    if (hasPdf) {
      setIsConfirming(true);
      return;
    }

    void upload(false);
  }

  return (
    <section className="pdf-import" aria-labelledby="pdf-import-heading">
      <p className="section-label">Class material</p>
      <h2 id="pdf-import-heading">{hasPdf ? "Replace PDF" : "Add a PDF"}</h2>
      <p>
        Choose one text-based PDF up to 20 MiB. Scanned or image-only PDFs are not
        supported.
      </p>
      {hasPdf && originalName ? (
        <p className="current-file">Current source: <strong>{originalName}</strong></p>
      ) : null}

      <form aria-busy={isProcessing} onSubmit={handleSubmit}>
        <label
          className="pdf-drop-zone"
          htmlFor="lesson-pdf"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span>Drop a PDF here</span>
          <span>or choose a file</span>
          <input
            accept=".pdf,application/pdf"
            aria-label="PDF file"
            disabled={isProcessing}
            id="lesson-pdf"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
        </label>

        {file ? <p className="selected-file">Selected: <strong>{file.name}</strong></p> : null}
        {message ? (
          <p className={isError ? "form-alert" : "form-status"} role={isError ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
        <button
          className="primary-button"
          disabled={!file || isProcessing}
          ref={replaceButtonRef}
          type="submit"
        >
          {isProcessing ? "Processing PDF…" : hasPdf ? "Replace PDF" : "Upload PDF"}
        </button>

        {isConfirming && file ? (
          <PdfReplacementConfirmation
            currentName={originalName}
            nextName={file.name}
            onCancel={cancelReplacement}
            onConfirm={() => void upload(true)}
          />
        ) : null}
      </form>
    </section>
  );
}
