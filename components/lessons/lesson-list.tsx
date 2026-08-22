import Link from "next/link";

import type { Lesson } from "@/lib/contracts/lesson";

type LessonListProps = {
  lessons: Lesson[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function LessonList({ lessons }: LessonListProps) {
  if (lessons.length === 0) {
    return (
      <section className="empty-state" aria-labelledby="lessons-heading">
        <div>
          <p className="section-label">Lessons</p>
          <h2 id="lessons-heading">Your lessons will live here.</h2>
          <p>
            Add a class topic and optional date to start building your personal
            French review library.
          </p>
          <Link className="text-link" href="/lessons/new">
            Create your first lesson
          </Link>
        </div>
        <span className="lesson-marker" aria-hidden="true">
          01
        </span>
      </section>
    );
  }

  return (
    <section className="lessons-section" aria-labelledby="lessons-heading">
      <div className="section-heading-row">
        <div>
          <p className="section-label">Lessons</p>
          <h2 id="lessons-heading">Continue your review</h2>
        </div>
        <div className="lesson-list-actions">
          <Link className="text-link" href="/review/weak">Review weak items</Link>
          <Link className="button-link" href="/lessons/new">New lesson</Link>
        </div>
      </div>
      <ol className="lesson-list">
        {lessons.map((lesson, index) => (
          <li className="lesson-row" key={lesson.id}>
            <span className="lesson-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <Link className="lesson-title" href={`/lessons/${lesson.id}`}>
                {lesson.title}
              </Link>
              <p className="lesson-date">
                {lesson.lessonDate
                  ? dateFormatter.format(lesson.lessonDate)
                  : "No lesson date"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
