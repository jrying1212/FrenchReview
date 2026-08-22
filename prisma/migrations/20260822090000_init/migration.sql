-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "lessonDate" DATETIME,
    "pdfStorageKey" TEXT,
    "pdfOriginalName" TEXT,
    "rawText" TEXT,
    "parsedContent" JSONB,
    "importStatus" TEXT NOT NULL DEFAULT 'empty',
    "parseStatus" TEXT NOT NULL DEFAULT 'not_started',
    "parseErrorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Lesson_createdAt_id_idx" ON "Lesson"("createdAt", "id");
