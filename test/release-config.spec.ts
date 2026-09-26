import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

// The release config is CommonJS and untyped, so it is loaded through `require` and
// narrowed here rather than imported.
const require = createRequire(import.meta.url);
const releaseConfig: unknown = require("../release.config.cjs");

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

/** The options object for `name`, for plugins written as `[name, options]`. */
function pluginOptions(name: string): Record<string, unknown> {
  assert.ok(isPlainObject(releaseConfig), "release.config.cjs must export an object");

  const { plugins } = releaseConfig;
  assert.ok(isUnknownArray(plugins), "release.config.cjs must configure plugins");

  const entry = plugins.find((plugin) => (isUnknownArray(plugin) ? plugin[0] : plugin) === name);
  assert.ok(entry !== undefined, `release.config.cjs must configure ${name}`);

  if (!isUnknownArray(entry)) {
    return {};
  }

  const options = entry[1];
  assert.ok(isPlainObject(options), `${name} must be configured with an options object`);
  return options;
}

function publishCommand(): string {
  const { publishCmd } = pluginOptions("@semantic-release/exec");

  assert.ok(typeof publishCmd === "string", "the exec plugin must configure a publishCmd");
  return publishCmd;
}

describe("release configuration", () => {
  it("keeps npm's human-readable publish output off stdout", () => {
    // `@semantic-release/exec` parses `publishCmd`'s stdout as JSON release
    // information and logs a JSONError when it finds something else, which reads like a
    // failed publish when the publish actually succeeded. npm writes its lifecycle
    // banners and the packed tarball name to stdout, so the command has to redirect
    // them: `--silent` only silences npm's `notice` lines, it does not empty stdout.
    assert.match(publishCommand(), /1>&2\s*$/u);
  });

  it("publishes on the channel semantic-release selected", () => {
    // A literal tag would send prereleases from `next` to `latest`.
    assert.match(publishCommand(), /--tag \$[{]nextRelease\.channel/u);
  });

  it("leaves publishing to the staged npm command alone", () => {
    // The npm plugin cannot run npm 12's staged flow, so it must not publish as well.
    assert.equal(pluginOptions("@semantic-release/npm").npmPublish, false);
  });
});
