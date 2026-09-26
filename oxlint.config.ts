import { node } from "@shufflies/oxlint-config";
import { defineConfig } from "oxlint";

// This repository is a Node.js CLI plus a bundled template. The template has its
// own `oxlint.config.ts` (extending the `react` preset) and is linted in place
// once it has been scaffolded, so it is skipped here.
//
// Only rules that apply by broad file *pattern* belong here. A rule that exists for
// the sake of one file is disabled in that file instead, next to the code it excuses.
export default defineConfig({
  extends: [node],
  ignorePatterns: ["template/**"],
  overrides: [
    {
      // `node:test` registers a test by handing the runner a promise, so the
      // idiomatic `it(...)` call is not a floating promise. Both suffixes are
      // accepted because `.spec` and `.test` files are equally welcome; this repo
      // writes `.spec` files.
      files: ["**/*.spec.ts", "**/*.test.ts", "**/*.integration.ts"],
      rules: {
        "typescript/no-floating-promises": "off",
      },
    },
    {
      // These are CommonJS by design: commitlint and semantic-release configs
      // follow the same `.cjs` convention as the sibling @shufflies packages.
      files: ["**/*.cjs"],
      rules: {
        "import/no-commonjs": "off",
        "import/unambiguous": "off",
      },
    },
  ],
});
