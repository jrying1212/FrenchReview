import { expect, test } from "@playwright/test";

test("edits, reopens, cancels deletion, and confirms permanent deletion", async ({
  page,
}) => {
  const originalTitle = `Lifecycle ${Date.now()}`;
  const updatedTitle = `${originalTitle} updated`;
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lessons/new");
  await page.getByLabel("Lesson title").fill(originalTitle);
  await page.getByRole("button", { name: "Create lesson" }).click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);

  await page.getByLabel("Lesson title").fill(updatedTitle);
  await page.getByLabel("Lesson date (optional)").fill("2026-08-23");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Lesson updated.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(updatedTitle);

  await page.reload();
  await expect(page.getByLabel("Lesson title")).toHaveValue(updatedTitle);
  await expect(page.getByLabel("Lesson date (optional)")).toHaveValue(
    "2026-08-23",
  );

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).press("Enter");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(updatedTitle);

  await page.getByRole("button", { name: "Delete lesson" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).press("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: updatedTitle })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("renders the not-found state for an invalid lesson identifier", async ({
  page,
}) => {
  await page.goto("/lessons/not-a-uuid");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "That lesson is not here.",
  );
  await expect(page).toHaveTitle(/French Review/);
});
