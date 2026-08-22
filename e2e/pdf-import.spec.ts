import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("uploads, previews, replaces, and preserves PDF text after refresh", async ({
  page,
}) => {
  const title = `PDF import ${Date.now()}`;
  const fixture = join(
    process.cwd(),
    "tests/pdf-import/fixtures/french-multipage.pdf",
  );
  const browserErrors: string[] = [];
  const missingResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404) missingResponses.push(response.url());
  });

  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(title);
  await page.getByRole("button", { name: "Create lesson" }).click();

  await page.getByLabel("PDF file").setInputFiles({
    buffer: Buffer.from("%PDF-not-valid"),
    mimeType: "application/pdf",
    name: "malformed.pdf",
  });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText("Choose a valid PDF file.", { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([expect.stringContaining("422")]);
  browserErrors.length = 0;

  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByRole("heading", { name: "Extracted text" })).toBeVisible();
  await expect(page.getByText("Leçon de français : déjà étudiée.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Leçon de français : déjà étudiée.")).toBeVisible();
  await expect(page.getByText("Current source: french-multipage.pdf")).toBeVisible();

  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Replace PDF" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const refreshedPrompt = page.waitForResponse(
    (response) =>
      response.url().includes("/structured-content") && response.status() === 200,
  );
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(page.getByRole("status")).toHaveText("PDF imported successfully.");
  await expect(page.getByText("Leçon de français : déjà étudiée.")).toBeVisible();
  await refreshedPrompt;

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(missingResponses).toEqual([]);
  expect(browserErrors).toEqual([]);
});
