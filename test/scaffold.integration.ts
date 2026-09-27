import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { after, before, describe, it } from "node:test";

import { APP_CHECKS, assertCommandSucceeded, runCommand } from "../scripts/scaffold-support.ts";
import { packageRootDirectory, pathExists } from "../src/create-app.ts";

const cliEntry = path.join(packageRootDirectory(), "dist", "cli.js");

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

function installAndCheck(target: string): void {
  assertCommandSucceeded("npm install", runCommand("npm", ["install", "--no-audit", "--no-fund"], target));

  for (const script of APP_CHECKS) {
    assertCommandSucceeded(`npm run ${script}`, runCommand("npm", ["run", script], target));
  }
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

  it("installs the browser test variant, which finds its tests", () => {
    const target = path.join(scratchRoot, "browser-app");

    scaffoldBrowserTestsInto(target);
    installAndCheck(target);
    assertBrowserTestsAreDiscoverable(target);
  });
});
