import {
  createLessonResponse,
  listLessonsResponse,
} from "@/lib/lessons/lesson-api";
import { createLessonRepository } from "@/lib/lessons/create-lesson-repository";

export async function GET(): Promise<Response> {
  const repository = createLessonRepository();

  try {
    return await listLessonsResponse(repository);
  } finally {
    await repository.disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
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
    return await createLessonResponse(repository, input);
  } finally {
    await repository.disconnect();
  }
}
