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
  readonly modelId = FakeLessonStructurer.modelId;
  readonly inputs: StructureLessonInput[] = [];
  readonly #scenarios: FakeLessonStructurerScenario[];
  #scenarioIndex = 0;

  constructor(
    scenario: FakeLessonStructurerScenario | FakeLessonStructurerScenario[],
    private readonly recordDiagnostic: DiagnosticSink = () => undefined,
  ) {
    this.#scenarios = Array.isArray(scenario) ? scenario : [scenario];
    if (this.#scenarios.length === 0) {
      throw new Error("At least one fake lesson structurer scenario is required.");
    }
  }

  async structure(input: StructureLessonInput): Promise<unknown> {
    this.inputs.push(input);
    const scenario =
      this.#scenarios[
        Math.min(this.#scenarioIndex, this.#scenarios.length - 1)
      ];
    this.#scenarioIndex += 1;

    if (scenario.kind === "success") {
      return scenario.output;
    }

    if (scenario.kind === "malformed") {
      return scenario.output ?? "{malformed";
    }

    const code: LessonStructurerResultCode =
      scenario.kind === "timeout"
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
