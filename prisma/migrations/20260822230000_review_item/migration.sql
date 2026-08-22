CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "structuredItemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'learning',
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReviewItem_lessonId_structuredItemId_key" ON "ReviewItem"("lessonId", "structuredItemId");
CREATE INDEX "ReviewItem_status_lastReviewedAt_createdAt_id_idx" ON "ReviewItem"("status", "lastReviewedAt", "createdAt", "id");
CREATE INDEX "ReviewItem_lessonId_itemType_idx" ON "ReviewItem"("lessonId", "itemType");
