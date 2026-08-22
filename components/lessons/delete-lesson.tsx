"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { LessonId } from "@/lib/contracts/lesson";

const deleteResponseSchema = z.object({
  data: z.object({
    cleanupStatus: z.enum(["complete", "cleanup_failed"]),
    deleted: z.literal(true),
  }),
});

type DeleteLessonProps = {
  lessonId: LessonId;
  lessonTitle: string;
};

export function DeleteLesson({ lessonId, lessonTitle }: DeleteLessonProps) {
  const router = useRouter();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isConfirming) confirmButtonRef.current?.focus();
  }, [isConfirming]);

  function cancel() {
    setIsConfirming(false);
    queueMicrotask(() => openButtonRef.current?.focus());
  }

  async function confirmDelete() {
    setIsDeleting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: "DELETE",
      });
      const body: unknown = await response.json();
      const result = deleteResponseSchema.safeParse(body);

      if (!response.ok || !result.success) {
        setMessage("The lesson could not be deleted. Please try again.");
        return;
      }

      if (result.data.data.cleanupStatus === "cleanup_failed") {
        setIsConfirming(false);
        setMessage(
          "The lesson was deleted, but its local PDF could not be removed. Check the app logs before continuing.",
        );
        queueMicrotask(() => openButtonRef.current?.focus());
        return;
      }

      router.push("/");
    } catch {
      setMessage("The lesson could not be deleted. Check the app and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="delete-heading">
      <p className="section-label">Danger zone</p>
      <h2 id="delete-heading">Delete this lesson</h2>
      <p>This permanently removes the lesson and its locally stored material.</p>
      {message ? (
        <p className="form-alert" role="alert">
          {message}
        </p>
      ) : null}

      {!isConfirming ? (
        <button
          className="danger-button"
          onClick={() => setIsConfirming(true)}
          ref={openButtonRef}
          type="button"
        >
          Delete lesson
        </button>
      ) : (
        <div
          aria-describedby="delete-description"
          aria-labelledby="delete-confirmation-heading"
          className="confirmation-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !isDeleting) cancel();
          }}
          role="alertdialog"
        >
          <h3 id="delete-confirmation-heading">Delete “{lessonTitle}”?</h3>
          <p id="delete-description">This action cannot be undone.</p>
          <div className="confirmation-actions">
            <button
              className="danger-button"
              disabled={isDeleting}
              onClick={confirmDelete}
              ref={confirmButtonRef}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="secondary-button"
              disabled={isDeleting}
              onClick={cancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
