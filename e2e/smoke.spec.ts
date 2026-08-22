import { expect, test } from "@playwright/test";

test("renders the application shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "French review" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/French Review/);
});
