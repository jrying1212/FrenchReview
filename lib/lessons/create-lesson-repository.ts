import { PrismaLessonRepository } from "@/lib/lessons/prisma-lesson-repository";

export function createLessonRepository(): PrismaLessonRepository {
  return new PrismaLessonRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
}
