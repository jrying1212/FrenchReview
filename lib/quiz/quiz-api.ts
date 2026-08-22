import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { LessonId } from "@/lib/contracts/lesson";
import {
  quizSchema,
  type Quiz,
  type QuizQuestion,
} from "@/lib/contracts/quiz";
import { createDeterministicFakeQuiz } from "@/lib/quiz/generate-quiz";
import type { QuizRepository } from "@/lib/quiz/quiz-repository";

const generateQuizRequestSchema = z.strictObject({
  confirmReplace: z.boolean().default(false),
});

export type QuizClientQuestion =
  | {
      id: string;
      type: "multiple_choice" | "article_blank";
      prompt: string;
      sourceItemIds: string[];
      options: Array<{ id: string; text: string }>;
    }
  | {
      id: string;
      type: "fr_to_en" | "en_to_fr";
      prompt: string;
      sourceItemIds: string[];
    }
  | {
      id: string;
      type: "sentence_ordering";
      prompt: string;
      sourceItemIds: string[];
      tokens: Array<{ id: string; text: string }>;
    };

export type QuizClient = {
  id: string;
  lessonId: string;
  sourceSchemaVersion: number;
  questions: QuizClientQuestion[];
  createdAt: string;
};

export type GenerateQuizErrorCode =
  | "LESSON_NOT_FOUND"
  | "STRUCTURED_LESSON_NOT_READY"
  | "QUIZ_REPLACEMENT_CONFIRMATION_REQUIRED"
  | "QUIZ_GENERATION_CONFLICT"
  | "QUIZ_GENERATION_FAILED";

export class GenerateQuizError extends Error {
  constructor(readonly code: GenerateQuizErrorCode) {
    super(code);
    this.name = "GenerateQuizError";
  }
}

type GenerateQuizDependencies = {
  repository: QuizRepository;
  generateId?: () => string;
  now?: () => Date;
};

export async function generateQuiz(
  input: {
    lessonId: LessonId;
    confirmReplace: boolean;
  } & GenerateQuizDependencies,
): Promise<{ quiz: QuizClient; replaced: boolean }> {
  let source;
  try {
    source = await input.repository.readGenerationSource(input.lessonId);
  } catch {
    throw new GenerateQuizError("QUIZ_GENERATION_FAILED");
  }

  if (source.status === "not_found") {
    throw new GenerateQuizError("LESSON_NOT_FOUND");
  }
  if (source.status === "structured_lesson_not_ready") {
    throw new GenerateQuizError("STRUCTURED_LESSON_NOT_READY");
  }
  if (source.activeQuiz && !input.confirmReplace) {
    throw new GenerateQuizError("QUIZ_REPLACEMENT_CONFIRMATION_REQUIRED");
  }

  const generateId = input.generateId ?? randomUUID;
  let quiz: Quiz;
  try {
    const draft = createDeterministicFakeQuiz(source.lesson, generateId);
    quiz = quizSchema.parse({
      ...draft,
      id: generateId(),
      lessonId: input.lessonId,
      sourceSchemaVersion: source.lesson.schemaVersion,
      createdAt: (input.now ?? (() => new Date()))().toISOString(),
    });
  } catch {
    throw new GenerateQuizError("QUIZ_GENERATION_FAILED");
  }

  let replaced;
  try {
    replaced = await input.repository.replaceActive({
      expectedActiveQuizId: source.activeQuiz?.id ?? null,
      quiz,
    });
  } catch {
    throw new GenerateQuizError("QUIZ_GENERATION_FAILED");
  }
  if (!replaced) throw new GenerateQuizError("QUIZ_GENERATION_CONFLICT");

  return { quiz: toQuizClient(quiz), replaced: source.activeQuiz !== null };
}

export function toQuizClient(quiz: Quiz): QuizClient {
  return {
    createdAt: quiz.createdAt,
    id: quiz.id,
    lessonId: quiz.lessonId,
    questions: quiz.questions.map(toQuizClientQuestion),
    sourceSchemaVersion: quiz.sourceSchemaVersion,
  };
}

function toQuizClientQuestion(question: QuizQuestion): QuizClientQuestion {
  const common = {
    id: question.id,
    prompt: question.prompt,
    sourceItemIds: question.sourceItemIds,
  };

  switch (question.type) {
    case "multiple_choice":
    case "article_blank":
      return { ...common, type: question.type, options: question.options };
    case "fr_to_en":
    case "en_to_fr":
      return { ...common, type: question.type };
    case "sentence_ordering":
      return { ...common, type: question.type, tokens: question.tokens };
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
    }
  }
}

const errorResponses: Record<
  GenerateQuizErrorCode,
  { message: string; status: number }
> = {
  LESSON_NOT_FOUND: { message: "Lesson not found.", status: 404 },
  STRUCTURED_LESSON_NOT_READY: {
    message: "Generate or import structured lesson content first.",
    status: 409,
  },
  QUIZ_REPLACEMENT_CONFIRMATION_REQUIRED: {
    message: "Confirm before replacing the current quiz.",
    status: 409,
  },
  QUIZ_GENERATION_CONFLICT: {
    message: "The current quiz changed. Refresh and try again.",
    status: 409,
  },
  QUIZ_GENERATION_FAILED: {
    message: "The quiz could not be generated from this lesson.",
    status: 422,
  },
};

export async function generateQuizResponse(
  requestInput: unknown,
  lessonId: LessonId,
  dependencies: GenerateQuizDependencies,
): Promise<Response> {
  const request = generateQuizRequestSchema.safeParse(requestInput);
  if (!request.success) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Send only the optional replacement confirmation.",
        },
      },
      { status: 400 },
    );
  }

  try {
    return Response.json({
      data: await generateQuiz({
        ...dependencies,
        confirmReplace: request.data.confirmReplace,
        lessonId,
      }),
    });
  } catch (error) {
    const code =
      error instanceof GenerateQuizError
        ? error.code
        : "QUIZ_GENERATION_FAILED";
    const response = errorResponses[code];
    return Response.json(
      { error: { code, message: response.message } },
      { status: response.status },
    );
  }
}

export async function getQuizResponse(
  lessonId: LessonId,
  dependencies: { repository: QuizRepository },
): Promise<Response> {
  try {
    const result = await dependencies.repository.readActive(lessonId);
    if (result.status === "not_found") {
      return Response.json(
        { error: { code: "LESSON_NOT_FOUND", message: "Lesson not found." } },
        { status: 404 },
      );
    }
    if (result.status === "no_quiz") {
      return Response.json(
        { error: { code: "QUIZ_NOT_FOUND", message: "Generate a quiz first." } },
        { status: 404 },
      );
    }
    return Response.json({ data: { quiz: toQuizClient(result.quiz) } });
  } catch {
    return Response.json(
      {
        error: {
          code: "QUIZ_READ_FAILED",
          message: "The quiz could not be loaded.",
        },
      },
      { status: 500 },
    );
  }
}
