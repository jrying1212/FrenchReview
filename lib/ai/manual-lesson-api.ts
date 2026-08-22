import {
  buildStructureLessonPrompt,
  STRUCTURE_LESSON_PROMPT_VERSION,
} from "@/lib/ai/prompts/structure-lesson";
import {
  replaceStructuredLesson,
  type StructuredLessonRepository,
} from "@/lib/ai/structured-lesson-repository";
import type { LessonId } from "@/lib/contracts/lesson";
import { structuredLessonDraftSchema } from "@/lib/contracts/structured-lesson";

export const MAX_MANUAL_IMPORT_BYTES = 1024 * 1024;

export type ManualLessonSource =
  | { status: "ready"; sourceText: string }
  | { status: "not_found" }
  | { status: "source_not_ready" };

export interface ManualLessonRepository extends StructuredLessonRepository {
  readSource(lessonId: LessonId): Promise<ManualLessonSource>;
}

type ManualLessonDependencies = {
  repository: ManualLessonRepository;
};

const provenance = {
  modelId: "manual-import",
  promptVersion: STRUCTURE_LESSON_PROMPT_VERSION,
  source: "manual",
} as const;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

async function readRequestText(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > MAX_MANUAL_IMPORT_BYTES
  ) {
    return null;
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_MANUAL_IMPORT_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function manualPromptResponse(
  lessonId: LessonId,
  { repository }: ManualLessonDependencies,
): Promise<Response> {
  try {
    const source = await repository.readSource(lessonId);
    if (source.status === "not_found") {
      return errorResponse("LESSON_NOT_FOUND", "Lesson not found.", 404);
    }
    if (source.status === "source_not_ready") {
      return errorResponse(
        "SOURCE_NOT_READY",
        "Import a readable PDF before copying the manual prompt.",
        409,
      );
    }

    return Response.json({
      data: { prompt: buildStructureLessonPrompt(source.sourceText) },
    });
  } catch {
    return errorResponse(
      "PROMPT_EXPORT_FAILED",
      "The manual prompt could not be prepared. Try again.",
      500,
    );
  }
}

export async function manualImportResponse(
  request: Request,
  lessonId: LessonId,
  { repository }: ManualLessonDependencies,
): Promise<Response> {
  let text: string | null;
  try {
    text = await readRequestText(request);
  } catch {
    return errorResponse("INVALID_JSON", "Paste a valid JSON object.", 400);
  }

  if (text === null) {
    return errorResponse(
      "BODY_TOO_LARGE",
      "Pasted JSON must be 1 MiB or smaller.",
      413,
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return errorResponse("INVALID_JSON", "Paste a valid JSON object.", 400);
  }

  const draft = structuredLessonDraftSchema.safeParse(input);
  if (!draft.success) {
    return errorResponse(
      "INVALID_CONTENT",
      "The pasted JSON does not match the lesson schema.",
      422,
    );
  }

  try {
    const lesson = await replaceStructuredLesson({
      draft: draft.data,
      lessonId,
      provenance,
      repository,
    });
    if (!lesson) {
      return errorResponse(
        "IMPORT_CONFLICT",
        "Import a readable PDF before saving manual content.",
        409,
      );
    }

    return Response.json({ data: { lesson, provenance } });
  } catch {
    return errorResponse(
      "IMPORT_FAILED",
      "The manual lesson could not be saved. Try again.",
      500,
    );
  }
}
