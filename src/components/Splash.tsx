import { BrandMark } from "./Brand";
export function Splash() {
  return (
    <main className="splash" aria-label="Initializing PlexonPanel">
      <BrandMark />
      <h1>
        plexon<span>panel</span>
      </h1>
      <div className="splash-progress" role="status">
        <span />
        Opening your operations workspace
      </div>
      <p>Built for the worlds you run.</p>
    </main>
  );
}
