import { useEffect, useState } from "react";
import { z } from "zod";

import type { LessonId } from "@/lib/contracts/lesson";

const promptResponseSchema = z.object({
  data: z.object({
    prompt: z.object({
      responseSchema: z.unknown(),
      system: z.string(),
      user: z.string(),
      version: z.string(),
    }),
  }),
});

export function useManualLessonPrompt(
  isSourceReady: boolean,
  lessonId: LessonId,
  sourceKey: string | null,
) {
  const [result, setResult] = useState<{
    error: string;
    prompt: { schema: string; text: string } | null;
    sourceKey: string;
  } | null>(null);

  useEffect(() => {
    if (!isSourceReady || !sourceKey) return;
    const controller = new AbortController();

    void fetch(`/api/lessons/${lessonId}/structured-content`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        const result = promptResponseSchema.safeParse(body);
        if (!response.ok || !result.success) throw new Error("invalid response");
        setResult({
          error: "",
          prompt: {
            schema: JSON.stringify(
              result.data.data.prompt.responseSchema,
              null,
              2,
            ),
            text: `${result.data.data.prompt.system}\n\n${result.data.data.prompt.user}`,
          },
          sourceKey,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({
          error: "The manual prompt could not be prepared. Refresh and try again.",
          prompt: null,
          sourceKey,
        });
      });

    return () => controller.abort();
  }, [isSourceReady, lessonId, sourceKey]);

  return {
    prompt: result?.sourceKey === sourceKey ? result.prompt : null,
    promptError: result?.sourceKey === sourceKey ? result.error : "",
  };
}
