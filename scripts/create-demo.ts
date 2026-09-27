// This is an ESM script that Node runs directly, so the top-level `await main(...)`
// at the bottom is valid. `node/no-top-level-await` only guards `require(esm)`
// consumers.
/* oxlint-disable node/no-top-level-await */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

import { packageRootDirectory } from "../src/create-app.ts";
import { APP_CHECKS, assertCommandSucceeded, type CommandResult, runCommand } from "./scaffold-support.ts";

/** Directory name of the application the simulation creates. */
const APP_NAME = "my-app";

const RUN_DIRECTORY_PREFIX = "shufflies-create-demo";

/** Scratch manifest for the throwaway project the tarball is installed into. */
const CONSUMER_MANIFEST = `${JSON.stringify({ name: "create-demo-consumer", private: true }, undefined, 2)}\n`;

const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h"]);

const USAGE = `Usage: npm run scaffold:demo [-- options]

Simulates the real \`npm create\` / \`pnpm create\` flow:

  1. packs this package to a tarball, exactly as it would be published
  2. installs that tarball into a throwaway project with npm or pnpm
  3. runs the installed \`create-shufflies-react-app\` binary to scaffold an app

Unlike \`npm run test:scaffold\`, the result is left in place so it can be
inspected, opened in an editor and run.

Options:
  --npm           Fetch the initializer and install the app with npm (default)
  --pnpm          Do both with pnpm instead
  --playwright    Scaffold the app with Playwright browser and component tests
  --install       Also install the app's dependencies and run its checks
  -h, --help      Show this message

\`--playwright\` is passed to the initializer, so the app it writes has the browser
tests. Those need \`npm run browser:install\` and a downloaded browser, so
\`--install\` stops at listing them.
`;

type PackageManager = "npm" | "pnpm";

type Options = {
  /** Install the generated app's dependencies and run its checks. */
  readonly install: boolean;
  readonly packageManager: PackageManager;
  /** Ask the initializer for the app with Playwright browser and component tests. */
  readonly playwright: boolean;
};

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArguments(argv);

  if (options === "help") {
    process.stdout.write(USAGE);
    return 0;
  }

  const runDirectory = await createRunDirectory();

  try {
    await runSimulation(options, runDirectory);
    return 0;
  } catch (error) {
    process.stderr.write(`\n${describeError(error)}\n\nNothing was deleted. Inspect: ${runDirectory}\n`);
    return 1;
  }
}

async function runSimulation(options: Options, runDirectory: string): Promise<void> {
  process.stdout.write(`Simulating "${options.packageManager} create" under ${runDirectory}\n\n`);

  process.stdout.write("Packing the initializer, as npm would publish it...\n");
  const tarball = await packPackage(runDirectory);

  process.stdout.write(`Installing that tarball with ${options.packageManager}...\n`);
  const consumerDirectory = await createConsumerProject(options, runDirectory, tarball);

  const appDirectory = path.join(runDirectory, APP_NAME);
  process.stdout.write("Running the installed create-shufflies-react-app binary...\n");
  assertCommandSucceeded("create-shufflies-react-app", runInitializer(options, consumerDirectory, appDirectory));

  installAndVerifyIfRequested(options, appDirectory);
  process.stdout.write(describeResult(options, runDirectory, appDirectory));
}

/** Creates the directory this run works in. It is never removed. */
async function createRunDirectory(): Promise<string> {
  // 2026-09-26T13:45:10.123Z becomes 20260926-134510.
  const stamp = new Date().toISOString().replaceAll(/[-:]/gu, "").replaceAll("T", "-").slice(0, 15);
  const runDirectory = path.join(tmpdir(), RUN_DIRECTORY_PREFIX, stamp);

  await mkdir(runDirectory, { recursive: true });
  return runDirectory;
}

async function packPackage(runDirectory: string): Promise<string> {
  const result = runCommand("npm", ["pack", "--pack-destination", runDirectory], packageRootDirectory());
  assertCommandSucceeded("npm pack", result);

  const entries = await readdir(runDirectory);
  const tarball = entries.find((entry) => entry.endsWith(".tgz"));

  if (tarball === undefined) {
    throw new Error(`npm pack left no tarball in ${runDirectory}.`);
  }

  return path.join(runDirectory, tarball);
}

async function createConsumerProject(options: Options, runDirectory: string, tarball: string): Promise<string> {
  const consumerDirectory = path.join(runDirectory, "consumer");
  await mkdir(consumerDirectory, { recursive: true });
  await writeFile(path.join(consumerDirectory, "package.json"), CONSUMER_MANIFEST, "utf8");

  const args = options.packageManager === "pnpm" ? ["add", tarball] : ["install", tarball, "--no-audit", "--no-fund"];
  assertCommandSucceeded(
    `Installing the tarball with ${options.packageManager}`,
    runCommand(options.packageManager, args, consumerDirectory),
  );

  return consumerDirectory;
}

/** Runs the binary the package publishes, from the project it was installed into. */
function runInitializer(options: Options, consumerDirectory: string, appDirectory: string): CommandResult {
  const binary = "create-shufflies-react-app";
  const initializerOptions = options.playwright ? ["--playwright"] : [];
  // `--no-install` stops npm falling back to the registry, and `--` stops npm reading
  // the initializer's own options as its own — without it npm silently drops
  // `--playwright`. `pnpm exec` only ever runs a locally installed binary.
  const args =
    options.packageManager === "pnpm"
      ? ["exec", binary, appDirectory, ...initializerOptions]
      : ["exec", "--no-install", "--", binary, appDirectory, ...initializerOptions];

  return runCommand(options.packageManager, args, consumerDirectory);
}

function installAndVerifyIfRequested(options: Options, appDirectory: string): void {
  if (!options.install) {
    return;
  }

  process.stdout.write(`\nInstalling the app's dependencies with ${options.packageManager}...\n`);
  assertCommandSucceeded(
    `Installing the generated app with ${options.packageManager}`,
    runCommand(options.packageManager, ["install"], appDirectory),
  );

  for (const script of APP_CHECKS) {
    process.stdout.write(`Checking ${script}...\n`);
    assertCommandSucceeded(
      `${options.packageManager} run ${script}`,
      runCommand(options.packageManager, ["run", script], appDirectory),
    );
  }

  process.stdout.write(`\nAll checks passed: ${APP_CHECKS.join(", ")}\n`);
  listBrowserTestsIfRequested(options, appDirectory);
}

/**
 * Shows that the browser tests the variant ships are discoverable. They are not run:
 * the browser is a separate download, which is what `npm run browser:install` in the
 * generated app is for.
 */
function listBrowserTestsIfRequested(options: Options, appDirectory: string): void {
  if (!options.playwright) {
    return;
  }

  const playwrightCli = path.join(appDirectory, "node_modules", "@playwright", "test", "cli.js");
  const listed = runCommand(process.execPath, [playwrightCli, "test", "--list"], appDirectory);

  assertCommandSucceeded("playwright test --list", listed);
  process.stdout.write(`\nThe app can list its browser tests:\n\n${listed.output}`);
}

function describeResult(options: Options, runDirectory: string, appDirectory: string): string {
  const nextSteps = [
    "",
    "Next steps:",
    `  cd ${appDirectory}`,
    ...(options.install ? [] : [`  ${options.packageManager} install`]),
    ...(options.playwright ? [`  ${options.packageManager} run browser:install`] : []),
    `  ${options.packageManager} run dev`,
  ];

  return [
    "",
    `Scaffolded app:  ${appDirectory}`,
    `Run directory:   ${runDirectory}`,
    "",
    "Nothing was deleted, so both of the above are still there.",
    ...nextSteps,
    "",
  ].join("\n");
}

function parseArguments(argv: readonly string[]): Options | "help" {
  let options: Options = { install: false, packageManager: "npm", playwright: false };

  for (const argument of argv) {
    if (HELP_FLAGS.has(argument)) {
      return "help";
    }

    options = applyFlag(argument, options);
  }

  return options;
}

function applyFlag(argument: string, options: Options): Options {
  if (argument === "--install") {
    return { ...options, install: true };
  }

  if (argument === "--playwright") {
    return { ...options, playwright: true };
  }

  if (argument === "--npm" || argument === "--pnpm") {
    return { ...options, packageManager: argument === "--pnpm" ? "pnpm" : "npm" };
  }

  throw new Error(`Unknown option "${argument}".`);
}

function describeError(error: unknown): string {
  return error instanceof Error ? `Error: ${error.message}` : "Error: an unknown error occurred.";
}

process.exitCode = await main(process.argv.slice(2));
