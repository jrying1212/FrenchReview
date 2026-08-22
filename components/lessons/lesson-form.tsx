"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { lessonIdSchema } from "@/lib/contracts/lesson";

type FieldErrors = {
  lessonDate?: string[];
  title?: string[];
};

type FormErrors = {
  fieldErrors: FieldErrors;
  message: string;
};

const initialErrors: FormErrors = { fieldErrors: {}, message: "" };

function readError(body: unknown): FormErrors {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return {
      fieldErrors: {},
      message: "The lesson could not be saved. Please try again.",
    };
  }

  const error = body.error;
  if (!error || typeof error !== "object") {
    return initialErrors;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "The lesson could not be saved. Please try again.";
  const fieldErrors =
    "fieldErrors" in error &&
    error.fieldErrors &&
    typeof error.fieldErrors === "object"
      ? (error.fieldErrors as FieldErrors)
      : {};

  return { fieldErrors, message };
}

export function LessonForm() {
  const router = useRouter();
  const [errors, setErrors] = useState(initialErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = data.get("title");
    const lessonDate = data.get("lessonDate");

    setErrors(initialErrors);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lessons", {
        body: JSON.stringify({
          lessonDate:
            typeof lessonDate === "string" && lessonDate.length > 0
              ? lessonDate
              : null,
          title,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        setErrors(readError(body));
        return;
      }

      const id =
        body && typeof body === "object" && "data" in body
          ? lessonIdSchema.safeParse(
              body.data && typeof body.data === "object" && "id" in body.data
                ? body.data.id
                : undefined,
            )
          : null;

      if (!id?.success) {
        setErrors({
          fieldErrors: {},
          message: "The lesson was saved, but could not be opened.",
        });
        return;
      }

      router.push(`/lessons/${id.data}`);
    } catch {
      setErrors({
        fieldErrors: {},
        message: "The lesson could not be saved. Check the app and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const titleError = errors.fieldErrors.title?.[0];
  const dateError = errors.fieldErrors.lessonDate?.[0];

  return (
    <form
      aria-label="Create lesson"
      className="lesson-form"
      noValidate
      onSubmit={handleSubmit}
    >
      {errors.message ? (
        <p className="form-alert" role="alert">
          {errors.message}
        </p>
      ) : null}

      <div className="form-field">
        <label htmlFor="title">Lesson title</label>
        <input
          aria-describedby={titleError ? "title-error" : "title-help"}
          aria-invalid={Boolean(titleError)}
          autoComplete="off"
          id="title"
          maxLength={120}
          name="title"
          required
          type="text"
        />
        {titleError ? (
          <p className="field-error" id="title-error">
            {titleError}
          </p>
        ) : (
          <p className="field-help" id="title-help">
            Use the topic from class, such as Les salutations.
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="lessonDate">Lesson date (optional)</label>
        <input
          aria-describedby={dateError ? "lesson-date-error" : undefined}
          aria-invalid={Boolean(dateError)}
          id="lessonDate"
          name="lessonDate"
          type="date"
        />
        {dateError ? (
          <p className="field-error" id="lesson-date-error">
            {dateError}
          </p>
        ) : null}
      </div>

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating lesson…" : "Create lesson"}
      </button>
    </form>
  );
}
