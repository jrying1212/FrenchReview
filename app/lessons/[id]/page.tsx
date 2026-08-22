import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DeleteLesson } from "@/components/lessons/delete-lesson";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { GenerationStatus } from "@/components/ai/generation-status";
import { ManualLessonImport } from "@/components/ai/manual-lesson-import";
import { ExtractedText } from "@/components/pdf/extracted-text";
import { PdfUpload } from "@/components/pdf/pdf-upload";
import { Quiz } from "@/components/quiz/quiz";
import { LessonTabs } from "@/components/review/lesson-tabs";
import { lessonIdSchema } from "@/lib/contracts/lesson";
import type { Lesson, LessonId } from "@/lib/contracts/lesson";
import { structuredLessonSchema } from "@/lib/contracts/structured-lesson";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";
import { toQuizClient, type QuizClient } from "@/lib/quiz/quiz-api";
import { PrismaQuizRepository } from "@/lib/quiz/quiz-repository";

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

async function loadQuiz(id: LessonId): Promise<QuizClient | null> {
  const repository = new PrismaQuizRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });

  try {
    const result = await repository.readActive(id);
    return result.status === "ready" ? toQuizClient(result.quiz) : null;
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
  const structuredLesson = structuredLessonSchema.safeParse(
    lesson.parsedContent,
  );
  const quiz = await loadQuiz(result.data);

  return (
      <main id="main-content" className="page-shell detail-page" tabIndex={-1}>
        <Link className="back-link" href="/">
          ← All lessons
        </Link>
        <header className="page-header">
          <p className="eyebrow">Lesson</p>
          <h1>{lesson.title}</h1>
          <p className="site-intro">
            Add your teacher&apos;s PDF, check the extracted text, and keep the
            source ready for review.
          </p>
        </header>
        <div className="detail-grid">
          <section className="next-action" aria-labelledby="next-action-heading">
            <p className="section-label">Next action</p>
            <h2 id="next-action-heading">Add your class material</h2>
            <p>
              {lesson.importStatus === "ready"
                ? "Your PDF is stored locally. Generate demo content or use the no-API manual workflow."
                : "Choose a text-based PDF to establish the source for this lesson."}
            </p>
          </section>
          <section className="lesson-status" aria-labelledby="status-heading">
            <p className="section-label">Lesson status</p>
            <h2 id="status-heading">
              {lesson.importStatus === "ready"
                ? "Source material ready"
                : "Ready for source material"}
            </h2>
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
        <PdfUpload
          hasPdf={Boolean(lesson.pdfStorageKey)}
          lessonId={lesson.id}
          originalName={lesson.pdfOriginalName}
        />
        {lesson.rawText ? <ExtractedText text={lesson.rawText} /> : null}
        <GenerationStatus
          contentSource={lesson.structuredContentSource}
          contentTitle={
            structuredLesson.success ? structuredLesson.data.title : null
          }
          isSourceReady={lesson.importStatus === "ready"}
          lessonId={lesson.id}
          parseErrorCode={lesson.parseErrorCode}
          parseStatus={lesson.parseStatus}
        />
        <ManualLessonImport
          contentSource={lesson.structuredContentSource}
          contentTitle={
            structuredLesson.success ? structuredLesson.data.title : null
          }
          isSourceReady={lesson.importStatus === "ready"}
          lessonId={lesson.id}
          sourceKey={lesson.pdfStorageKey}
        />
        {structuredLesson.success ? (
          <LessonTabs lesson={structuredLesson.data} />
        ) : null}
        <Quiz quiz={quiz} />
        <LessonEditor lesson={lesson} />
        <DeleteLesson lessonId={lesson.id} lessonTitle={lesson.title} />
      </main>
  );
}
