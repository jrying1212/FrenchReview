import { lessonIdSchema } from "@/lib/contracts/lesson";
import {
  deleteLessonResponse,
  getLessonResponse,
  updateLessonResponse,
} from "@/lib/lessons/lesson-api";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";

type LessonRouteContext = {
  params: Promise<{ id: string }>;
};

async function readLessonId(context: LessonRouteContext) {
  return lessonIdSchema.safeParse((await context.params).id);
}

function invalidIdResponse(): Response {
  return Response.json(
    {
      error: {
        code: "INVALID_ID",
        message: "Invalid lesson identifier.",
      },
    },
    { status: 400 },
  );
}

export async function GET(
  _request: Request,
  context: LessonRouteContext,
): Promise<Response> {
  const id = await readLessonId(context);
  if (!id.success) return invalidIdResponse();

  const repository = createLessonRepository();
  try {
    return await getLessonResponse(repository, id.data);
  } finally {
    await repository.disconnect();
  }
}

export async function PATCH(
  request: Request,
  context: LessonRouteContext,
): Promise<Response> {
  const id = await readLessonId(context);
  if (!id.success) return invalidIdResponse();

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Send a valid JSON request body.",
        },
      },
      { status: 400 },
    );
  }

  const repository = createLessonRepository();
  try {
    return await updateLessonResponse(repository, id.data, input);
  } finally {
    await repository.disconnect();
  }
}

export async function DELETE(
  _request: Request,
  context: LessonRouteContext,
): Promise<Response> {
  const id = await readLessonId(context);
  if (!id.success) return invalidIdResponse();

  const repository = createLessonRepository();
  try {
    return await deleteLessonResponse(repository, id.data);
  } finally {
    await repository.disconnect();
  }
}
