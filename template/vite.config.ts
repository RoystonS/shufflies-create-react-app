import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest reads this file too, so the `test` block lives alongside the build config.
export default defineConfig({
  plugins: [react()],
  test: {
    // Tests render with `react-dom/server`, so no DOM implementation is needed.
    environment: "node",
    // Both naming styles are picked up; the sample that ships here is `App.spec.tsx`.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
