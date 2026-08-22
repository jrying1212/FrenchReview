import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DeleteLesson } from "@/components/lessons/delete-lesson";
import { LessonEditor } from "@/components/lessons/lesson-editor";
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
        <div className="detail-grid">
          <section className="next-action" aria-labelledby="next-action-heading">
            <p className="section-label">Next action</p>
            <h2 id="next-action-heading">Add your class material</h2>
            <p>
              Your lesson is saved locally. PDF import becomes available in the
              next phase.
            </p>
          </section>
          <section className="lesson-status" aria-labelledby="status-heading">
            <p className="section-label">Lesson status</p>
            <h2 id="status-heading">Ready for source material</h2>
            <dl>
              <div>
                <dt>Import</dt>
                <dd>{lesson.importStatus}</dd>
              </div>
              <div>
                <dt>Review structure</dt>
                <dd>{lesson.parseStatus.replace("_", " ")}</dd>
              </div>
            </dl>
          </section>
        </div>
        <LessonEditor lesson={lesson} />
        <DeleteLesson lessonId={lesson.id} lessonTitle={lesson.title} />
      </main>
  );
}
