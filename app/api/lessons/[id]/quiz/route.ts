import { randomUUID } from "node:crypto";

import { lessonIdSchema } from "@/lib/contracts/lesson";
import {
  generateQuizResponse,
  getQuizResponse,
} from "@/lib/quiz/quiz-api";
import { PrismaQuizRepository } from "@/lib/quiz/quiz-repository";

export const runtime = "nodejs";

const maximumRequestBytes = 1_024;

type QuizRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: QuizRouteContext,
): Promise<Response> {
  const id = lessonIdSchema.safeParse((await context.params).id);
  if (!id.success) return invalidIdResponse();

  const repository = createRepository();
  try {
    return await getQuizResponse(id.data, { repository });
  } finally {
    await repository.disconnect();
  }
}

export async function POST(
  request: Request,
  context: QuizRouteContext,
): Promise<Response> {
  const id = lessonIdSchema.safeParse((await context.params).id);
  if (!id.success) return invalidIdResponse();

  const input = await readRequestInput(request);
  const repository = createRepository();
  try {
    return await generateQuizResponse(input, id.data, {
      generateId: randomUUID,
      repository,
    });
  } finally {
    await repository.disconnect();
  }
}

async function readRequestInput(request: Request): Promise<unknown> {
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
      return { requestTooLarge: true };
    }

    if (!request.body) return {};
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let bytesRead = 0;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maximumRequestBytes) {
        await reader.cancel();
        return { requestTooLarge: true };
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();

    return body.trim().length === 0 ? {} : JSON.parse(body);
  } catch {
    return { invalidJson: true };
  }
}

function createRepository() {
  return new PrismaQuizRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
}

function invalidIdResponse() {
  return Response.json(
    { error: { code: "INVALID_ID", message: "Invalid lesson identifier." } },
    { status: 400 },
  );
}
