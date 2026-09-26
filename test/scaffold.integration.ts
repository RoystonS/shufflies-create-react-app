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
});
