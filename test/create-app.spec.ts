import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  DEFAULT_PROJECT_NAME,
  listRelativeFiles,
  packageRootDirectory,
  parseArguments,
  pathExists,
  readPackageVersion,
  scaffoldProject,
  templateDirectory,
  toPackageName,
} from "../src/create-app.ts";
import { ScaffoldError } from "../src/errors.ts";

let scratchRoot = "";

before(async () => {
  scratchRoot = await mkdtemp(path.join(tmpdir(), "shufflies-create-react-app-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true, maxRetries: 3 });
});

const scratchDirectory = (name: string): string => path.join(scratchRoot, name);

/** Files every scaffolded application must contain. */
const EXPECTED_FILES = [
  ".gitignore",
  ".vscode/extensions.json",
  ".vscode/settings.json",
  "oxlint.config.ts",
  "package.json",
  "src/App.spec.tsx",
  "src/App.tsx",
  "tsconfig.spec.json",
];

/** Template placeholders that must have been renamed away by the time we look. */
const RENAMED_AWAY_FILES = ["_gitignore", "_oxlint.config.ts"];

function assertScaffoldedFiles(files: readonly string[]): void {
  const copied = new Set(files);

  for (const expected of EXPECTED_FILES) {
    assert.ok(copied.has(expected), `expected ${expected} to be copied`);
  }

  for (const renamed of RENAMED_AWAY_FILES) {
    assert.ok(!copied.has(renamed), `expected ${renamed} to be renamed during scaffolding`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  assert.ok(isPlainObject(parsed), `Expected ${filePath} to contain a JSON object.`);
  return parsed;
}

const templateManifestPath = (): string => path.join(templateDirectory(), "package.json");

describe("toPackageName", () => {
  it("lowercases and hyphenates free-form directory names", () => {
    assert.equal(toPackageName("My App"), "my-app");
    assert.equal(toPackageName("My_App.v2"), "my-app-v2");
    assert.equal(toPackageName("  My   App  "), "my-app");
  });

  it("trims leading and trailing separators", () => {
    assert.equal(toPackageName("--My App--"), "my-app");
  });

  it("rejects input with nothing usable in it", () => {
    assert.throws(() => toPackageName("..."), ScaffoldError);
    assert.throws(() => toPackageName("   "), ScaffoldError);
  });

  it("rejects names longer than npm allows", () => {
    assert.throws(() => toPackageName("a".repeat(215)), ScaffoldError);
  });
});

describe("parseArguments", () => {
  it("scaffolds into a default directory when nothing is supplied", () => {
    assert.deepEqual(parseArguments([]), { command: "scaffold", force: false, playwright: false });
  });

  it("accepts a target directory, with or without the force flag", () => {
    assert.deepEqual(parseArguments(["my-app"]), {
      command: "scaffold",
      force: false,
      playwright: false,
      targetDirectory: "my-app",
    });
    assert.deepEqual(parseArguments(["--force", "my-app"]), {
      command: "scaffold",
      force: true,
      playwright: false,
      targetDirectory: "my-app",
    });
    assert.deepEqual(parseArguments(["-f", "my-app"]), {
      command: "scaffold",
      force: true,
      playwright: false,
      targetDirectory: "my-app",
    });
  });

  it("turns the optional Playwright tests on with a flag", () => {
    assert.deepEqual(parseArguments(["--playwright"]), { command: "scaffold", force: false, playwright: true });
    assert.deepEqual(parseArguments(["--playwright", "my-app", "--force"]), {
      command: "scaffold",
      force: true,
      playwright: true,
      targetDirectory: "my-app",
    });
  });

  it("recognises the help and version flags", () => {
    assert.deepEqual(parseArguments(["--help"]), { command: "help" });
    assert.deepEqual(parseArguments(["-h"]), { command: "help" });
    assert.deepEqual(parseArguments(["--version"]), { command: "version" });
    assert.deepEqual(parseArguments(["-v"]), { command: "version" });
  });

  it("rejects unknown options and extra directories", () => {
    assert.throws(() => parseArguments(["--wat"]), ScaffoldError);
    assert.throws(() => parseArguments(["one", "two"]), ScaffoldError);
  });
});

describe("readPackageVersion", () => {
  it("reports the version of the initializer itself", async () => {
    assert.equal(await readPackageVersion(), "0.0.0-semantically-released");
  });
});

describe("published manifest", () => {
  it("declares a bin path npm keeps and that exists", async () => {
    const root = packageRootDirectory();
    const manifest = await readJsonObject(path.join(root, "package.json"));
    const target = requiredRecord(manifest, "bin")["create-shufflies-react-app"];

    if (typeof target !== "string") {
      assert.fail("expected the manifest to declare a create-shufflies-react-app bin");
    }

    // npm 12 removes a bin entry whose path starts with `./`, which leaves the
    // published package with no command at all.
    assert.ok(!target.startsWith("./"), "expected the bin path to have no leading ./");
    assert.ok(await pathExists(path.join(root, target)), `expected the bin target ${target} to exist`);
  });
});

describe("template", () => {
  it("keeps React and React DOM as the only runtime dependencies", async () => {
    const manifest = await readJsonObject(templateManifestPath());

    assert.deepEqual(Object.keys(requiredRecord(manifest, "dependencies")).toSorted(), ["react", "react-dom"]);
  });

  it("ships no ESLint, Prettier or CSS framework packages", async () => {
    const manifest = await readJsonObject(templateManifestPath());
    const allPackages = new Set([
      ...Object.keys(requiredRecord(manifest, "dependencies")),
      ...Object.keys(requiredRecord(manifest, "devDependencies")),
    ]);

    for (const unwanted of ["eslint", "prettier", "tailwindcss", "bootstrap"]) {
      assert.ok(!allPackages.has(unwanted), `The template should not depend on ${unwanted}.`);
    }
  });

  it("routes linting through the shared preset", async () => {
    const config = await readFile(path.join(templateDirectory(), "_oxlint.config.ts"), "utf8");

    assert.ok(config.includes("@shufflies/oxlint-config"));
  });

  it("ships a sample .spec file and no .test file", async () => {
    const files = await listRelativeFiles(templateDirectory());
    const testFiles = files.filter((file) => file.includes(".test."));

    assert.ok(files.includes("src/App.spec.tsx"), "expected the template to ship a sample spec file");
    assert.deepEqual(testFiles, [], "expected the template to ship no *.test.* files");
  });
});

describe("scaffoldProject", () => {
  it("copies the template, renames mangled files and names the app after its directory", async () => {
    const target = scratchDirectory("my-app");
    const result = await scaffoldProject({ targetDirectory: target });

    assert.equal(result.packageName, "my-app");
    assert.deepEqual(result.features, []);
    assertScaffoldedFiles(result.files);

    const manifest = await readJsonObject(path.join(target, "package.json"));

    assert.equal(manifest.name, "my-app");
  });

  it("derives a valid package name from an awkward directory name", async () => {
    const target = scratchDirectory("My App.v2");
    const result = await scaffoldProject({ targetDirectory: target });
    const manifest = await readJsonObject(path.join(target, "package.json"));

    assert.equal(result.packageName, "my-app-v2");
    assert.equal(manifest.name, "my-app-v2");
  });

  it("offers a sensible default directory name", () => {
    assert.equal(DEFAULT_PROJECT_NAME, "shufflies-react-app");
  });
});

describe("scaffoldProject directory handling", () => {
  it("refuses to scaffold into a directory that already holds files", async () => {
    const target = scratchDirectory("occupied");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "keep-me.txt"), "existing\n", "utf8");

    await assert.rejects(scaffoldProject({ targetDirectory: target }), ScaffoldError);

    assert.ok(await pathExists(path.join(target, "keep-me.txt")));
    assert.ok(!(await pathExists(path.join(target, "package.json"))));
  });

  it("scaffolds into an occupied directory when forced", async () => {
    const target = scratchDirectory("forced");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "keep-me.txt"), "existing\n", "utf8");

    const result = await scaffoldProject({ targetDirectory: target, force: true });

    assert.ok(result.files.includes("keep-me.txt"));
    assert.ok(result.files.includes("package.json"));
  });
});

function requiredRecord(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = container[key];
  assert.ok(isPlainObject(value), `Expected the template manifest to define "${key}".`);
  return value;
}
