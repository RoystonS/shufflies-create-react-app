import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>Vite + React</h1>
      <p className="app__status">The counter is at {count}.</p>
      <button
        type="button"
        onClick={() => {
          setCount((current) => current + 1);
        }}
      >
        Increment
      </button>
    </main>
  );
}
