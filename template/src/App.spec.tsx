import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App.tsx";

describe("App", () => {
  it("renders the initial counter state", () => {
    expect(renderToStaticMarkup(<App />)).toContain("The counter is at 0.");
  });
});
