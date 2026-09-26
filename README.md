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
extra arguments to it.

## Options

```text
Usage: create-shufflies-react-app [options] [directory]

  -f, --force    Scaffold into a directory that already contains files
  -h, --help     Show usage
  -v, --version  Print the initializer version
```

With no directory argument the initializer prompts for one, defaulting to
`shufflies-react-app`. A directory that already contains files is refused unless
`--force` is passed.

## What you get

- Vite + React + TypeScript, with `react` and `react-dom` as the only runtime
  dependencies.
- Vitest wired into `vite.config.ts`.
- oxlint via the `react` preset from
  [`@shufflies/oxlint-config`](https://www.npmjs.com/package/@shufflies/oxlint-config),
  including type-aware rules.
- oxfmt for formatting, including import sorting.
- Separate TypeScript projects for the app, the build tooling and the specs.

## Repository layout

| Path        | Purpose                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`      | The initializer CLI: `create-app.ts` holds the logic, `cli.ts` is the entry point.                                                                      |
| `test/`     | Unit tests plus `scaffold.integration.ts`, which scaffolds a real app and runs its checks.                                                              |
| `template/` | The application that gets copied. Files that cannot be stored under their real names (`_gitignore`, `_oxlint.config.ts`) are renamed while scaffolding. |
| `dist/`     | The compiled CLI, built by `npm run build` and published alongside `template/`.                                                                         |

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
npm run scaffold:demo                      # scaffold only, as `npm create` does
npm run scaffold:demo -- --install         # also install deps and run the checks
npm run scaffold:demo -- --pnpm --install  # do all of it with pnpm
```

Everything lands in `<temp>/shufflies-create-demo/<timestamp>/`, and unlike
`npm run test:scaffold`, nothing is deleted when the run finishes, so the app can
be opened in an editor and run.

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
