#!/usr/bin/env node
// This is an ESM entry point that Node runs directly, so the top-level await at the
// bottom is valid. `node/no-top-level-await` only guards `require(esm)` consumers.
/* oxlint-disable node/no-top-level-await */

import process from "node:process";
import { createInterface } from "node:readline/promises";

import {
  DEFAULT_PROJECT_NAME,
  parseArguments,
  type ParsedArguments,
  PLAYWRIGHT_FEATURE,
  readPackageVersion,
  scaffoldProject,
  type ScaffoldResult,
} from "./create-app.ts";
import { ScaffoldError } from "./errors.ts";

const USAGE = `Usage: create-shufflies-react-app [options] [directory]

Scaffolds a Vite + React + TypeScript application with Vitest, oxlint and oxfmt.

Options:
  -f, --force       Scaffold into a directory that already contains files
      --playwright  Add Playwright browser and component tests
  -h, --help        Show this message
  -v, --version     Print the initializer version

With npm:  npm create @shufflies/react-app@latest my-app
With pnpm: pnpm create @shufflies/react-app my-app

npm claims options it recognises, so send this tool's own options after "--":
  npm create @shufflies/react-app@latest my-app -- --playwright
`;

async function main(argv: readonly string[]): Promise<number> {
  const parsed = tryParseArguments(argv);

  if (typeof parsed === "number") {
    return parsed;
  }

  const exitCode =
    parsed.command === "help" || parsed.command === "version"
      ? await reportInformationalCommand(parsed)
      : await scaffoldFromArguments(parsed);

  return exitCode;
}

/** Returns the parsed arguments, or the exit code to report when they are invalid. */
function tryParseArguments(argv: readonly string[]): ParsedArguments | number {
  try {
    return parseArguments(argv);
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n\n${USAGE}`);
    return 1;
  }
}

async function reportInformationalCommand(
  parsed: Extract<ParsedArguments, { command: "help" | "version" }>,
): Promise<number> {
  const message = parsed.command === "help" ? USAGE : `${await readPackageVersion()}\n`;

  process.stdout.write(message);
  return 0;
}

async function scaffoldFromArguments(parsed: Extract<ParsedArguments, { command: "scaffold" }>): Promise<number> {
  const targetDirectory = parsed.targetDirectory ?? (await promptForDirectory());

  if (targetDirectory.length === 0) {
    process.stderr.write(`A target directory is required.\n\n${USAGE}`);
    return 1;
  }

  try {
    const result = await scaffoldProject({
      targetDirectory,
      force: parsed.force,
      playwright: parsed.playwright,
    });

    process.stdout.write(describeSuccess(result));
    return 0;
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n`);
    return 1;
  }
}

async function promptForDirectory(): Promise<string> {
  if (!process.stdin.isTTY) {
    return DEFAULT_PROJECT_NAME;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await readline.question(`Project directory (${DEFAULT_PROJECT_NAME}): `);
    return answer.trim().length === 0 ? DEFAULT_PROJECT_NAME : answer.trim();
  } finally {
    readline.close();
  }
}

function describeSuccess(result: ScaffoldResult): string {
  const nextSteps = [
    `  cd ${result.targetDirectory}`,
    "  npm install",
    // The browser the tests run in is a separate download, so it is only worth
    // mentioning when the generated application actually has browser tests.
    ...(result.features.includes(PLAYWRIGHT_FEATURE) ? ["  npm run browser:install"] : []),
    "  npm run dev",
  ];

  return [
    `Scaffolded ${result.packageName} into ${result.targetDirectory} (${result.files.length} files).`,
    "",
    "Next steps:",
    ...nextSteps,
    "",
  ].join("\n");
}

function describeError(error: unknown): string {
  if (error instanceof ScaffoldError) {
    return `Error: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return "Error: an unknown error occurred.";
}

process.exitCode = await main(process.argv.slice(2));
