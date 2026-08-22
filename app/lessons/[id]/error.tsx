"use client";

import { useEffect } from "react";

export default function LessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Lesson detail failed to load.", {
      code: "LESSON_DETAIL_LOAD_FAILED",
      digest: error.digest,
    });
  }, [error]);

  return (
    <main id="main-content" className="page-shell state-page" tabIndex={-1}>
      <section className="error-state" role="alert">
        <p className="section-label">Lesson unavailable</p>
        <h1>This lesson could not be loaded.</h1>
        <p>Check the local app, then try loading the lesson again.</p>
        <button className="primary-button" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
