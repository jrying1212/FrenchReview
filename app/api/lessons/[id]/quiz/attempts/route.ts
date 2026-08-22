import { lessonIdSchema } from "@/lib/contracts/lesson";
import { PrismaQuizAttemptRepository } from "@/lib/quiz/quiz-attempt-repository";
import { submitQuizAttemptResponse } from "@/lib/quiz/submit-attempt";

export const runtime = "nodejs";

const maximumRequestBytes = 64 * 1_024;

type QuizAttemptRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: QuizAttemptRouteContext,
): Promise<Response> {
  const id = lessonIdSchema.safeParse((await context.params).id);
  if (!id.success) {
    return Response.json(
      { error: { code: "INVALID_ID", message: "Invalid lesson identifier." } },
      { status: 400 },
    );
  }

  const input = await readRequestInput(request);
  const repository = new PrismaQuizAttemptRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  try {
    return await submitQuizAttemptResponse(input, id.data, { repository });
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
