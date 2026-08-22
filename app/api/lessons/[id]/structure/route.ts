import { randomUUID } from "node:crypto";

import { createLessonStructurer } from "@/lib/ai/providers";
import { PrismaStructuredLessonRepository } from "@/lib/ai/prisma-structured-lesson-repository";
import { structureLessonResponse } from "@/lib/ai/structure-lesson";
import { lessonIdSchema } from "@/lib/contracts/lesson";

export const runtime = "nodejs";

type StructureRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: StructureRouteContext,
): Promise<Response> {
  const id = lessonIdSchema.safeParse((await context.params).id);
  if (!id.success) {
    return Response.json(
      { error: { code: "INVALID_ID", message: "Invalid lesson identifier." } },
      { status: 400 },
    );
  }

  let input: unknown = {};
  const body = await request.text();
  if (body.trim().length > 0) {
    try {
      input = JSON.parse(body);
    } catch {
      input = { invalidJson: true };
    }
  }

  const repository = new PrismaStructuredLessonRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });

  try {
    return await structureLessonResponse(input, id.data, {
      repository,
      requestId: randomUUID(),
      structurer: createLessonStructurer(),
    });
  } finally {
    await repository.disconnect();
  }
}
