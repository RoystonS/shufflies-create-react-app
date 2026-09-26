# Agent & contributor guide

This repo publishes an initializer: `src/` is the CLI, `template/` is the
application it copies. Most changes are "edit the template, add a guard test".

## Commands

| Command                 | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `npm test`              | Builds (`pretest`), then runs the unit tests                 |
| `npm run test:scaffold` | Scaffolds a real app into a temp dir, installs it, checks it |
| `npm run scaffold:demo` | Simulates `npm`/`pnpm create`, and keeps the app to inspect  |
| `npm run format`        | oxfmt; CI runs `format:check`                                |
| `npm run typecheck`     | Type-checks the CLI, the tests and the scripts               |

## TypeScript projects

There is no single tsconfig covering everything. `tsconfig.json` holds the shared
compiler options and is what editors and oxlint's type-aware rules use;
`tsconfig.generator.json` emits the published CLI to `dist/`; and
`tsconfig.spec.json` and `tsconfig.scripts.json` type-check `test/` and `scripts/`
respectively.

Tests and scripts run through Node's native TypeScript support, so they are never
emitted. That is why `erasableSyntaxOnly` is on and why they import source with
explicit `.ts` extensions. The generator itself is emitted as JavaScript, so its
internal imports use `.js` extensions.

## Test files and lint exceptions

`.spec` and `.test` suffixes are both supported everywhere — the `npm test` glob and
the oxlint override for test files accept either — but this repo only _writes_
`.spec` files, and `test/create-app.spec.ts` guards that the template ships a `.spec`
sample.

`test/scaffold.integration.ts` is deliberately not `.spec`: `npm test` runs
`test/*.{test,spec}.ts`, so the `.integration` suffix keeps the slow, network-bound
scaffold check out of the default suite. It is run by `npm run test:scaffold`.

Lint rules that exist for one file's sake live in that file, as a file-wide
`/* oxlint-disable rule/name */` next to a comment saying why. Only rules that apply
by broad file pattern (`*.spec`, `*.test`, `*.integration`, `*.cjs`) are configured
in `oxlint.config.ts`. `npm run lint` passes
`--report-unused-disable-directives-severity error`, so a disable comment that stops
suppressing anything fails the build instead of rotting.

## Simulating a real `create`

`npm run scaffold:demo` packs this package to a tarball, installs that tarball into
a scratch project with npm or pnpm, and runs the installed
`create-shufflies-react-app` binary. It is the only check that exercises the
published `files` allowlist, the `bin` wiring and template resolution out of
`node_modules`, which `npm run test:scaffold` deliberately avoids by calling
`dist/cli.js` directly.

It writes under `<os temp>/shufflies-create-demo/<timestamp>/` and never deletes
anything. Pass `--install` to also install the generated app's dependencies and run
its checks, and `--pnpm` to do everything with pnpm. `scripts/` is not published:
`package.json` only ships `dist` and `template`.

## Editing the template

- `template/package.json` must keep `react` and `react-dom` as its only runtime
  dependencies. `test/create-app.spec.ts` enforces this.
- `template/_gitignore` and `template/_oxlint.config.ts` are stored under
  placeholder names and renamed while scaffolding by `TEMPLATE_RENAMES` in
  `src/create-app.ts`. Two reasons: npm drops real `.gitignore` files from
  published tarballs, and oxlint treats a nested `oxlint.config.ts` as the config
  for its own directory, which would stop this repo from ignoring `template/`.
- `template/` is excluded from this repo's own lint run via `ignorePatterns`,
  because it is a React app that the `react` preset only lints correctly once its
  dependencies are installed. It is linted for real by `npm run test:scaffold`.
- The template is formatted by this repo's oxfmt run, so run `npm run format`
  after editing it.

## Gotchas

- `npm test` builds first. The tests import the compiled CLI from `dist/`.
- The scaffold integration test installs the template's dependencies, so it needs
  network access and is deliberately kept out of `npm test`.
- Adding a dependency anywhere in `template/` means new scaffolds get it; check
  whether it belongs in the app's `devDependencies` instead.
