import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { describe, it } from "node:test";

import { assertCommandSucceeded, runCommand } from "../scripts/scaffold-support.ts";
import { packageRootDirectory, templateDirectory } from "../src/create-app.ts";

/** The projects the template's `tsconfig.json` references, in the order it lists them. */
const TEMPLATE_PROJECTS = ["tsconfig.app.json", "tsconfig.node.json", "tsconfig.spec.json"] as const;

/**
 * Options `tsconfig.base.json` supplies. Every project has to resolve all of them, which is
 * what stops the block the base file replaced from growing back inside a single project.
 */
const SHARED_COMPILER_OPTIONS = [
  "module",
  "moduleResolution",
  "moduleDetection",
  "strict",
  "noUnusedLocals",
  "noUnusedParameters",
  "noFallthroughCasesInSwitch",
  "isolatedModules",
  "verbatimModuleSyntax",
  "erasableSyntaxOnly",
  "allowImportingTsExtensions",
  "noUncheckedSideEffectImports",
  "noEmit",
  "skipLibCheck",
  "forceConsistentCasingInFileNames",
] as const;

type ResolvedProject = {
  readonly files: readonly string[];
  readonly compilerOptions: Record<string, unknown>;
};

/** Resolving a project spawns `tsc`, so each project is resolved once per run. */
const resolvedProjects = new Map<string, ResolvedProject>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `Array.isArray` narrows `unknown` to `any[]`, which throws the type safety away. This
 * predicate narrows to `unknown[]` so each element stays checked.
 */
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** TypeScript reports resolved files relative to the config file, and Windows uses `\`. */
function toTemplatePath(file: string): string {
  return path.relative(templateDirectory(), path.resolve(templateDirectory(), file)).split(path.sep).join("/");
}

function readResolvedFiles(config: Record<string, unknown>, projectFile: string): readonly string[] {
  const { files } = config;

  assert.ok(isUnknownArray(files), `Expected ${projectFile} to resolve a list of files.`);
  return files.map((file) => {
    assert.ok(typeof file === "string", `Expected ${projectFile} to list its files as paths.`);
    return toTemplatePath(file);
  });
}

function readResolvedCompilerOptions(config: Record<string, unknown>, projectFile: string): Record<string, unknown> {
  const { compilerOptions } = config;

  assert.ok(isPlainObject(compilerOptions), `Expected ${projectFile} to resolve compilerOptions.`);
  return compilerOptions;
}

/**
 * Asks TypeScript what a project resolves to: `extends` chains, and the effect `include` and
 * `exclude` have on each other, only exist after that resolution. Reading the config files as
 * text would not catch a project that has quietly stopped matching the files it claims to check.
 */
function readResolvedConfig(projectFile: string): Record<string, unknown> {
  const configFile = path.join(templateDirectory(), projectFile);
  const typescript = path.join(packageRootDirectory(), "node_modules", "typescript", "bin", "tsc");
  const result = runCommand(process.execPath, [typescript, "-p", configFile, "--showConfig"], packageRootDirectory());

  assertCommandSucceeded(`tsc --showConfig for ${projectFile}`, result);

  const parsed: unknown = JSON.parse(result.output);

  assert.ok(isPlainObject(parsed), `Expected tsc --showConfig to describe ${projectFile} as an object.`);
  return parsed;
}

function resolveProject(projectFile: string): ResolvedProject {
  const cached = resolvedProjects.get(projectFile);

  if (cached !== undefined) {
    return cached;
  }

  const config = readResolvedConfig(projectFile);
  const resolved: ResolvedProject = {
    files: readResolvedFiles(config, projectFile),
    compilerOptions: readResolvedCompilerOptions(config, projectFile),
  };

  resolvedProjects.set(projectFile, resolved);
  return resolved;
}

describe("template TypeScript projects", () => {
  it("gives every project the settings from the shared base file", () => {
    for (const project of TEMPLATE_PROJECTS) {
      const { compilerOptions } = resolveProject(project);

      for (const option of SHARED_COMPILER_OPTIONS) {
        assert.ok(option in compilerOptions, `expected ${project} to resolve ${option} from tsconfig.base.json`);
      }
    }
  });

  it("keeps the three projects apart, so each one checks its own files", () => {
    assert.ok(resolveProject("tsconfig.app.json").files.includes("src/App.tsx"));
    assert.ok(resolveProject("tsconfig.node.json").files.includes("vite.config.ts"));
  });

  it("checks the sample spec in the spec project and not in the app project", () => {
    // `exclude` is inherited from an extended config too, and it filters `include`. A spec
    // project that extends the app project without resetting `exclude` matches no spec files
    // at all, which `tsc -b` reports as success.
    assert.ok(resolveProject("tsconfig.spec.json").files.includes("src/App.spec.tsx"));
    assert.ok(!resolveProject("tsconfig.app.json").files.includes("src/App.spec.tsx"));
  });
});
