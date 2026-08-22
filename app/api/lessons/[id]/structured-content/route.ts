import {
  manualImportResponse,
  manualPromptResponse,
} from "@/lib/ai/manual-lesson-api";
import { PrismaStructuredLessonRepository } from "@/lib/ai/prisma-structured-lesson-repository";
import { lessonIdSchema } from "@/lib/contracts/lesson";

export const runtime = "nodejs";

type StructuredContentRouteContext = {
  params: Promise<{ id: string }>;
};

async function readLessonId(context: StructuredContentRouteContext) {
  return lessonIdSchema.safeParse((await context.params).id);
}

function invalidIdResponse() {
  return Response.json(
    { error: { code: "INVALID_ID", message: "Invalid lesson identifier." } },
    { status: 400 },
  );
}

function createRepository() {
  return new PrismaStructuredLessonRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
}

export async function GET(
  _request: Request,
  context: StructuredContentRouteContext,
): Promise<Response> {
  const id = await readLessonId(context);
  if (!id.success) return invalidIdResponse();

  const repository = createRepository();
  try {
    return await manualPromptResponse(id.data, { repository });
  } finally {
    await repository.disconnect();
  }
}

export async function PUT(
  request: Request,
  context: StructuredContentRouteContext,
): Promise<Response> {
  const id = await readLessonId(context);
  if (!id.success) return invalidIdResponse();

  const repository = createRepository();
  try {
    return await manualImportResponse(request, id.data, { repository });
  } finally {
    await repository.disconnect();
  }
}
