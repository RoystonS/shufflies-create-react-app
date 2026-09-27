## Browser tests

This app also carries [Playwright](https://playwright.dev/) browser tests: end-to-end tests
that drive the real application, and component tests that mount one story at a time in a
story gallery. They are separate from the Vitest suite, which stays the fast one.

```shell
npm run browser:install   # once: downloads the Chromium build the tests run in
npm run test:browser
```

| Script                        | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `npm run browser:install`     | Download the browser the tests run in.     |
| `npm run test:browser`        | Run the end-to-end and component projects. |
| `npm run test:browser:update` | Record the reference screenshots again.    |

`playwright.config.ts` starts a dev server for the tests and defines both projects, so a
test never has to start one itself.

### End-to-end tests

`tests/e2e` drives the app the way a user would, against the home page `npm run dev`
serves:

```ts
await page.goto("/");
await page.getByRole("button", { name: "Increment" }).click();
```

### Component tests and stories

`tests/components` mounts one story at a time. A **story** is a small wrapper that puts a
component into one specific scenario, and it lives next to the component it exercises in a
`*.story.tsx` file, one story per named export:

```tsx
// src/App.story.tsx
export function Default() {
  return <App />;
}
```

A story id is the story file's path below `src/`, plus the exported name, so that story is
`App/Default`:

```ts
const component = await mount("App/Default");
await component.getByRole("button", { name: "Increment" }).click();
```

`playwright/gallery/index.html` resolves those ids: it exposes `window.mount()` and
`window.unmount()`, and renders each story into `#root`, the element the locator that
`mount()` returns points at. Because the gallery runs through your own Vite dev server,
stories get your aliases, plugins and CSS. Ids are strings, so renaming or moving a story
breaks a test at runtime rather than at compile time.

### Reference screenshots

`toHaveScreenshot()` compares against a PNG stored next to the test file, named after the
project that took it and the platform it ran on (`app-spec-1-e2e-win32.png`). Commit those
files, and generate them in the same environment that compares them, because browsers
render differently from platform to platform and machine to machine. That also means the
first run writes the reference it needs and reports a failure; run it again and it passes.
