import { react } from "@shufflies/oxlint-config";
import { defineConfig } from "oxlint";

// The `react` preset layers the shared base rules with the React and
// accessibility plugins.
export default defineConfig({
  extends: [react],
  overrides: [
    // Vite only accepts its configuration as a default export.
    {
      files: ["vite.config.ts"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
});
