import Link from "next/link";
import { connection } from "next/server";

import { WeakItemList } from "@/components/review/weak-item-list";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";
import { groupWeakItems } from "@/lib/mastery/list-weak-items";
import { PrismaMasteryRepository } from "@/lib/mastery/mastery-repository";

export default async function WeakReviewPage() {
  await connection();
  const lessonsRepository = createLessonRepository();
  const masteryRepository = new PrismaMasteryRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  try {
    const [items, lessons] = await Promise.all([
      masteryRepository.listWeakItems(),
      lessonsRepository.list(),
    ]);
    return (
      <main id="main-content" className="page-shell" tabIndex={-1}>
        <Link className="back-link" href="/">← All lessons</Link>
        <header className="page-header">
          <p className="eyebrow">Focused review</p>
          <h1>Review weak items</h1>
          <p className="site-intro">Start with what needs the most attention.</p>
        </header>
        <WeakItemList groups={groupWeakItems(items, lessons)} />
      </main>
    );
  } finally {
    await Promise.all([
      masteryRepository.disconnect(),
      lessonsRepository.disconnect(),
    ]);
  }
}
