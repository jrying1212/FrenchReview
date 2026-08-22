import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("speaks exact French text, replays, stops, and cancels on tab change", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: Array<Record<string, unknown>> = [];
    class TestUtterance {
      lang = "";
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      voice: { default: boolean; lang: string; name: string } | null = null;
      constructor(readonly text: string) {}
    }
    const voices = [
      { default: true, lang: "en-US", name: "English" },
      { default: false, lang: "fr-FR", name: "French" },
    ];
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: TestUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        addEventListener() {},
        cancel() {
          calls.push({ kind: "cancel" });
        },
        getVoices() {
          return voices;
        },
        removeEventListener() {},
        speak(utterance: TestUtterance) {
          calls.push({
            kind: "speak",
            lang: utterance.lang,
            text: utterance.text,
            voiceLang: utterance.voice?.lang,
          });
        },
      },
    });
    Object.defineProperty(window, "__speechCalls", { value: calls });
  });

  const title = `Speech review ${Date.now()}`;
  const fixture = join(
    process.cwd(),
    "tests/pdf-import/fixtures/french-multipage.pdf",
  );
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(title);
  await page.getByRole("button", { name: "Create lesson" }).click();
  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();
  const manualRegion = page.getByRole("region", { name: "Use your own AI tool" });
  await manualRegion.getByLabel("Paste structured lesson JSON").fill(
    JSON.stringify({
      pronunciationFocus: [
        {
          noteEn: "The final s is silent.",
          sourceKind: "source",
          text: "vous",
        },
      ],
      schemaVersion: 1,
      sentences: [
        {
          french: "Où est l’école ?",
          meaningEn: "Where is the school?",
          noteEn: null,
          sourceKind: "source",
        },
        {
          french: "Bonjour, comment allez-vous aujourd’hui ?",
          meaningEn: "Hello, how are you today?",
          noteEn: null,
          sourceKind: "source",
        },
      ],
      summary: "Pronunciation and sentence review.",
      title: "French speech review",
    }),
  );
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();

  const review = page.getByRole("region", { name: "French speech review" });
  const hearVous = review.getByRole("button", { name: "Hear vous in French" });
  await expect(hearVous).toBeEnabled();
  await hearVous.click();
  await expect(review.getByRole("status")).toHaveText("Playing vous in French.");
  await expect(
    review.getByRole("button", { name: "Stop French playback" }),
  ).toBeVisible();
  await hearVous.click();

  const callsAfterReplay = await page.evaluate(
    () =>
      (window as unknown as { __speechCalls: Array<Record<string, unknown>> })
        .__speechCalls,
  );
  expect(callsAfterReplay.filter((call) => call.kind === "speak")).toEqual([
    { kind: "speak", lang: "fr-FR", text: "vous", voiceLang: "fr-FR" },
    { kind: "speak", lang: "fr-FR", text: "vous", voiceLang: "fr-FR" },
  ]);

  await review.getByRole("tab", { name: "Sentences" }).click();
  const hearSentence = review.getByRole("button", {
    name: "Hear Où est l’école ? in French",
  });
  const hearLongSentence = review.getByRole("button", {
    name: "Hear Bonjour, comment allez-vous aujourd’hui ? in French",
  });
  const desktopPositions = await Promise.all([
    hearSentence.boundingBox(),
    hearLongSentence.boundingBox(),
  ]);
  expect(desktopPositions[0]?.x).toBe(desktopPositions[1]?.x);
  await hearSentence.click();
  const finalCalls = await page.evaluate(
    () =>
      (window as unknown as { __speechCalls: Array<Record<string, unknown>> })
        .__speechCalls,
  );
  expect(finalCalls.at(-1)).toEqual({
    kind: "speak",
    lang: "fr-FR",
    text: "Où est l’école ?",
    voiceLang: "fr-FR",
  });
  expect(finalCalls.filter((call) => call.kind === "cancel").length).toBeGreaterThanOrEqual(3);

  await page.setViewportSize({ height: 900, width: 320 });
  await expect(hearSentence).toBeVisible();
  const mobilePositions = await Promise.all([
    hearSentence.boundingBox(),
    hearLongSentence.boundingBox(),
  ]);
  expect(mobilePositions[0]?.x).toBe(mobilePositions[1]?.x);
  await review.getByRole("button", { name: "Stop French playback" }).click();
  await expect(
    review.getByRole("button", { name: "Stop French playback" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
