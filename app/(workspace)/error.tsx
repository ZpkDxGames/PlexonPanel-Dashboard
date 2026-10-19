"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="pp-page">
      <h1>Workspace unavailable</h1>
      <p className="muted">
        The current view could not be rendered. Retry to request a fresh view.
      </p>
      <button className="pp-ctl" onClick={reset}>
        Retry workspace
      </button>
    </div>
  );
}
