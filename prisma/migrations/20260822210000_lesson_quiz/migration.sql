CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "sourceSchemaVersion" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Quiz_lessonId_isActive_idx" ON "Quiz"("lessonId", "isActive");
CREATE INDEX "Quiz_lessonId_createdAt_id_idx" ON "Quiz"("lessonId", "createdAt", "id");
