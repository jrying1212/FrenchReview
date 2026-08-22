ALTER TABLE "ReviewItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ReviewItem_lessonId_itemType_position_key" ON "ReviewItem"("lessonId", "itemType", "position");
