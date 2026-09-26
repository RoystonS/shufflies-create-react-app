# Vite + React + TypeScript

This project was scaffolded with
[`@shufflies/create-react-app`](https://www.npmjs.com/package/@shufflies/create-react-app).

`react` and `react-dom` are the only runtime dependencies.

## Getting started

```shell
npm install
npm run dev
```

## Scripts

| Script                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server.                           |
| `npm run build`        | Type-check every project, then build for production. |
| `npm run preview`      | Serve the production build locally.                  |
| `npm run typecheck`    | Type-check the app, tooling and spec projects.       |
| `npm test`             | Run the Vitest suite once.                           |
| `npm run test:watch`   | Run Vitest in watch mode.                            |
| `npm run lint`         | Lint with oxlint.                                    |
| `npm run lint:fix`     | Lint and apply safe fixes.                           |
| `npm run format`       | Format with oxfmt.                                   |
| `npm run format:check` | Check formatting without writing anything.           |

## TypeScript projects

`tsconfig.json` is a solution file that references three projects, so `tsc -b`
checks them all and editors pick the right settings per file.

| File                 | Covers                                           |
| -------------------- | ------------------------------------------------ |
| `tsconfig.app.json`  | `src/` browser code.                             |
| `tsconfig.node.json` | `vite.config.ts` and `oxlint.config.ts`.         |
| `tsconfig.spec.json` | The `*.spec.*` and `*.test.*` files under `src`. |

## Tooling

- **Tests** run with [Vitest](https://vitest.dev/), configured in `vite.config.ts`.
  Both `*.spec.tsx` and `*.test.tsx` files under `src` are picked up; the sample that
  ships here is `src/App.spec.tsx`. It renders with `react-dom/server`, so no DOM
  implementation is required. To test in a browser-like environment instead, install
  `jsdom` and set `test.environment` in `vite.config.ts`.
- **Linting** uses [oxlint](https://oxc.rs/docs/guide/usage/linter/) with the
  `react` preset from [`@shufflies/oxlint-config`](https://www.npmjs.com/package/@shufflies/oxlint-config),
  including type-aware rules.
- **Formatting** uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter/),
  configured in `.oxfmtrc.json`, which also sorts imports.
- **`.prototools`** pins Node 26 and npm 12 for anyone using
  [proto](https://moonrepo.dev/proto). Delete it if you don't.
- **Editor setup** lives in `.vscode/`. See below.

## Editor setup

`.vscode/extensions.json` recommends two extensions, and VS Code offers to install
them when the project is opened.

| Extension         | Why                                                     |
| ----------------- | ------------------------------------------------------- |
| `oxc.oxc-vscode`  | oxlint diagnostics and oxfmt formatting, in the editor. |
| `vitest.explorer` | Run and debug the Vitest suite from the editor.         |

`.vscode/settings.json` makes `oxc.oxc-vscode` the default formatter, pins it for
every language the project uses, and runs `source.format.oxc` and
`source.fixAll.oxc` on save, so saved files stay in the shape that
`npm run format:check` and `npm run lint` expect.

The per-language entries look redundant next to `editor.defaultFormatter`, but they
are load-bearing: VS Code lets a language-scoped setting win over the generic
default, so a user-level Prettier configuration for `[javascript]`, `[json]` or
`[markdown]` would otherwise format those files differently from `oxfmt`.
