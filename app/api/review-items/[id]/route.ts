import { PrismaMasteryRepository } from "@/lib/mastery/mastery-repository";
import { updateMasteryResponse } from "@/lib/mastery/update-mastery";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const input = await readBoundedJson(request);

  const repository = new PrismaMasteryRepository({
    databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  try {
    return await updateMasteryResponse((await context.params).id, input, {
      repository,
    });
  } finally {
    await repository.disconnect();
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const maximumBytes = 1_024;
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      return { requestTooLarge: true };
    }
    if (!request.body) return { invalidJson: true };

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let bytesRead = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel();
        return { requestTooLarge: true };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch {
    return { invalidJson: true };
  }
}
