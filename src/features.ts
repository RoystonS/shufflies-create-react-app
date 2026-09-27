import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ScaffoldError } from "./errors.ts";
import { isRecord, MANIFEST_FILE, readJsonRecord, writeJson } from "./json.ts";

/**
 * Files inside an overlay that describe it rather than being copied into the
 * application: the changes to apply, and the README section to append.
 */
const FEATURE_MANIFEST_FILE = "_feature.json";
const FEATURE_README_FILE = "_readme-section.md";

const FEATURE_METADATA_FILES: ReadonlySet<string> = new Set([FEATURE_MANIFEST_FILE, FEATURE_README_FILE]);

/** Changes an overlay makes to the generated `package.json`. */
type PackageJsonPatch = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

/** How an overlay describes itself in `_feature.json`. */
type FeatureManifest = {
  readonly packageJson: PackageJsonPatch;
  /** Lines the feature needs in the generated `.gitignore`. */
  readonly ignore: readonly string[];
};

/**
 * Copies an overlay over the generated application, then applies the changes the
 * overlay declares. A file in the overlay replaces the template file at the same path,
 * which is how an overlay adjusts something it does not own, such as the solution
 * `tsconfig.json` that has to list the project the overlay adds.
 */
export async function applyOverlay(targetDirectory: string, overlayDirectory: string): Promise<void> {
  const manifest = await readFeatureManifest(overlayDirectory);

  await cp(overlayDirectory, targetDirectory, {
    recursive: true,
    force: true,
    filter: (source) => !FEATURE_METADATA_FILES.has(path.basename(source)),
  });

  await patchPackageJson(targetDirectory, manifest.packageJson);
  await appendIgnoreLines(targetDirectory, manifest.ignore);
  await appendReadmeSection(targetDirectory, path.join(overlayDirectory, FEATURE_README_FILE));
}

/** Reads `_feature.json`, which is authored by hand and so is checked as it is read. */
async function readFeatureManifest(overlayDirectory: string): Promise<FeatureManifest> {
  const manifestPath = path.join(overlayDirectory, FEATURE_MANIFEST_FILE);
  const manifest = await readJsonRecord(manifestPath);
  const { packageJson } = manifest;

  if (packageJson !== undefined && !isRecord(packageJson)) {
    throw new ScaffoldError(`"${manifestPath}" must describe "packageJson" as an object.`);
  }

  return {
    ignore: readStringArray(manifest.ignore, manifestPath),
    packageJson: {
      devDependencies: readStringRecord(packageJson?.devDependencies, manifestPath),
      scripts: readStringRecord(packageJson?.scripts, manifestPath),
    },
  };
}

/** Reads a record of strings, such as a `scripts` block, or an empty one when absent. */
function readStringRecord(value: unknown, label: string): Readonly<Record<string, string>> {
  if (value === undefined) {
    return {};
  }

  if (!isStringRecord(value)) {
    throw new ScaffoldError(`"${label}" must describe a record of strings.`);
  }

  return value;
}

/** Reads an array of strings, such as `.gitignore` lines, or an empty one when absent. */
function readStringArray(value: unknown, label: string): readonly string[] {
  if (value === undefined) {
    return [];
  }

  if (!isStringArray(value)) {
    throw new ScaffoldError(`"${label}" must describe an array of strings.`);
  }

  return value;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");
}

/** Merges an overlay's scripts and devDependencies into the generated manifest. */
async function patchPackageJson(targetDirectory: string, patch: PackageJsonPatch): Promise<void> {
  const manifestPath = path.join(targetDirectory, MANIFEST_FILE);
  const manifest = await readJsonRecord(manifestPath);
  const scripts = mergeRecords(manifest.scripts, patch.scripts, manifestPath);
  const devDependencies = mergeSortedRecords(manifest.devDependencies, patch.devDependencies, manifestPath);

  await writeJson(manifestPath, { ...manifest, scripts, devDependencies });
}

/** An overlay's entries win over the ones already in the manifest. */
function mergeRecords(
  existing: unknown,
  added: Readonly<Record<string, string>>,
  manifestPath: string,
): Readonly<Record<string, string>> {
  return { ...readStringRecord(existing, manifestPath), ...added };
}

/**
 * Like `mergeRecords`, but sorted by name. The template lists its dependencies
 * alphabetically, so an overlay's addition belongs in position rather than at the end.
 */
function mergeSortedRecords(
  existing: unknown,
  added: Readonly<Record<string, string>>,
  manifestPath: string,
): Readonly<Record<string, string>> {
  const merged = mergeRecords(existing, added, manifestPath);

  return Object.fromEntries(Object.entries(merged).toSorted(([left], [right]) => left.localeCompare(right, "en")));
}

/** Adds the ignore lines an overlay needs, leaving the ones already there alone. */
async function appendIgnoreLines(targetDirectory: string, lines: readonly string[]): Promise<void> {
  if (lines.length === 0) {
    return;
  }

  const ignorePath = path.join(targetDirectory, ".gitignore");
  const existing = await readFile(ignorePath, "utf8");
  const ignored = new Set(existing.split(/\r?\n/u));
  const missing = lines.filter((line) => !ignored.has(line));

  if (missing.length > 0) {
    await writeFile(ignorePath, `${existing.trimEnd()}\n${missing.join("\n")}\n`, "utf8");
  }
}

/** Appends an overlay's own documentation to the generated README. */
async function appendReadmeSection(targetDirectory: string, sectionPath: string): Promise<void> {
  const readmePath = path.join(targetDirectory, "README.md");
  const readme = await readFile(readmePath, "utf8");
  const written = await readFile(sectionPath, "utf8");

  await writeFile(readmePath, `${readme.trimEnd()}\n\n${written.trim()}\n`, "utf8");
}
