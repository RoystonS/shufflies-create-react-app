import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const APP_URL = `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env.CI);

// The component tests navigate to the gallery page rather than to the application:
// `mount()` resolves a story id there, so the `components` project points `baseURL`
// at that page. The gallery is served by the same dev server as the app.
const GALLERY_URL = `${APP_URL}/playwright/gallery/index.html`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  reporter: IS_CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      // Drives the real application, exactly as a user would.
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: APP_URL },
    },
    {
      // Mounts one story at a time from the gallery page.
      name: "components",
      testDir: "./tests/components",
      use: { ...devices["Desktop Chrome"], baseURL: GALLERY_URL },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: APP_URL,
    // A dev server you already have running is reused locally, but CI starts one.
    reuseExistingServer: !IS_CI,
  },
});
