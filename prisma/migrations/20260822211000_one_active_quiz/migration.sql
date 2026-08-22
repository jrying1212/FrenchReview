CREATE UNIQUE INDEX "Quiz_one_active_per_lesson_idx"
ON "Quiz"("lessonId")
WHERE "isActive" = 1;
