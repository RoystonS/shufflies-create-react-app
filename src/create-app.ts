import type { Dirent } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ScaffoldError } from "./errors.ts";
import { applyOverlay } from "./features.ts";
import { isRecord, MANIFEST_FILE, readJsonRecord, writeJson } from "./json.ts";

/** Directory, relative to the package root, that holds the application template. */
const TEMPLATE_DIRECTORY_NAME = "template";

/** Directory, relative to the package root, that holds the optional feature overlays. */
const FEATURES_DIRECTORY_NAME = "features";

/** Overlay that adds Playwright browser and component tests, behind `--playwright`. */
export const PLAYWRIGHT_FEATURE = "playwright";

/**
 * Template files that are renamed while scaffolding.
 *
 * `_gitignore` is stored without its leading dot because npm drops real
 * `.gitignore` files from published tarballs.
 *
 * `_oxlint.config.ts` is stored without its real name because oxlint treats any
 * nested `oxlint.config.ts` as a config for its own directory, which would make
 * the template un-ignorable by this repository's own lint run.
 */
const TEMPLATE_RENAMES: ReadonlyMap<string, string> = new Map([
  ["_gitignore", ".gitignore"],
  ["_oxlint.config.ts", "oxlint.config.ts"],
]);

/** Project name used when the caller does not supply a directory. */
export const DEFAULT_PROJECT_NAME = "shufflies-react-app";

/** Longest name npm accepts, per the package name guidelines. */
const MAX_PACKAGE_NAME_LENGTH = 214;

// Any run of characters outside this set collapses to a single hyphen, which
// keeps the generated name in kebab-case (`My_App.v2` becomes `my-app-v2`).
const INVALID_NAME_CHARACTERS = /[^a-z0-9~]+/gu;
const LEADING_HYPHENS = /^-+/u;
const TRAILING_HYPHENS = /-+$/u;

/** Flags that end argument parsing with an informational command. */
const INFORMATIONAL_FLAGS: ReadonlyMap<string, "help" | "version"> = new Map([
  ["--help", "help"],
  ["-h", "help"],
  ["--version", "version"],
  ["-v", "version"],
]);

/** Boolean options a caller can turn on with a flag. */
const BOOLEAN_FLAGS: ReadonlyMap<string, "force" | "playwright"> = new Map([
  ["--force", "force"],
  ["-f", "force"],
  ["--playwright", "playwright"],
]);

/** Options that are on or off, as opposed to the target directory. */
type Options = Record<"force" | "playwright", boolean>;

export type ParsedArguments =
  | { readonly command: "help" }
  | { readonly command: "version" }
  | {
      readonly command: "scaffold";
      readonly force: boolean;
      readonly playwright: boolean;
      readonly targetDirectory?: string;
    };

export type ScaffoldOptions = {
  /** Directory to create the application in. */
  readonly targetDirectory: string;
  /** Allow scaffolding into a directory that already contains files. */
  readonly force?: boolean;
  /** Add the optional Playwright browser and component tests. */
  readonly playwright?: boolean;
};

export type ScaffoldResult = {
  /** Absolute path of the created application. */
  readonly targetDirectory: string;
  /** Name written to the generated `package.json`. */
  readonly packageName: string;
  /** Optional features copied into the application. */
  readonly features: readonly string[];
  /** Template files written, as POSIX-style paths relative to the target directory. */
  readonly files: readonly string[];
};

/** Absolute path of the package root, which sits one level above `src` and `dist`. */
export function packageRootDirectory(): string {
  return fileURLToPath(new URL("../", import.meta.url));
}

/** Absolute path of the bundled application template. */
export function templateDirectory(): string {
  return path.join(packageRootDirectory(), TEMPLATE_DIRECTORY_NAME);
}

/** Resolves to `true` when a path exists, without touching the synchronous fs API. */
export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Reads the version of the initializer from its own `package.json`. */
export async function readPackageVersion(): Promise<string> {
  const manifestPath = path.join(packageRootDirectory(), "package.json");
  const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!isRecord(parsed)) {
    throw new ScaffoldError(`"${manifestPath}" is not a JSON object.`);
  }

  const { version } = parsed;

  if (typeof version !== "string") {
    throw new ScaffoldError(`"${manifestPath}" does not declare a version.`);
  }

  return version;
}

/** Turns free-form input into a valid, lowercase npm package name. */
export function toPackageName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(INVALID_NAME_CHARACTERS, "-")
    .replace(LEADING_HYPHENS, "")
    .replace(TRAILING_HYPHENS, "");

  if (normalized.length === 0 || normalized.length > MAX_PACKAGE_NAME_LENGTH) {
    throw new ScaffoldError(`"${input}" cannot be turned into a valid npm package name.`);
  }

  return normalized;
}

/** Parses command line arguments, rejecting anything unrecognised. */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  const options: Options = { force: false, playwright: false };
  let targetDirectory: string | undefined;

  for (const argument of argv) {
    const command = INFORMATIONAL_FLAGS.get(argument);

    if (command !== undefined) {
      return { command };
    }

    targetDirectory = applyArgument(argument, options, targetDirectory);
  }

  return targetDirectory === undefined
    ? { command: "scaffold", ...options }
    : { command: "scaffold", ...options, targetDirectory };
}

/** Turns one option flag on, or records a positional argument as the target directory. */
function applyArgument(argument: string, options: Options, targetDirectory: string | undefined): string | undefined {
  const option = BOOLEAN_FLAGS.get(argument);

  if (option === undefined) {
    return acceptTarget(targetDirectory, argument);
  }

  options[option] = true;
  return targetDirectory;
}

/** Records a positional argument, rejecting unknown options and extra directories. */
function acceptTarget(current: string | undefined, argument: string): string {
  if (argument.startsWith("-")) {
    throw new ScaffoldError(`Unknown option "${argument}".`);
  }

  if (current !== undefined) {
    throw new ScaffoldError("Expected at most one target directory.");
  }

  return argument;
}

/** Copies the bundled template into the target directory and names the app after it. */
export async function scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const targetDirectory = path.resolve(options.targetDirectory);
  const force = options.force === true;
  const features = options.playwright === true ? [PLAYWRIGHT_FEATURE] : [];

  await assertDirectoryIsAvailable(targetDirectory, force);
  await copyTemplate(targetDirectory);

  if (options.playwright === true) {
    await applyFeature(targetDirectory, PLAYWRIGHT_FEATURE);
  }

  const packageName = await nameApplication(targetDirectory);

  return { targetDirectory, packageName, features, files: await listRelativeFiles(targetDirectory) };
}

async function copyTemplate(targetDirectory: string): Promise<void> {
  await mkdir(targetDirectory, { recursive: true });
  await cp(templateDirectory(), targetDirectory, { recursive: true, force: true });
  await applyTemplateRenames(targetDirectory);
}

async function assertDirectoryIsAvailable(targetDirectory: string, force: boolean): Promise<void> {
  if (force || !(await pathExists(targetDirectory))) {
    return;
  }

  const entries = await readdir(targetDirectory);

  if (entries.length > 0) {
    throw new ScaffoldError(
      `"${targetDirectory}" is not empty. Choose another directory, or pass --force to scaffold into it anyway.`,
    );
  }
}

/** Lists every file below a directory, as sorted POSIX-style relative paths. */
export async function listRelativeFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relativePath(directory, entry))
    .toSorted();
}

function relativePath(directory: string, entry: Dirent): string {
  const absolutePath = path.join(entry.parentPath, entry.name);

  return path.relative(directory, absolutePath).split(path.sep).join("/");
}

async function applyTemplateRenames(targetDirectory: string): Promise<void> {
  const renames = [...TEMPLATE_RENAMES].map(async ([sourceName, targetName]) => {
    const sourcePath = path.join(targetDirectory, sourceName);
    const renamedPath = path.join(targetDirectory, targetName);

    if (await pathExists(sourcePath)) {
      await rename(sourcePath, renamedPath);
    }
  });

  await Promise.all(renames);
}

/**
 * Copies an optional overlay over the generated application. The overlay carries the
 * changes it needs beyond its own files, so it is applied after the template's files
 * have their final names.
 */
async function applyFeature(targetDirectory: string, feature: string): Promise<void> {
  await applyOverlay(targetDirectory, path.join(packageRootDirectory(), FEATURES_DIRECTORY_NAME, feature));
}

async function writePackageName(manifestPath: string, packageName: string): Promise<void> {
  const manifest = await readJsonRecord(manifestPath);

  await writeJson(manifestPath, { ...manifest, name: packageName });
}

/** Names the generated application after its directory, and returns that name. */
async function nameApplication(targetDirectory: string): Promise<string> {
  const packageName = toPackageName(path.basename(targetDirectory));

  await writePackageName(path.join(targetDirectory, MANIFEST_FILE), packageName);
  return packageName;
}
