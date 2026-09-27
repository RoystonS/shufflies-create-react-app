import { expect, test } from "@playwright/test";

test("mounts the application story and counts a click", async ({ mount }) => {
  const component = await mount("App/Default");

  await expect(component.getByRole("heading", { name: "Vite + React" })).toBeVisible();

  await component.getByRole("button", { name: "Increment" }).click();
  await expect(component.getByText("The counter is at 1.")).toBeVisible();
});

test("the application story matches its reference screenshot", async ({ mount }) => {
  const component = await mount("App/Default");

  // The first run has no reference to compare against: it writes one, then fails.
  // `npm run test:browser:update` refreshes the references on purpose.
  await expect(component).toHaveScreenshot();
});
