import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("renders a responsive French-first study review with keyboard tabs", async ({
  page,
}) => {
  const title = `Study review ${Date.now()}`;
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

  const draft = {
    grammar: [
      {
        examples: [
          {
            french: "Elle est étudiante.",
            meaningEn: "She is a student.",
            sourceKind: "additional_example",
          },
        ],
        explanationEn: "Use être to identify someone.",
        topic: "The verb être",
      },
    ],
    keyPoints: ["Use bonjour for a polite greeting."],
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
    ],
    summary: "Greetings and asking where the school is.",
    title: "Les salutations",
    vocabulary: [
      {
        definiteArticle: "l'",
        displayForm: "l’école",
        exampleFrench: null,
        exampleMeaningEn: null,
        french: "école",
        gender: "feminine",
        indefiniteArticle: "une",
        meaningEn: "school",
        partOfSpeech: "noun",
        sourceKind: "source",
      },
    ],
  };
  const manualRegion = page.getByRole("region", { name: "Use your own AI tool" });
  await manualRegion.getByLabel("Paste structured lesson JSON").fill(
    JSON.stringify(draft),
  );
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();

  const review = page.getByRole("region", { name: "Les salutations" });
  await expect(review.getByText(draft.summary)).toBeVisible();
  await expect(review.getByText("vous")).toBeVisible();
  await expect(review.getByText("From lesson")).toBeVisible();

  const overviewTab = review.getByRole("tab", { name: "Overview" });
  await overviewTab.focus();
  await overviewTab.press("ArrowRight");
  await expect(review.getByRole("tab", { name: "Vocabulary" })).toBeFocused();
  await expect(review.getByText("l’école")).toBeVisible();
  await expect(review.getByText("feminine")).toBeVisible();
  await review.getByRole("tab", { name: "Vocabulary" }).press("ArrowRight");
  await expect(review.getByText("Où est l’école ?")).toBeVisible();
  await review.getByRole("tab", { name: "Sentences" }).press("End");
  await expect(review.getByText("Elle est étudiante.")).toBeVisible();
  await expect(review.getByText("Additional example")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Les salutations" })).toBeVisible();
  await page.setViewportSize({ height: 900, width: 320 });
  await expect(review.getByRole("tab", { name: "Overview" })).toBeVisible();
  await review.getByRole("tab", { name: "Overview" }).focus();
  await review.getByRole("tab", { name: "Overview" }).press("End");
  await expect(review.getByRole("tab", { name: "Grammar" })).toBeFocused();
  await expect(review.getByText("Elle est étudiante.")).toBeVisible();

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
