import { expect, test } from "@playwright/test";

test("creates a dated lesson, opens it, and keeps it listed after refresh", async ({
  page,
}) => {
  const title = `Les salutations ${Date.now()}`;
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(title);
  await page.getByLabel("Lesson date (optional)").fill("2026-08-22");
  await page.getByRole("button", { name: "Create lesson" }).click();

  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.getByRole("link", { name: "All lessons" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("shows inline errors and does not navigate for invalid input", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("422 (Unprocessable Entity)")
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lessons/new");
  await page.getByRole("button", { name: "Create lesson" }).click();

  await expect(page).toHaveURL(/\/lessons\/new$/);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Check the highlighted fields and try again." }),
  ).toBeVisible();
  await expect(page.getByLabel("Lesson title")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByText("Enter a lesson title.")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
