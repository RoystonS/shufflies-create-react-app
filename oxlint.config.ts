import { node } from "@shufflies/oxlint-config";
import { defineConfig } from "oxlint";

// This repository is a Node.js CLI plus a bundled template. The template has its
// own `oxlint.config.ts` (extending the `react` preset) and is linted in place
// once it has been scaffolded, so it is skipped here.
export default defineConfig({
  extends: [node],
  ignorePatterns: ["template/**"],
  overrides: [
    {
      // `node:test` registers a test by handing the runner a promise, so the
      // idiomatic `it(...)` call is not a floating promise.
      files: ["**/*.test.ts", "**/*.integration.ts"],
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
    {
      // These are ESM entry points that Node runs directly, where top-level await
      // is valid. The rule only guards `require(esm)` consumers, which cannot apply.
      files: ["src/cli.ts", "scripts/**"],
      rules: {
        "node/no-top-level-await": "off",
      },
    },
    {
      // Scaffolding happens one step at a time, and each step needs the previous
      // exit code, so the shared helper deliberately uses the synchronous spawn API.
      files: ["scripts/**"],
      rules: {
        "node/no-sync": "off",
      },
    },
  ],
});
