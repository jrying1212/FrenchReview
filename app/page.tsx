import { connection } from "next/server";

import { LessonList } from "@/components/lessons/lesson-list";
import type { Lesson } from "@/lib/contracts/lesson";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";

async function loadLessons(): Promise<Lesson[] | null> {
  const repository = createLessonRepository();

  try {
    return await repository.list();
  } catch {
    return null;
  } finally {
    await repository.disconnect();
  }
}

export default async function Home() {
  await connection();
  const lessons = await loadLessons();

  if (lessons) {
    return (
      <main id="main-content" className="page-shell" tabIndex={-1}>
        <header className="site-header">
          <p className="eyebrow" lang="fr">
            Révision personnelle
          </p>
          <h1>French review</h1>
          <p className="site-intro">
            Turn your class notes into a focused place to review vocabulary,
            sentences, grammar, and pronunciation.
          </p>
        </header>

        <LessonList lessons={lessons} />
      </main>
    );
  }

  return (
      <main id="main-content" className="page-shell" tabIndex={-1}>
        <header className="site-header compact-header">
          <p className="eyebrow" lang="fr">
            Révision personnelle
          </p>
          <h1>French review</h1>
        </header>
        <section className="error-state" role="alert">
          <p className="section-label">Lessons unavailable</p>
          <h2>Your lessons could not be loaded.</h2>
          <p>Check that the local database is ready, then refresh this page.</p>
        </section>
      </main>
  );
}
