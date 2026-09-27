import { react } from "@shufflies/oxlint-config";
import { defineConfig } from "oxlint";

// The `react` preset layers the shared base rules with the React and
// accessibility plugins.
export default defineConfig({
  extends: [react],
  overrides: [
    // Tool configuration modules are inherently default-exporting, so they are
    // exempt by pattern rather than by name: `vite.config.ts` and the
    // `playwright.config.ts` that `--playwright` adds both need it.
    {
      files: ["**/*.config.ts"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
});
