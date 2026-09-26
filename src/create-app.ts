import type { Dirent } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory, relative to the package root, that holds the application template. */
const TEMPLATE_DIRECTORY_NAME = "template";

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

/** Flags that set an option rather than supplying a positional argument. */
const FORCE_FLAGS: ReadonlySet<string> = new Set(["--force", "-f"]);

/** Raised for problems the user can fix, such as a bad name or a non-empty directory. */
export class ScaffoldError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}

export type ParsedArguments =
  | { readonly command: "help" }
  | { readonly command: "version" }
  | { readonly command: "scaffold"; readonly force: boolean; readonly targetDirectory?: string };

export type ScaffoldOptions = {
  /** Directory to create the application in. */
  readonly targetDirectory: string;
  /** Allow scaffolding into a directory that already contains files. */
  readonly force?: boolean;
};

export type ScaffoldResult = {
  /** Absolute path of the created application. */
  readonly targetDirectory: string;
  /** Name written to the generated `package.json`. */
  readonly packageName: string;
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
  let force = false;
  let targetDirectory: string | undefined;

  for (const argument of argv) {
    const command = INFORMATIONAL_FLAGS.get(argument);

    if (command !== undefined) {
      return { command };
    }

    if (FORCE_FLAGS.has(argument)) {
      force = true;
    } else {
      targetDirectory = acceptTarget(targetDirectory, argument);
    }
  }

  return targetDirectory === undefined
    ? { command: "scaffold", force }
    : { command: "scaffold", force, targetDirectory };
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

  await assertDirectoryIsAvailable(targetDirectory, force);
  await mkdir(targetDirectory, { recursive: true });
  await cp(templateDirectory(), targetDirectory, { recursive: true, force: true });
  await applyTemplateRenames(targetDirectory);

  const packageName = toPackageName(path.basename(targetDirectory));
  await writePackageName(path.join(targetDirectory, "package.json"), packageName);

  return { targetDirectory, packageName, files: await listRelativeFiles(targetDirectory) };
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

async function writePackageName(manifestPath: string, packageName: string): Promise<void> {
  const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!isRecord(parsed)) {
    throw new ScaffoldError(`The template manifest at "${manifestPath}" is not a JSON object.`);
  }

  const manifest: Record<string, unknown> = { ...parsed, name: packageName };
  await writeFile(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
