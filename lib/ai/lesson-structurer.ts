export type StructureLessonPrompt = {
  version: string;
  system: string;
  user: string;
  responseSchema: Record<string, unknown>;
};

export type StructureLessonInput = {
  requestId: string;
  lessonId: string;
  prompt: StructureLessonPrompt;
};

export type LessonStructurerResultCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT";

export type LessonStructurerDiagnostic = {
  requestId: string;
  lessonId: string;
  promptVersion: string;
  modelId: string;
  durationMs: number;
  resultCode: LessonStructurerResultCode;
};

export interface LessonStructurer {
  structure(input: StructureLessonInput): Promise<unknown>;
}

export class LessonStructurerError extends Error {
  constructor(
    readonly code: LessonStructurerResultCode,
    readonly diagnostic: LessonStructurerDiagnostic,
  ) {
    super(code);
    this.name = "LessonStructurerError";
  }
}
