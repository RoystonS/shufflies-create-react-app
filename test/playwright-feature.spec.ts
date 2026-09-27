import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  packageRootDirectory,
  PLAYWRIGHT_FEATURE,
  scaffoldProject,
  type ScaffoldResult,
  templateDirectory,
} from "../src/create-app.ts";

/** Files the Playwright overlay adds to, or replaces in, a generated application. */
const FEATURE_FILES = [
  "playwright.config.ts",
  "playwright/gallery/index.html",
  "playwright/gallery/main.tsx",
  "src/App.story.tsx",
  "tests/components/App.spec.ts",
  "tests/e2e/app.spec.ts",
  "tsconfig.playwright.json",
];

/** Files the overlay uses to describe itself, which must not land in the application. */
const FEATURE_METADATA_FILES = ["_feature.json", "_readme-section.md"];

let scratchRoot = "";

before(async () => {
  scratchRoot = await mkdtemp(path.join(tmpdir(), "shufflies-playwright-feature-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true, maxRetries: 3 });
});

/** Absolute path of the overlay itself, which is published alongside the template. */
const overlayDirectory = (): string => path.join(packageRootDirectory(), "features", PLAYWRIGHT_FEATURE);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

  assert.ok(isRecord(parsed), `Expected ${filePath} to hold a JSON object.`);
  return parsed;
}

function requiredRecord(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = container[key];

  assert.ok(isRecord(value), `Expected "${key}" to hold an object.`);
  return value;
}

/** Scaffolds into a scratch directory of its own, so tests cannot disturb each other. */
async function scaffold(name: string, playwright: boolean): Promise<{ target: string; result: ScaffoldResult }> {
  const target = path.join(scratchRoot, name);
  const result = await scaffoldProject({ targetDirectory: target, playwright });

  return { target, result };
}

/** Asserts that none of the overlay's work is visible in a generated application. */
async function assertNothingWasAdded(target: string): Promise<void> {
  const manifest = await readJsonObject(path.join(target, "package.json"));
  const ignored = await readFile(path.join(target, ".gitignore"), "utf8");
  const readme = await readFile(path.join(target, "README.md"), "utf8");
  const scripts = requiredRecord(manifest, "scripts");

  assert.ok(!("@playwright/test" in requiredRecord(manifest, "devDependencies")));
  assert.ok(!("test:browser" in scripts));
  assert.ok(!ignored.includes("/playwright-report/"));
  assert.ok(!readme.includes("Browser tests"));
}

/** The `path` values in a solution file's `references`, in the order they appear. */
function referencedProjects(solutionFile: string): readonly string[] {
  return [...solutionFile.matchAll(/"path":\s*"(?<project>[^"]+)"/gu)].map((match) => match.groups?.project ?? "");
}

describe("the Playwright feature", () => {
  it("stays out of the default application", async () => {
    const { result, target } = await scaffold("minimal", false);
    const browserTests = result.files.filter((file) => file.startsWith("tests/") || FEATURE_FILES.includes(file));

    assert.deepEqual(result.features, []);
    assert.deepEqual(browserTests, [], "expected no Playwright files by default");

    await assertNothingWasAdded(target);
  });

  it("copies its files in when it is asked for", async () => {
    const { result } = await scaffold("variant", true);

    assert.deepEqual(result.features, [PLAYWRIGHT_FEATURE]);

    for (const file of FEATURE_FILES) {
      assert.ok(result.files.includes(file), `expected ${file} to be copied`);
    }
  });

  it("describes itself rather than copying its own metadata", async () => {
    const { result } = await scaffold("metadata", true);

    for (const metadata of FEATURE_METADATA_FILES) {
      assert.ok(!result.files.includes(metadata), `expected ${metadata} to describe the overlay, not to be copied`);
    }
  });
});

describe("the Playwright feature's manifest", () => {
  it("adds its dependency and scripts", async () => {
    const { target } = await scaffold("manifest", true);
    const manifest = await readJsonObject(path.join(target, "package.json"));
    const scripts = requiredRecord(manifest, "scripts");

    assert.equal(manifest.name, "manifest");
    assert.ok("@playwright/test" in requiredRecord(manifest, "devDependencies"));
    assert.equal(scripts["browser:install"], "playwright install chromium");
    assert.equal(scripts["test:browser"], "playwright test");
    assert.equal(scripts["test:browser:update"], "playwright test --update-snapshots");
  });

  it("keeps react and react-dom the only runtime dependencies", async () => {
    const { target } = await scaffold("runtime", true);
    const manifest = await readJsonObject(path.join(target, "package.json"));

    assert.deepEqual(Object.keys(requiredRecord(manifest, "dependencies")).toSorted(), ["react", "react-dom"]);
  });
});

describe("the Playwright feature's TypeScript projects", () => {
  it("references the project it adds from the solution file", async () => {
    const { target } = await scaffold("solution", true);
    const solution = await readFile(path.join(target, "tsconfig.json"), "utf8");

    assert.ok(solution.includes("./tsconfig.playwright.json"));
  });

  it("keeps the overlay's solution file in step with the template's", async () => {
    // The overlay replaces `tsconfig.json` so that the new project is referenced,
    // which means the two files can drift apart as the template changes.
    const template = await readFile(path.join(templateDirectory(), "tsconfig.json"), "utf8");
    const overlay = await readFile(path.join(overlayDirectory(), "tsconfig.json"), "utf8");

    assert.deepEqual(referencedProjects(overlay), [...referencedProjects(template), "./tsconfig.playwright.json"]);
  });
});

describe("the Playwright feature's sample story", () => {
  it("keeps the story id in step with the story file and the gallery", async () => {
    // Story ids are strings, so a mismatch only shows up when a browser runs the
    // component test, which the fast suite deliberately does not do.
    const story = await readFile(path.join(overlayDirectory(), "src", "App.story.tsx"), "utf8");
    const spec = await readFile(path.join(overlayDirectory(), "tests", "components", "App.spec.ts"), "utf8");
    const gallery = await readFile(path.join(overlayDirectory(), "playwright", "gallery", "main.tsx"), "utf8");

    assert.match(story, /export function Default\(/u);
    assert.ok(spec.includes('mount("App/Default")'), "expected the component test to mount App/Default");
    assert.ok(gallery.includes("/src/**/*.story.tsx"), "expected the gallery to load every story file");
  });
});

describe("the Playwright feature's documentation", () => {
  it("ignores what the browser tests write", async () => {
    const { target } = await scaffold("ignore", true);
    const ignored = await readFile(path.join(target, ".gitignore"), "utf8");

    assert.ok(ignored.includes("/playwright-report/"), "expected the browser reports to be ignored");
    assert.ok(ignored.includes("/node_modules/"), "expected the template's own ignore lines to survive");
  });

  it("appends its README section to the template's", async () => {
    const { target } = await scaffold("readme", true);
    const readme = await readFile(path.join(target, "README.md"), "utf8");

    assert.ok(readme.includes("# Vite + React + TypeScript"), "expected the template README to survive");
    assert.ok(readme.includes("## Browser tests"), "expected the overlay's README section to be appended");
    assert.ok(!readme.includes("_readme-section.md"), "expected the section's contents, not its name");
  });
});
