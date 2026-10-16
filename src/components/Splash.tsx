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
        Initializing your server workspace
      </div>
      <p>Connected to your worlds.</p>
    </main>
  );
}
