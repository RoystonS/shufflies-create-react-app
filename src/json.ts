import { readFile, writeFile } from "node:fs/promises";

import { ScaffoldError } from "./errors.ts";

/** File a manifest lives in, both in this package and in a generated application. */
export const MANIFEST_FILE = "package.json";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a JSON file that has to hold an object. */
export async function readJsonRecord(filePath: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

  if (!isRecord(parsed)) {
    throw new ScaffoldError(`"${filePath}" is not a JSON object.`);
  }

  return parsed;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`, "utf8");
}
