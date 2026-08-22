import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("completes a mixed quiz and restores its results after refresh", async ({
  page,
}) => {
  const title = `Completed quiz ${Date.now()}`;
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
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const lessonPath = new URL(page.url()).pathname;
  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();

  const draft = {
    schemaVersion: 1,
    title: "Quiz review",
    summary: "Greetings and school vocabulary.",
    keyPoints: [],
    grammar: [],
    pronunciationFocus: [],
    sentences: [
      {
        french: "Où est l’école ?",
        meaningEn: "Where is the school?",
        noteEn: null,
        sourceKind: "source",
      },
    ],
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
  };
  const manualRegion = page.getByRole("region", { name: "Use your own AI tool" });
  await manualRegion
    .getByLabel("Paste structured lesson JSON")
    .fill(JSON.stringify(draft));
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();

  const generation = await page.request.post(`/api${lessonPath}/quiz`, {
    data: {},
  });
  expect(generation.ok(), await generation.text()).toBe(true);
  await page.reload();

  const quiz = page.getByRole("region", { name: "Lesson quiz" });
  await quiz.getByRole("radio", { name: "school" }).check();
  await quiz.getByRole("button", { name: "Next question" }).click();
  await quiz.getByRole("radio", { name: "l'" }).check();
  await quiz.getByRole("button", { name: "Next question" }).click();
  await quiz
    .getByRole("textbox", { name: "Translate into English: école" })
    .fill("school");
  await quiz.getByRole("button", { name: "Next question" }).click();
  await quiz
    .getByRole("textbox", { name: "Translate into French: hello" })
    .fill("bonjour");
  await quiz.getByRole("button", { name: "Next question" }).click();

  const expectedOrder = ["Où", "est", "l’école", "?"];
  for (let targetIndex = 0; targetIndex < expectedOrder.length; targetIndex += 1) {
    const tokenTexts = await quiz.locator(".ordering-token").allTextContents();
    const currentIndex = tokenTexts.indexOf(expectedOrder[targetIndex]);
    for (let index = currentIndex; index > targetIndex; index -= 1) {
      const moveLeft = quiz.getByRole("button", {
        name: `Move ${expectedOrder[targetIndex]} at position ${index + 1} left`,
      });
      await moveLeft.focus();
      await moveLeft.press("Enter");
    }
  }

  await expect(quiz.getByText("Correct", { exact: true })).toHaveCount(0);
  await expect(quiz.getByText("Review this one", { exact: true })).toHaveCount(
    0,
  );
  await quiz.getByRole("button", { name: "Submit quiz" }).click();
  await expect(quiz.getByText("5 of 5 correct · 100%")).toBeVisible();
  await expect(quiz.getByText("Correct", { exact: true })).toHaveCount(5);

  await page.reload();
  await expect(quiz.getByText("5 of 5 correct · 100%")).toBeVisible();
  await expect(quiz.getByRole("button", { name: "Submit quiz" })).toHaveCount(0);

  await page.setViewportSize({ height: 900, width: 320 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
