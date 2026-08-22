import {
  LessonStructurerError,
  type LessonStructurer,
  type LessonStructurerDiagnostic,
  type LessonStructurerResultCode,
  type StructureLessonInput,
} from "@/lib/ai/lesson-structurer";

export type FakeLessonStructurerScenario =
  | { kind: "success"; output: unknown }
  | { kind: "malformed"; output?: unknown }
  | { kind: "timeout"; providerPayload?: unknown }
  | { kind: "rate_limit"; providerPayload?: unknown };

type DiagnosticSink = (diagnostic: LessonStructurerDiagnostic) => void;

export class FakeLessonStructurer implements LessonStructurer {
  static readonly modelId = "fake-lesson-structurer";

  constructor(
    private readonly scenario: FakeLessonStructurerScenario,
    private readonly recordDiagnostic: DiagnosticSink = () => undefined,
  ) {}

  async structure(input: StructureLessonInput): Promise<unknown> {
    if (this.scenario.kind === "success") {
      return this.scenario.output;
    }

    if (this.scenario.kind === "malformed") {
      return this.scenario.output ?? "{malformed";
    }

    const code: LessonStructurerResultCode =
      this.scenario.kind === "timeout"
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_RATE_LIMIT";
    const diagnostic: LessonStructurerDiagnostic = {
      requestId: input.requestId,
      lessonId: input.lessonId,
      promptVersion: input.prompt.version,
      modelId: FakeLessonStructurer.modelId,
      durationMs: 0,
      resultCode: code,
    };

    this.recordDiagnostic(diagnostic);
    throw new LessonStructurerError(code, diagnostic);
  }
}
