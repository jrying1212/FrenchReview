import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("reviews an uncertain item and excludes it after refresh", async ({ page }) => {
  const fixture = join(process.cwd(), "tests/pdf-import/fixtures/french-multipage.pdf");
  const lessonTitle = `Weak review ${Date.now()}`;
  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(lessonTitle);
  await page.getByRole("button", { name: "Create lesson" }).click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const lessonUrl = page.url();
  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();
  const draft = {
    schemaVersion: 1, title: "Greetings", summary: "Greetings.",
    keyPoints: [], grammar: [], pronunciationFocus: [], sentences: [],
    vocabulary: [{
      french: "bonjour", displayForm: "bonjour", meaningEn: "hello",
      partOfSpeech: "expression", gender: null, definiteArticle: null,
      indefiniteArticle: null, exampleFrench: null, exampleMeaningEn: null,
      sourceKind: "source",
    }],
  };
  const manual = page.getByRole("region", { name: "Use your own AI tool" });
  await manual.getByLabel("Paste structured lesson JSON").fill(JSON.stringify(draft));
  await manual.getByRole("button", { name: "Import JSON" }).click();

  await page.goto("/review/weak");
  const lessonGroup = page.getByRole("region", { name: lessonTitle });
  await expect(lessonGroup.getByText("bonjour")).toBeVisible();
  await expect(lessonGroup.getByText("hello")).toBeVisible();
  await expect(lessonGroup.getByRole("button", { name: "Hear bonjour in French" })).toBeVisible();
  await lessonGroup.getByRole("radio", { name: "Know", exact: true }).check();
  await expect(lessonGroup).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: lessonTitle })).toHaveCount(0);

  await page.goto(lessonUrl);
  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
});
