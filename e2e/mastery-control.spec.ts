import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("saves mastery choices and restores them after refresh", async ({ page }) => {
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
  await page.getByLabel("Lesson title").fill(`Mastery ${Date.now()}`);
  await page.getByRole("button", { name: "Create lesson" }).click();
  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();

  const draft = {
    schemaVersion: 1,
    title: "Mastery review",
    summary: "A short mastery review.",
    keyPoints: [],
    grammar: [],
    pronunciationFocus: [],
    vocabulary: [
      {
        definiteArticle: null,
        displayForm: "bonjour",
        exampleFrench: null,
        exampleMeaningEn: null,
        french: "bonjour",
        gender: null,
        indefiniteArticle: null,
        meaningEn: "hello",
        partOfSpeech: "expression",
        sourceKind: "source",
      },
    ],
    sentences: [
      {
        french: "Ça va ?",
        meaningEn: "Are you OK?",
        noteEn: null,
        sourceKind: "source",
      },
    ],
  };
  const manualRegion = page.getByRole("region", { name: "Use your own AI tool" });
  await manualRegion
    .getByLabel("Paste structured lesson JSON")
    .fill(JSON.stringify(draft));
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();

  const review = page.getByRole("region", { name: "Mastery review" });
  await review.getByRole("tab", { name: "Vocabulary" }).click();
  const vocabularyMastery = review.getByRole("group", {
    name: "Mastery for bonjour",
  });
  await expect(vocabularyMastery.getByRole("radio", { name: "Not sure" })).toBeChecked();
  await vocabularyMastery
    .getByRole("radio", { name: "Know", exact: true })
    .check();
  await expect(vocabularyMastery.getByRole("status")).toHaveText("Saved as Know.");

  await review.getByRole("tab", { name: "Sentences" }).click();
  const sentenceMastery = review.getByRole("group", {
    name: "Mastery for Ça va ?",
  });
  await sentenceMastery.getByRole("radio", { name: "Don't know" }).check();
  await expect(sentenceMastery.getByRole("status")).toHaveText(
    "Saved as Don't know.",
  );

  await page.reload();
  await review.getByRole("tab", { name: "Vocabulary" }).click();
  await expect(
    review
      .getByRole("group", { name: "Mastery for bonjour" })
      .getByRole("radio", { name: "Know", exact: true }),
  ).toBeChecked();
  await review.getByRole("tab", { name: "Sentences" }).click();
  await expect(
    review
      .getByRole("group", { name: "Mastery for Ça va ?" })
      .getByRole("radio", { name: "Don't know" }),
  ).toBeChecked();

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
