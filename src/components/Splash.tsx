export function Splash() {
  return <main className="splash" aria-labelledby="splash-title" aria-busy="true">
    <div className="splash-content">
      <div className="splash-mark" aria-hidden="true"><span>P</span></div>
      <div>
        <span className="splash-product">PlexonPanel</span>
        <h1 id="splash-title">Preparing your command center</h1>
        <p>Loading local pairings and secure connection settings.</p>
      </div>
      <div className="splash-progress" aria-hidden="true"><i /></div>
      <div className="splash-meta" aria-hidden="true"><span>Local browser authority</span><span>Protocol 3</span></div>
    </div>
  </main>;
}
