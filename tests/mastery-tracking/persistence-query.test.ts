import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  masteryLabels,
  reviewItemSchema,
  updateMasterySchema,
} from "@/lib/contracts/mastery";
import { PrismaMasteryRepository } from "@/lib/mastery/mastery-repository";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function createMasteryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "french-review-mastery-"));
  const databasePath = join(directory, "test.db");
  const migrations = await Promise.all(
    [
      "20260822090000_init",
      "20260822230000_review_item",
      "20260822231000_review_item_position",
    ].map((name) =>
      readFile(join(process.cwd(), "prisma/migrations", name, "migration.sql"), "utf8"),
    ),
  );
  const database = new Database(databasePath);
  database.exec(migrations.join("\n"));
  database
    .prepare(
      `INSERT INTO Lesson (id, title, importStatus, parseStatus, createdAt, updatedAt)
       VALUES (?, ?, 'ready', 'ready', ?, ?)`,
    )
    .run(
      "20000000-0000-4000-8000-000000000000",
      "Lesson",
      "2026-08-22T08:00:00.000Z",
      "2026-08-22T08:00:00.000Z",
    );
  database
    .prepare(
      `INSERT INTO ReviewItem
       (id, lessonId, structuredItemId, itemType, position, status, createdAt, updatedAt)
       VALUES (?, ?, ?, 'vocabulary', 0, 'learning', ?, ?)`,
    )
    .run(
      "10000000-0000-4000-8000-000000000000",
      "20000000-0000-4000-8000-000000000000",
      "30000000-0000-4000-8000-000000000000",
      "2026-08-22T09:00:00.000Z",
      "2026-08-22T09:00:00.000Z",
    );
  database.close();
  temporaryDirectories.push(directory);
  return `file:${databasePath}`;
}

describe("mastery contracts", () => {
  it("accepts the three approved statuses with exhaustive labels", () => {
    expect(masteryLabels).toEqual({
      known: "Know",
      learning: "Not sure",
      weak: "Don't know",
    });
    expect(updateMasterySchema.parse({ status: "learning" })).toEqual({
      status: "learning",
    });
  });

  it("rejects unknown mutation fields and invalid states", () => {
    expect(updateMasterySchema.safeParse({ status: "new" }).success).toBe(false);
    expect(
      updateMasterySchema.safeParse({ status: "known", lessonId: "private" })
        .success,
    ).toBe(false);
  });

  it("requires server timestamps and nullable initial review time", () => {
    expect(
      reviewItemSchema.parse({
        id: "10000000-0000-4000-8000-000000000000",
        lessonId: "20000000-0000-4000-8000-000000000000",
        structuredItemId: "30000000-0000-4000-8000-000000000000",
        itemType: "vocabulary",
        status: "learning",
        lastReviewedAt: null,
        createdAt: "2026-08-22T09:00:00.000Z",
        updatedAt: "2026-08-22T09:00:00.000Z",
      }).status,
    ).toBe("learning");
  });
});

describe("mastery persistence", () => {
  it("backfills items for structured lessons that predate the mastery migration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "french-review-backfill-"));
    const databasePath = join(directory, "test.db");
    const [initial, reviewItems, positions] = await Promise.all(
      [
        "20260822090000_init",
        "20260822230000_review_item",
        "20260822231000_review_item_position",
      ].map((name) =>
        readFile(
          join(process.cwd(), "prisma/migrations", name, "migration.sql"),
          "utf8",
        ),
      ),
    );
    const database = new Database(databasePath);
    database.exec(initial);
    database
      .prepare(
        `INSERT INTO Lesson
         (id, title, parsedContent, importStatus, parseStatus, createdAt, updatedAt)
         VALUES (?, 'Existing', ?, 'ready', 'ready', ?, ?)`,
      )
      .run(
        "20000000-0000-4000-8000-000000000000",
        JSON.stringify({
          vocabulary: [{ id: "30000000-0000-4000-8000-000000000000" }],
          sentences: [{ id: "40000000-0000-4000-8000-000000000000" }],
        }),
        "2026-08-22T08:00:00.000Z",
        "2026-08-22T08:00:00.000Z",
      );
    database.exec(`${reviewItems}\n${positions}`);
    const rows = database
      .prepare("SELECT itemType, position, status FROM ReviewItem ORDER BY itemType")
      .all();
    database.close();
    temporaryDirectories.push(directory);

    expect(rows).toEqual([
      { itemType: "sentence", position: 0, status: "learning" },
      { itemType: "vocabulary", position: 0, status: "learning" },
    ]);
  });

  it("updates status with one server-owned review timestamp", async () => {
    const repository = new PrismaMasteryRepository({
      databaseUrl: await createMasteryDatabase(),
    });
    const reviewedAt = new Date("2026-08-22T10:30:00.000Z");

    const item = await repository.updateStatus(
      "10000000-0000-4000-8000-000000000000",
      "weak",
      reviewedAt,
    );
    await repository.disconnect();

    expect(item).toMatchObject({
      status: "weak",
      lastReviewedAt: reviewedAt.toISOString(),
      updatedAt: reviewedAt.toISOString(),
    });
  });

  it("does not create a missing review item", async () => {
    const repository = new PrismaMasteryRepository({
      databaseUrl: await createMasteryDatabase(),
    });

    await expect(
      repository.updateStatus(
        "90000000-0000-4000-8000-000000000000",
        "known",
      ),
    ).resolves.toBeNull();
    await repository.disconnect();
  });

  it("orders weak before learning and excludes known items", async () => {
    const databaseUrl = await createMasteryDatabase();
    const database = new Database(databaseUrl.slice("file:".length));
    database
      .prepare(
        `UPDATE ReviewItem SET status = 'weak', lastReviewedAt = ? WHERE id = ?`,
      )
      .run(
        "2026-08-22T10:00:00.000Z",
        "10000000-0000-4000-8000-000000000000",
      );
    const insert = database.prepare(
      `INSERT INTO ReviewItem
       (id, lessonId, structuredItemId, itemType, position, status, createdAt, updatedAt)
       VALUES (?, '20000000-0000-4000-8000-000000000000', ?, 'vocabulary', ?, ?, ?, ?)`,
    );
    insert.run(
      "40000000-0000-4000-8000-000000000000",
      "50000000-0000-4000-8000-000000000000",
      1,
      "learning",
      "2026-08-22T09:01:00.000Z",
      "2026-08-22T09:01:00.000Z",
    );
    insert.run(
      "60000000-0000-4000-8000-000000000000",
      "70000000-0000-4000-8000-000000000000",
      2,
      "known",
      "2026-08-22T09:02:00.000Z",
      "2026-08-22T09:02:00.000Z",
    );
    database.close();
    const repository = new PrismaMasteryRepository({ databaseUrl });

    const items = await repository.listWeakItems();
    await repository.disconnect();

    expect(items.map((item) => item.status)).toEqual(["weak", "learning"]);
    expect(items.map((item) => item.id)).not.toContain(
      "60000000-0000-4000-8000-000000000000",
    );
  });
});
