import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("generates, labels, refreshes, and preserves a fake lesson on retry failure", async ({
  page,
}) => {
  const title = `Fake generation ${Date.now()}`;
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

  await expect(
    page.getByText("Import a readable PDF to unlock demo generation."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate demo lesson" }),
  ).toHaveCount(0);

  await page.getByLabel("PDF file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(
    page.getByRole("button", { name: "Generate demo lesson" }),
  ).toBeVisible();

  const generationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/structure") && response.request().method() === "POST",
  );
  const generationRegion = page.getByRole("region", {
    name: "Build a demo review",
  });
  await page.getByRole("button", { name: "Generate demo lesson" }).click();
  await expect(generationRegion.getByRole("status")).toContainText(
    "Generating demo lesson",
  );
  expect((await generationResponse).status()).toBe(200);
  await expect(page.getByRole("note")).toContainText(
    "This is deterministic demo content. It was not derived from your PDF.",
  );
  await expect(page.getByRole("note")).toContainText(
    "Current demo: Demo French A1 review",
  );

  await page.reload();
  await expect(page.getByRole("note")).toContainText(
    "This is deterministic demo content. It was not derived from your PDF.",
  );
  await expect(
    page.getByRole("button", { name: "Regenerate demo lesson" }),
  ).toBeVisible();

  await page.route(`**/api/lessons/*/structure`, async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: {
          code: "PROVIDER_RATE_LIMIT",
          message: "Lesson generation is temporarily unavailable. Try again.",
        },
      }),
      contentType: "application/json",
      status: 429,
    });
  });
  await page.getByRole("button", { name: "Regenerate demo lesson" }).click();
  await expect(generationRegion.getByRole("alert")).toHaveText(
    "Lesson generation is temporarily unavailable. Try again.",
  );
  await expect(page.getByRole("note")).toContainText(
    "Current demo: Demo French A1 review",
  );
  expect(browserErrors).toEqual([expect.stringContaining("429")]);
  browserErrors.length = 0;

  await page.setViewportSize({ height: 900, width: 320 });
  await expect(page.getByRole("heading", { name: "Build a demo review" })).toBeVisible();
  await expect(page.getByRole("note")).toBeVisible();

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/");
  expect(browserErrors).toEqual([]);
});
