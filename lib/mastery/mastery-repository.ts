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

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
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
}): ReviewItem {
  return reviewItemSchema.parse({
    ...item,
    createdAt: item.createdAt.toISOString(),
    lastReviewedAt: item.lastReviewedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
  });
}
