import type { ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

import "../../src/style.css";

/** A story file: one story component per named export. */
type StoryModule = Record<string, ComponentType<Record<string, unknown>>>;

/** Arguments the `mount()` fixture passes to `window.mount()`. */
type MountParameters = {
  readonly story: string;
  readonly props?: Record<string, unknown>;
};

// `App/Default` is `src/App.story.tsx`'s `Default` export: the story id is the story
// file's path below `src/`, plus the exported name. Lazy imports mean a story's own
// imports are only evaluated when a test mounts it.
const storyModules = new Map(Object.entries(import.meta.glob<StoryModule>("/src/**/*.story.tsx")));

// Reusing one root is what lets `update()` re-render with new props and keep the
// component's state, because React reconciles instead of remounting.
let root: Root | undefined;

function storyLoader(storyId: string) {
  const separator = storyId.lastIndexOf("/");

  if (separator === -1) {
    throw new Error(`"${storyId}" is not a story id. Use the story file's path plus the exported name.`);
  }

  const modulePath = `/src/${storyId.slice(0, separator)}.story.tsx`;
  const loader = storyModules.get(modulePath);

  if (loader === undefined) {
    throw new Error(`No ${modulePath} to mount "${storyId}" from.`);
  }

  return { loader, exportName: storyId.slice(separator + 1) };
}

function rootElement(): HTMLElement {
  const element = document.getElementById("root");

  if (element === null) {
    throw new Error('The gallery page needs a "#root" element to render into.');
  }

  return element;
}

/** Renders a story into `#root`, which is where the fixture's locator points. */
async function mountStory(parameters: MountParameters): Promise<void> {
  const { loader, exportName } = storyLoader(parameters.story);
  const stories = await loader();
  const Story = stories[exportName];

  if (Story === undefined) {
    throw new Error(`"${parameters.story}" is not a story exported by the file it names.`);
  }

  root ??= createRoot(rootElement());
  // Passing the test's props straight to the story is the gallery's whole purpose,
  // which is what the rule against spreading props wants to discourage.
  /* oxlint-disable-next-line react/jsx-props-no-spreading */
  root.render(<Story {...parameters.props} />);
}

declare global {
  // The `mount()` fixture evaluates these on the page; in a browser `globalThis` is
  // the `window` they are documented as.
  var mount: ((parameters: MountParameters) => Promise<void>) | undefined;
  var unmount: (() => void) | undefined;
}

globalThis.mount = mountStory;
globalThis.unmount = () => {
  root?.unmount();
  root = undefined;
};
