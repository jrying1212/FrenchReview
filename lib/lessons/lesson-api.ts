import {
  createLessonRequestSchema,
  updateLessonRequestSchema,
} from "@/lib/contracts/lesson";
import type { Lesson, LessonId } from "@/lib/contracts/lesson";
import {
  deleteLessonAndFile,
  type DeleteLessonOptions,
} from "@/lib/lessons/delete-lesson";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";

type LessonApiData = Omit<Lesson, "createdAt" | "lessonDate" | "updatedAt"> & {
  createdAt: string;
  lessonDate: string | null;
  updatedAt: string;
};

function serializeLesson(lesson: Lesson): LessonApiData {
  return {
    ...lesson,
    lessonDate: lesson.lessonDate?.toISOString() ?? null,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export async function createLessonResponse(
  repository: LessonRepository,
  input: unknown,
): Promise<Response> {
  const result = createLessonRequestSchema.safeParse(input);

  if (!result.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields and try again.",
          fieldErrors: result.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  try {
    const lesson = await repository.create(result.data);
    return Response.json({ data: serializeLesson(lesson) }, { status: 201 });
  } catch {
    return Response.json(
      {
        error: {
          code: "PERSISTENCE_ERROR",
          message: "The lesson could not be saved. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}

export async function listLessonsResponse(
  repository: LessonRepository,
): Promise<Response> {
  try {
    const lessons = await repository.list();
    return Response.json({ data: lessons.map(serializeLesson) });
  } catch {
    return Response.json(
      {
        error: {
          code: "PERSISTENCE_ERROR",
          message: "Lessons could not be loaded. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}

export async function getLessonResponse(
  repository: LessonRepository,
  id: LessonId,
): Promise<Response> {
  try {
    const lesson = await repository.findById(id);
    if (!lesson) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Lesson not found." } },
        { status: 404 },
      );
    }

    return Response.json({ data: serializeLesson(lesson) });
  } catch {
    return Response.json(
      {
        error: {
          code: "PERSISTENCE_ERROR",
          message: "The lesson could not be loaded. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}

export async function updateLessonResponse(
  repository: LessonRepository,
  id: LessonId,
  input: unknown,
): Promise<Response> {
  const result = updateLessonRequestSchema.safeParse(input);
  if (!result.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields and try again.",
          fieldErrors: result.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  try {
    const lesson = await repository.update(id, result.data);
    if (!lesson) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Lesson not found." } },
        { status: 404 },
      );
    }

    return Response.json({ data: serializeLesson(lesson) });
  } catch {
    return Response.json(
      {
        error: {
          code: "PERSISTENCE_ERROR",
          message: "The lesson could not be updated. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}

export async function deleteLessonResponse(
  repository: LessonRepository,
  id: LessonId,
  options?: DeleteLessonOptions,
): Promise<Response> {
  try {
    const result = await deleteLessonAndFile(repository, id, options);
    if (result.status === "not_found") {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Lesson not found." } },
        { status: 404 },
      );
    }

    return Response.json({
      data: {
        cleanupStatus:
          result.status === "deleted" ? "complete" : "cleanup_failed",
        deleted: true,
        id,
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "PERSISTENCE_ERROR",
          message: "The lesson could not be deleted. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
