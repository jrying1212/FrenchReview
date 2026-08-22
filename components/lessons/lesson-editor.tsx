"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import type { Lesson } from "@/lib/contracts/lesson";

type FieldErrors = {
  lessonDate?: string[];
  title?: string[];
};

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
  data: z.object({
    lessonDate: z.string().nullable(),
    title: z.string(),
  }),
});

export function LessonEditor({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [lessonDate, setLessonDate] = useState(
    lesson.lessonDate?.toISOString().slice(0, 10) ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setMessage("");
    setIsError(false);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        body: JSON.stringify({
          lessonDate: lessonDate || null,
          title,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const error = errorResponseSchema.safeParse(body);
        setIsError(true);
        setFieldErrors(error.success ? (error.data.error.fieldErrors ?? {}) : {});
        setMessage(
          error.success
            ? error.data.error.message
            : "The lesson could not be updated. Please try again.",
        );
        return;
      }

      const result = successResponseSchema.safeParse(body);
      if (!result.success) {
        setIsError(true);
        setMessage("The lesson was updated, but the response was invalid.");
        return;
      }

      setTitle(result.data.data.title);
      setLessonDate(result.data.data.lessonDate?.slice(0, 10) ?? "");
      setMessage("Lesson updated.");
      setIsError(false);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("The lesson could not be updated. Check the app and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const titleError = fieldErrors.title?.[0];
  const dateError = fieldErrors.lessonDate?.[0];
  return (
    <form className="lesson-form" onSubmit={handleSubmit} noValidate>
      <h2>Edit lesson details</h2>
      {message ? (
        <p
          className={isError ? "form-alert" : "form-status"}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <div className="form-field">
        <label htmlFor="edit-title">Lesson title</label>
        <input
          aria-describedby={titleError ? "edit-title-error" : undefined}
          aria-invalid={Boolean(titleError)}
          id="edit-title"
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          required
          type="text"
          value={title}
        />
        {titleError ? (
          <p className="field-error" id="edit-title-error">
            {titleError}
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="edit-lesson-date">Lesson date (optional)</label>
        <input
          aria-describedby={dateError ? "edit-lesson-date-error" : undefined}
          aria-invalid={Boolean(dateError)}
          id="edit-lesson-date"
          onChange={(event) => setLessonDate(event.target.value)}
          type="date"
          value={lessonDate}
        />
        {dateError ? (
          <p className="field-error" id="edit-lesson-date-error">
            {dateError}
          </p>
        ) : null}
      </div>
      <button className="primary-button" disabled={isSaving} type="submit">
        {isSaving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
