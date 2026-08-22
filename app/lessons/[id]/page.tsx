import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { lessonIdSchema } from "@/lib/contracts/lesson";
import type { Lesson, LessonId } from "@/lib/contracts/lesson";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";

export const metadata: Metadata = {
  title: "Lesson",
};

async function loadLesson(id: LessonId): Promise<Lesson | null> {
  const repository = createLessonRepository();

  try {
    return await repository.findById(id);
  } finally {
    await repository.disconnect();
  }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = lessonIdSchema.safeParse((await params).id);
  if (!result.success) {
    notFound();
  }

  await connection();
  const lesson = await loadLesson(result.data);
  if (!lesson) {
    notFound();
  }

  return (
      <main id="main-content" className="page-shell detail-page" tabIndex={-1}>
        <Link className="back-link" href="/">
          ← All lessons
        </Link>
        <header className="page-header">
          <p className="eyebrow">Lesson</p>
          <h1>{lesson.title}</h1>
          <p className="site-intro">
            This lesson is ready. Adding class notes and PDF material comes next.
          </p>
        </header>
        <section className="next-action" aria-labelledby="next-action-heading">
          <p className="section-label">Next action</p>
          <h2 id="next-action-heading">Return to your lesson list</h2>
          <p>Your lesson has been saved locally and will remain after a restart.</p>
          <Link className="button-link" href="/">
            View all lessons
          </Link>
        </section>
      </main>
  );
}
