import type { Metadata } from "next";
import Link from "next/link";

import { LessonForm } from "@/components/lessons/lesson-form";

export const metadata: Metadata = {
  title: "New lesson",
};

export default function NewLessonPage() {
  return (
    <main id="main-content" className="page-shell form-page" tabIndex={-1}>
      <Link className="back-link" href="/">
        ← All lessons
      </Link>
      <header className="page-header">
        <p className="eyebrow">New lesson</p>
        <h1>Create a place to review.</h1>
        <p className="site-intro">
          Start with the class topic. You can add source material after the lesson
          is created.
        </p>
      </header>
      <LessonForm />
    </main>
  );
}
