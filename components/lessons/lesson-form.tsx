"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

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

const errorResponseSchema = z.object({
  error: z.object({
    fieldErrors: z
      .object({
        lessonDate: z.array(z.string()).optional(),
        title: z.array(z.string()).optional(),
      })
      .optional(),
    message: z.string(),
  }),
});

const successResponseSchema = z.object({
  data: z.object({ id: lessonIdSchema }),
});

function readError(body: unknown): FormErrors {
  const result = errorResponseSchema.safeParse(body);

  if (!result.success) {
    return {
      fieldErrors: {},
      message: "The lesson could not be saved. Please try again.",
    };
  }

  return {
    fieldErrors: result.data.error.fieldErrors ?? {},
    message: result.data.error.message,
  };
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

      const success = successResponseSchema.safeParse(body);

      if (!success.success) {
        setErrors({
          fieldErrors: {},
          message: "The lesson was saved, but could not be opened.",
        });
        return;
      }

      router.push(`/lessons/${success.data.data.id}`);
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
