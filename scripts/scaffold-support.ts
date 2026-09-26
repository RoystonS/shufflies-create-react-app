// Scaffolding runs one command at a time and each step needs the previous exit code
// before deciding the next, so `runCommand` deliberately uses the synchronous spawn
// API. `node/no-sync` exists to keep I/O off the event loop, which does not apply to
// a short-lived developer script.
/* oxlint-disable node/no-sync */

import { spawnSync } from "node:child_process";

/** Scripts the generated application is expected to pass. */
export const APP_CHECKS = ["typecheck", "lint", "format:check", "test", "build"] as const;

export type CommandResult = {
  /** The command line that was run, so failures can show what was attempted. */
  readonly commandLine: string;
  /** Combined stdout and stderr. */
  readonly output: string;
  /** Exit code, or `null` when the process was killed by a signal. */
  readonly status: number | null;
};

function quoteForShell(argument: string): string {
  return argument.includes(" ") ? `"${argument}"` : argument;
}

/**
 * Runs a command to completion and captures its output.
 *
 * A shell is always used because `npm` and `pnpm` are shell scripts on POSIX and
 * `.cmd` shims on Windows. Arguments are quoted so paths containing spaces work.
 */
export function runCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const commandLine = [command, ...args].map((argument) => quoteForShell(argument)).join(" ");

  const result = spawnSync(commandLine, {
    cwd,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });

  return { commandLine, output: `${result.stdout}${result.stderr}`, status: result.status };
}

/** Throws with the command line and its output when a command did not succeed. */
export function assertCommandSucceeded(step: string, result: CommandResult): void {
  if (result.status !== 0) {
    throw new Error(`${step} failed (exit code ${result.status}):\n\n  ${result.commandLine}\n\n${result.output}`);
  }
}
