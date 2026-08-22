import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("copies the local prompt and safely imports and replaces manual JSON", async ({
  context,
  page,
}) => {
  const title = `Manual import ${Date.now()}`;
  const fixture = join(
    process.cwd(),
    "tests/pdf-import/fixtures/french-multipage.pdf",
  );
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3000",
  });

  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(title);
  await page.getByRole("button", { name: "Create lesson" }).click();
  const manualRegion = page.getByRole("region", {
    name: "Use your own AI tool",
  });
  await expect(
    manualRegion.getByText("Import a readable PDF to use the manual workflow."),
  ).toBeVisible();

  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(
    manualRegion.getByRole("button", { name: "Copy prompt" }),
  ).toBeEnabled();
  await manualRegion.getByRole("button", { name: "Copy prompt" }).click();
  await expect(manualRegion.getByRole("status")).toHaveText("Prompt copied.");

  const textarea = manualRegion.getByLabel("Paste structured lesson JSON");
  const invalidJson = '{"schemaVersion":1,"unknown":true}';
  await textarea.fill(invalidJson);
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();
  await expect(manualRegion.getByRole("alert")).toHaveText(
    "The pasted JSON does not match the lesson schema.",
  );
  await expect(textarea).toHaveValue(invalidJson);
  expect(browserErrors).toEqual([expect.stringContaining("422")]);
  browserErrors.length = 0;

  await textarea.fill(
    JSON.stringify({
      schemaVersion: 1,
      summary: "A manually imported French A1 review.",
      title: "First manual review",
    }),
  );
  await manualRegion.getByRole("button", { name: "Import JSON" }).click();
  await expect(manualRegion.getByRole("status")).toHaveText(
    "Manual lesson imported successfully.",
  );

  await page.reload();
  await expect(manualRegion.getByRole("note")).toContainText("Manual content");
  await expect(manualRegion.getByRole("note")).toContainText(
    "Current manual review: First manual review",
  );

  await manualRegion.getByLabel("Paste structured lesson JSON").fill(
    JSON.stringify({
      schemaVersion: 1,
      summary: "A confirmed replacement review.",
      title: "Replacement manual review",
    }),
  );
  await manualRegion.getByRole("button", { name: "Review import" }).click();
  await expect(manualRegion.getByRole("alertdialog")).toContainText(
    "Replace “First manual review”?",
  );
  await manualRegion
    .getByRole("button", { name: "Replace saved review" })
    .click();
  await expect(manualRegion.getByRole("status")).toHaveText(
    "Manual lesson imported successfully.",
  );

  await page.reload();
  await expect(manualRegion.getByRole("note")).toContainText(
    "Current manual review: Replacement manual review",
  );
  await page.setViewportSize({ height: 900, width: 320 });
  await expect(manualRegion.getByRole("button", { name: "Copy prompt" })).toBeVisible();
  await expect(manualRegion.getByLabel("Paste structured lesson JSON")).toBeVisible();

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
