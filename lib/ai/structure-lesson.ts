import { z } from "zod";

import {
  LessonStructurerError,
  type LessonStructurer,
  type LessonStructurerResultCode,
} from "@/lib/ai/lesson-structurer";
import {
  replaceStructuredLesson,
  type LessonStructureOrchestrationRepository,
  type StructuredLessonProvenance,
} from "@/lib/ai/structured-lesson-repository";
import {
  buildStructureLessonPrompt,
  STRUCTURE_LESSON_PROMPT_VERSION,
} from "@/lib/ai/prompts/structure-lesson";
import type { LessonId } from "@/lib/contracts/lesson";
import {
  structuredLessonDraftSchema,
  type StructuredLesson,
} from "@/lib/contracts/structured-lesson";

export type { LessonStructureOrchestrationRepository } from "@/lib/ai/structured-lesson-repository";

export type StructureLessonErrorCode =
  | "LESSON_NOT_FOUND"
  | "SOURCE_NOT_READY"
  | "GENERATION_IN_PROGRESS"
  | "GENERATION_CONFLICT"
  | "INVALID_AI_OUTPUT"
  | LessonStructurerResultCode
  | "GENERATION_FAILED";

export class StructureLessonError extends Error {
  constructor(readonly code: StructureLessonErrorCode) {
    super(code);
    this.name = "StructureLessonError";
  }
}

type StructureLessonDependencies = {
  repository: LessonStructureOrchestrationRepository;
  requestId: string;
  structurer: LessonStructurer;
};

type StructureLessonResult = {
  lesson: StructuredLesson;
  provenance: StructuredLessonProvenance;
};

const requestSchema = z.strictObject({});

const claimErrorCodes = {
  not_found: "LESSON_NOT_FOUND",
  source_not_ready: "SOURCE_NOT_READY",
  already_processing: "GENERATION_IN_PROGRESS",
} as const;

async function recordFailure(
  repository: LessonStructureOrchestrationRepository,
  lessonId: LessonId,
  storageKey: string,
  code: StructureLessonErrorCode,
) {
  try {
    await repository.fail(lessonId, storageKey, code);
  } catch {
    // The safe response code must not be replaced by persistence diagnostics.
  }
}

function schemaErrorPaths(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join(".") || "$"))];
}

export async function structureLesson(
  input: { lessonId: LessonId } & StructureLessonDependencies,
): Promise<StructureLessonResult> {
  let claim;
  try {
    claim = await input.repository.claim(input.lessonId);
  } catch {
    throw new StructureLessonError("GENERATION_FAILED");
  }

  if (claim.status !== "claimed") {
    throw new StructureLessonError(claimErrorCodes[claim.status]);
  }

  const prompt = buildStructureLessonPrompt(claim.sourceText);
  const provenance: StructuredLessonProvenance = {
    source: "fake",
    promptVersion: STRUCTURE_LESSON_PROMPT_VERSION,
    modelId: input.structurer.modelId,
  };
  let repair: { schemaErrorPaths: string[] } | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let output: unknown;
    try {
      output = await input.structurer.structure({
        lessonId: input.lessonId,
        prompt,
        requestId: input.requestId,
        ...(repair ? { repair } : {}),
      });
    } catch (error) {
      const code =
        error instanceof LessonStructurerError
          ? error.code
          : "GENERATION_FAILED";
      await recordFailure(input.repository, input.lessonId, claim.storageKey, code);
      throw new StructureLessonError(code);
    }

    const parsed = structuredLessonDraftSchema.safeParse(output);
    if (!parsed.success) {
      repair = { schemaErrorPaths: schemaErrorPaths(parsed.error) };
      continue;
    }

    try {
      const lesson = await replaceStructuredLesson({
        lessonId: input.lessonId,
        draft: parsed.data,
        guard: { parseStatus: "processing", storageKey: claim.storageKey },
        provenance,
        repository: input.repository,
      });
      if (!lesson) throw new StructureLessonError("GENERATION_CONFLICT");
      return { lesson, provenance };
    } catch (error) {
      if (error instanceof StructureLessonError) throw error;
      await recordFailure(
        input.repository,
        input.lessonId,
        claim.storageKey,
        "GENERATION_FAILED",
      );
      throw new StructureLessonError("GENERATION_FAILED");
    }
  }

  await recordFailure(
    input.repository,
    input.lessonId,
    claim.storageKey,
    "INVALID_AI_OUTPUT",
  );
  throw new StructureLessonError("INVALID_AI_OUTPUT");
}

const errorResponses: Record<
  StructureLessonErrorCode,
  { message: string; status: number }
> = {
  LESSON_NOT_FOUND: { message: "Lesson not found.", status: 404 },
  SOURCE_NOT_READY: {
    message: "Import a readable PDF before generating a lesson.",
    status: 409,
  },
  GENERATION_IN_PROGRESS: {
    message: "Lesson generation is already in progress.",
    status: 409,
  },
  GENERATION_CONFLICT: {
    message: "The lesson source changed. Refresh and try again.",
    status: 409,
  },
  INVALID_AI_OUTPUT: {
    message: "The generated lesson was invalid. Try again.",
    status: 502,
  },
  PROVIDER_TIMEOUT: {
    message: "Lesson generation timed out. Try again.",
    status: 504,
  },
  PROVIDER_RATE_LIMIT: {
    message: "Lesson generation is temporarily unavailable. Try again.",
    status: 429,
  },
  GENERATION_FAILED: {
    message: "The lesson could not be generated. Try again.",
    status: 500,
  },
};

export async function structureLessonResponse(
  requestInput: unknown,
  lessonId: LessonId,
  dependencies: StructureLessonDependencies,
): Promise<Response> {
  if (!requestSchema.safeParse(requestInput).success) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Do not send lesson text or prompts with this request.",
        },
      },
      { status: 400 },
    );
  }

  try {
    return Response.json({
      data: await structureLesson({ lessonId, ...dependencies }),
    });
  } catch (error) {
    const code =
      error instanceof StructureLessonError
        ? error.code
        : "GENERATION_FAILED";
    const response = errorResponses[code];
    return Response.json(
      { error: { code, message: response.message } },
      { status: response.status },
    );
  }
}
