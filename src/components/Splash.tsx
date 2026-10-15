import { BrandMark } from "./Brand";
export function Splash() {
  return (
    <main className="splash" aria-label="Initializing PlexonPanel">
      <div className="splash-emblem">
        <BrandMark />
      </div>
      <h1>PlexonPanel</h1>
      <p>Clarity for every world.</p>
      <div className="splash-progress" role="status">
        <span />
        Preparing your workspace
      </div>
    </main>
  );
}
