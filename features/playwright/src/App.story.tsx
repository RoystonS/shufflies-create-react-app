import { App } from "./App.tsx";

/**
 * Stories are the scenarios component tests mount by name. This one renders the
 * application exactly as `src/main.tsx` does; its id is `App/Default`, which is the
 * story file's path below `src/` plus the exported name.
 */
export function Default() {
  return <App />;
}
