ALTER TABLE "ReviewItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ReviewItem_lessonId_itemType_position_key" ON "ReviewItem"("lessonId", "itemType", "position");

INSERT INTO "ReviewItem" (
    "id", "lessonId", "structuredItemId", "itemType", "position",
    "status", "lastReviewedAt", "createdAt", "updatedAt"
)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    "Lesson"."id",
    json_extract("item"."value", '$.id'),
    'vocabulary',
    CAST("item"."key" AS INTEGER),
    'learning',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Lesson", json_each("Lesson"."parsedContent", '$.vocabulary') AS "item"
WHERE "Lesson"."parseStatus" = 'ready'
  AND json_type("item"."value", '$.id') = 'text'
UNION ALL
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    "Lesson"."id",
    json_extract("item"."value", '$.id'),
    'sentence',
    CAST("item"."key" AS INTEGER),
    'learning',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Lesson", json_each("Lesson"."parsedContent", '$.sentences') AS "item"
WHERE "Lesson"."parseStatus" = 'ready'
  AND json_type("item"."value", '$.id') = 'text';
