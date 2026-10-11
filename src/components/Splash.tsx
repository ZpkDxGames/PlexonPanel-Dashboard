import { copy } from "../i18n/en";
export function Splash() {
  return (
    <main className="splash" aria-labelledby="splash-title" aria-busy="true">
      <div className="splash-content">
        <div className="splash-mark" aria-hidden="true">
          <span>{copy.p_51199}</span>
        </div>
        <div>
          <span className="splash-product">{copy.plexonpanel_1a4a7}</span>
          <h1 id="splash-title">{copy.preparing_your_command_center_93d4d}</h1>
          <p>{copy.loading_local_pairings_and_secure_conn_8e92f}</p>
        </div>
        <div className="splash-progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </main>
  );
}
