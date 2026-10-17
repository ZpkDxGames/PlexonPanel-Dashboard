"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="workspace">
      <h1>Workspace unavailable</h1>
      <p>Reconnect and check agent state before repeating an operation.</p>
      <button onClick={reset}>Reload workspace</button>
    </main>
  );
}
