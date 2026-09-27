import { expect, test } from "@playwright/test";

test("renders the application and counts a click", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Vite + React" })).toBeVisible();

  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByText("The counter is at 1.")).toBeVisible();
});

test("the home page matches its reference screenshot", async ({ page }) => {
  await page.goto("/");

  // The first run has no reference to compare against: it writes one, then fails.
  // `npm run test:browser:update` refreshes the references on purpose.
  await expect(page).toHaveScreenshot();
});
