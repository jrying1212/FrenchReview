import { FakeLessonStructurer } from "@/lib/ai/providers/fake-lesson-structurer";

const demoLesson = {
  schemaVersion: 1,
  title: "Demo French A1 review",
  summary:
    "This is deterministic demo content for testing the lesson workflow.",
  vocabulary: [],
  sentences: [],
  grammar: [],
  pronunciationFocus: [],
  keyPoints: ["This demo was not generated from the uploaded PDF."],
} as const;

export function createLessonStructurer(): FakeLessonStructurer {
  return new FakeLessonStructurer({ kind: "success", output: demoLesson });
}
