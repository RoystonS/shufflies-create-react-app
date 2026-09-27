# @shufflies/create-react-app

Scaffolds a Vite + React + TypeScript application, with [Vitest](https://vitest.dev/) for
tests and [oxlint](https://oxc.rs/docs/guide/usage/linter/) /
[oxfmt](https://oxc.rs/docs/guide/usage/formatter/) for linting and formatting.

This probably isn't a useful package for you. It's my own personal starting point.

## Usage

With npm:

```shell
npm create @shufflies/react-app@latest my-app
```

With pnpm:

```shell
pnpm create @shufflies/react-app my-app
```

Both forms resolve to this package (`@shufflies/create-react-app`) and forward any
extra arguments to it, but npm claims the options it recognises before the
initializer sees them. Send the initializer's own options after `--`:

```shell
npm create @shufflies/react-app@latest my-app -- --playwright
pnpm create @shufflies/react-app my-app --playwright
```

## Options

```text
Usage: create-shufflies-react-app [options] [directory]

  -f, --force       Scaffold into a directory that already contains files
      --playwright  Add Playwright browser and component tests
  -h, --help        Show usage
  -v, --version     Print the initializer version
```

With no directory argument the initializer prompts for one, defaulting to
`shufflies-react-app`. A directory that already contains files is refused unless
`--force` is passed.

`--playwright` adds browser tests to the generated application: Playwright config
with `e2e` and `components` projects, a sample spec for each, a story for the app
itself and the gallery page that resolves stories. It is off by default, because
running them needs a browser that npm does not install; the generated README says
to run `npm run browser:install` first.

## What you get

- Vite + React + TypeScript, with `react` and `react-dom` as the only runtime
  dependencies.
- Vitest wired into `vite.config.ts`.
- oxlint via the `react` preset from
  [`@shufflies/oxlint-config`](https://www.npmjs.com/package/@shufflies/oxlint-config),
  including type-aware rules.
- oxfmt for formatting, including import sorting.
- Separate TypeScript projects for the app, the build tooling and the specs,
  sharing one base configuration.
- Optional Playwright browser tests (`--playwright`): end-to-end specs, component
  specs that mount stories from a gallery page, and reference screenshots.

## Repository layout

| Path        | Purpose                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`      | The initializer CLI: `create-app.ts` holds the logic, `cli.ts` is the entry point.                                                                      |
| `test/`     | Unit tests plus `scaffold.integration.ts`, which scaffolds a real app and runs its checks.                                                              |
| `template/` | The application that gets copied. Files that cannot be stored under their real names (`_gitignore`, `_oxlint.config.ts`) are renamed while scaffolding. |
| `features/` | Optional overlays: `playwright/` is copied over the template by `--playwright`.                                                                         |
| `dist/`     | The compiled CLI, built by `npm run build` and published alongside the other two.                                                                       |

## Development

| Command                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `npm run build`         | Compile the CLI to `dist/`.                               |
| `npm run typecheck`     | Type-check the CLI, the tests and the scripts.            |
| `npm test`              | Build, then run the unit tests (`pretest` builds first).  |
| `npm run test:scaffold` | Scaffold a throwaway app, install it and run its checks.  |
| `npm run scaffold:demo` | Simulate `npm`/`pnpm create`, keeping the app to inspect. |
| `npm run lint`          | Lint with oxlint.                                         |
| `npm run format`        | Format with oxfmt; CI runs `npm run format:check`.        |

## Inspecting what `create` would produce

`npm run scaffold:demo` reproduces what the published package does when someone
runs one of the create commands: it packs the package to a tarball, installs that
tarball into a scratch project with npm or pnpm, and runs the installed
`create-shufflies-react-app` binary. That covers the published `files` allowlist,
the `bin` wiring and template resolution out of `node_modules`.

```shell
npm run scaffold:demo                           # scaffold only, as `npm create` does
npm run scaffold:demo -- --playwright           # scaffold with the browser tests
npm run scaffold:demo -- --install              # also install deps and run the checks
npm run scaffold:demo -- --playwright --install # check the browser test variant too
npm run scaffold:demo -- --pnpm --install       # do all of it with pnpm
```

`--playwright` is passed on to the initializer, so the app that lands in the run
directory is the one `--playwright` produces. Its own tests need a browser, which
`--install` does not download; install it in the generated app with
`npm run browser:install`.

Everything lands in `<temp>/shufflies-create-demo/<timestamp>/`, and unlike
`npm run test:scaffold`, nothing is deleted when the run finishes, so the app can
be opened in an editor and run.

`npm run test:scaffold` installs the generated app's dependencies, so it needs network
access. It scaffolds both the plain app and the `--playwright` variant and runs each
one's `typecheck`, `lint`, `format:check`, `test` and `build`; the generated app's lint
denies warnings, so a pass means an app that is clean rather than one that merely has no
errors. Pull requests do this on every supported Node version, while the release
workflow sets `CHECK_SCREENSHOTS=1`, which downloads a browser and runs the variant's
Playwright tests as well, recording the reference screenshots on the runner before
comparing against them.

## Releasing

Commits must follow Conventional Commits: `commitlint` runs from the Husky
`commit-msg` hook. Pushes to `main` (or `next`, for prereleases) run
semantic-release, which publishes to npm with provenance and creates a GitHub
release. Dependency chores (`chore(deps): ...`) produce a patch release, because
they change what newly scaffolded projects are generated with.

Publishing uses npm trusted publishing over GitHub OIDC, so the new repository
is configured as a trusted publisher for `@shufflies/create-react-app`.

## Contributing

See [AGENTS.md](./AGENTS.md) for the conventions this repo uses.
