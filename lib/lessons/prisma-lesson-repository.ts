import { randomUUID } from "node:crypto";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/app/generated/prisma/client";
import type { Lesson as LessonRecord } from "@/app/generated/prisma/client";
import type {
  CreateLessonInput,
  Lesson,
  LessonId,
  UpdateLessonInput,
} from "@/lib/contracts/lesson";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";

type PrismaLessonRepositoryOptions = {
  databaseUrl: string;
};

function toLesson(record: LessonRecord): Lesson {
  return {
    ...record,
    id: record.id as LessonId,
    parsedContent: record.parsedContent as Lesson["parsedContent"],
  };
}

export class PrismaLessonRepository implements LessonRepository {
  readonly #client: PrismaClient;

  constructor({ databaseUrl }: PrismaLessonRepositoryOptions) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    this.#client = new PrismaClient({ adapter });
  }

  async create(input: CreateLessonInput): Promise<Lesson> {
    const now = new Date();
    const record = await this.#client.lesson.create({
      data: {
        id: randomUUID(),
        title: input.title,
        lessonDate: input.lessonDate,
        createdAt: now,
        updatedAt: now,
      },
    });

    return toLesson(record);
  }

  async list(): Promise<Lesson[]> {
    const records = await this.#client.lesson.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return records.map(toLesson);
  }

  async findById(id: LessonId): Promise<Lesson | null> {
    const record = await this.#client.lesson.findUnique({ where: { id } });
    return record ? toLesson(record) : null;
  }

  async update(
    id: LessonId,
    input: UpdateLessonInput,
  ): Promise<Lesson | null> {
    const result = await this.#client.lesson.updateMany({
      data: input,
      where: { id },
    });

    return result.count === 0 ? null : this.findById(id);
  }

  async delete(id: LessonId): Promise<boolean> {
    const result = await this.#client.lesson.deleteMany({ where: { id } });
    return result.count > 0;
  }

  async disconnect(): Promise<void> {
    await this.#client.$disconnect();
  }
}
