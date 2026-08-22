import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/app/generated/prisma/client";
import {
  reviewItemSchema,
  type MasteryStatus,
  type ReviewItem,
} from "@/lib/contracts/mastery";

export class PrismaMasteryRepository {
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: { databaseUrl: string }) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async updateStatus(
    id: string,
    status: MasteryStatus,
    now = new Date(),
  ): Promise<ReviewItem | null> {
    return this.#client.$transaction(async (transaction) => {
      const updated = await transaction.reviewItem.updateMany({
        data: { lastReviewedAt: now, status, updatedAt: now },
        where: { id },
      });
      if (updated.count !== 1) return null;
      const item = await transaction.reviewItem.findUnique({ where: { id } });
      return item ? parseReviewItem(item) : null;
    });
  }

  async listWeakItems(): Promise<ReviewItem[]> {
    const rows = await this.#client.reviewItem.findMany({
      include: { lesson: { select: { createdAt: true, lessonDate: true } } },
      where: { status: { in: ["weak", "learning"] } },
    });
    return rows.sort(compareWeakItems).map(parseReviewItem);
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}

type WeakItemRow = Parameters<typeof parseReviewItem>[0] & {
  position: number;
  lesson: { createdAt: Date; lessonDate: Date | null };
};

function compareWeakItems(left: WeakItemRow, right: WeakItemRow) {
  const statusDifference = statusRank(left.status) - statusRank(right.status);
  if (statusDifference !== 0) return statusDifference;

  if (left.lastReviewedAt && right.lastReviewedAt) {
    const reviewedDifference =
      left.lastReviewedAt.getTime() - right.lastReviewedAt.getTime();
    if (reviewedDifference !== 0) return reviewedDifference;
  } else if (left.lastReviewedAt) {
    return -1;
  } else if (right.lastReviewedAt) {
    return 1;
  }

  const leftLessonDate = left.lesson.lessonDate ?? left.lesson.createdAt;
  const rightLessonDate = right.lesson.lessonDate ?? right.lesson.createdAt;
  const lessonDifference = rightLessonDate.getTime() - leftLessonDate.getTime();
  if (lessonDifference !== 0) return lessonDifference;
  if (left.itemType !== right.itemType) {
    return left.itemType === "vocabulary" ? -1 : 1;
  }
  if (left.position !== right.position) return left.position - right.position;
  return left.id.localeCompare(right.id);
}

function statusRank(status: WeakItemRow["status"]) {
  if (status === "weak") return 0;
  if (status === "learning") return 1;
  return 2;
}

function parseReviewItem(item: {
  id: string;
  lessonId: string;
  structuredItemId: string;
  itemType: "vocabulary" | "sentence";
  status: "known" | "learning" | "weak";
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  position?: number;
  lesson?: { createdAt: Date; lessonDate: Date | null };
}): ReviewItem {
  return reviewItemSchema.parse({
    id: item.id,
    lessonId: item.lessonId,
    structuredItemId: item.structuredItemId,
    itemType: item.itemType,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    lastReviewedAt: item.lastReviewedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
  });
}
