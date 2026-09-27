// The browser tests are opt-in, because they need a browser that npm does not install:
// CI sets `CHECK_SCREENSHOTS` to run them, and every other run stops at listing them.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { after, before, describe, it } from "node:test";

import { APP_CHECKS, assertCommandSucceeded, runCommand } from "../scripts/scaffold-support.ts";
import { listRelativeFiles, packageRootDirectory, pathExists } from "../src/create-app.ts";

const cliEntry = path.join(packageRootDirectory(), "dist", "cli.js");

/** Whether to run the generated app's browser tests, which download a browser first. */
const checkScreenshots = process.env.CHECK_SCREENSHOTS === "1";

let scratchRoot = "";

before(async () => {
  scratchRoot = await mkdtemp(path.join(tmpdir(), "shufflies-create-react-app-scaffold-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true, maxRetries: 3 });
});

function scaffoldInto(target: string): void {
  assertCommandSucceeded("Scaffolding", runCommand(process.execPath, [cliEntry, target], packageRootDirectory()));
}

/**
 * Runs the scripts the generated application is expected to pass. The generated app's
 * `lint` script denies warnings, which `test/create-app.spec.ts` guards, so passing here
 * means an application that is clean rather than one that merely has no errors.
 */
function runAppChecks(target: string): void {
  for (const script of APP_CHECKS) {
    assertCommandSucceeded(`npm run ${script}`, runCommand("npm", ["run", script], target));
  }
}

function installAndCheck(target: string): void {
  assertCommandSucceeded("npm install", runCommand("npm", ["install", "--no-audit", "--no-fund"], target));
  runAppChecks(target);
}

/** Scaffolds the variant that `--playwright` produces, which the option is named after. */
function scaffoldBrowserTestsInto(target: string): void {
  assertCommandSucceeded(
    "Scaffolding with --playwright",
    runCommand(process.execPath, [cliEntry, target, "--playwright"], packageRootDirectory()),
  );
}

/**
 * Checks the browser tests without downloading a browser: listing the tests makes
 * Playwright load the config and collect both projects' specs, which is as far as the
 * project can go until someone runs `npm run browser:install`.
 *
 * The installed CLI is called directly because `npm exec` reads flags such as `--list`
 * as its own, which leaves it unable to forward them.
 */
function assertBrowserTestsAreDiscoverable(target: string): void {
  const playwrightCli = path.join(target, "node_modules", "@playwright", "test", "cli.js");
  const listed = runCommand(process.execPath, [playwrightCli, "test", "--list"], target);

  assertCommandSucceeded("playwright test --list", listed);

  // The runner lists each spec relative to its project's directory, using the host's
  // separators, so compare against a normalised path.
  const paths = listed.output.replaceAll("\\", "/");

  // The component project's spec is named after the component it mounts, while the
  // end-to-end one names the page it drives.
  for (const spec of ["e2e/app.spec.ts", "components/App.spec.ts"]) {
    assert.ok(paths.includes(spec), `expected the listed tests to include ${spec}`);
  }
}

/**
 * Runs the app's own browser tests. It records the reference screenshots on this machine
 * and then compares against them, because rendering differs from platform to platform: a
 * baseline recorded on one runner is not a baseline on another.
 */
function runScreenshotTests(target: string): void {
  assertCommandSucceeded("npm run browser:install", runCommand("npm", ["run", "browser:install"], target));
  assertCommandSucceeded("npm run test:browser:update", runCommand("npm", ["run", "test:browser:update"], target));
  assertCommandSucceeded("npm run test:browser", runCommand("npm", ["run", "test:browser"], target));
}

/** Confirms the screenshot tests compared something, rather than matching nothing. */
async function assertScreenshotsWereRecorded(target: string): Promise<void> {
  const files = await listRelativeFiles(target);

  for (const snapshots of ["tests/components/App.spec.ts-snapshots/", "tests/e2e/app.spec.ts-snapshots/"]) {
    const recorded = files.some((file) => file.startsWith(snapshots) && file.endsWith(".png"));

    assert.ok(recorded, `expected ${snapshots} to hold a reference screenshot`);
  }
}

describe("scaffolded application", () => {
  it("installs and passes every check the template ships with", async () => {
    const target = path.join(scratchRoot, "sample-app");

    scaffoldInto(target);

    assert.ok(await pathExists(path.join(target, ".gitignore")), "expected _gitignore to be renamed to .gitignore");
    assert.ok(await pathExists(path.join(target, "tsconfig.spec.json")), "expected the spec tsconfig to be copied");

    const manifest = await readFile(path.join(target, "package.json"), "utf8");
    assert.ok(manifest.includes(`"name": "sample-app"`), "expected the app to be named after its directory");

    installAndCheck(target);
  });

  it("installs the browser test variant, which finds its tests", async () => {
    const target = path.join(scratchRoot, "browser-app");

    scaffoldBrowserTestsInto(target);
    installAndCheck(target);
    assertBrowserTestsAreDiscoverable(target);

    if (!checkScreenshots) {
      process.stdout.write("Not running the browser tests; set CHECK_SCREENSHOTS=1 to run them.\n");
      return;
    }

    runScreenshotTests(target);

    await assertScreenshotsWereRecorded(target);
  });
});
