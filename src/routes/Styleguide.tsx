import { copy } from "../i18n/en";
import { BlockMark } from "../components/BlockMark";
import { Panel, Button, Status, Notice } from "../components/ui";
import { Icon } from "../components/Icon";
export default function Styleguide() {
  return (
    <div className="grid">
      <Panel
        title={copy.visual_contract_02eb1}
        eyebrow={copy.plexonpanel_6_0_supplied_prototype_tok_60ea1}
        className="c-12"
      >
        <div className="style-colors">
          {["c1", "c2", "c3", "c4", "c5"].map((c) => (
            <div key={c}>
              <i style={{ background: `var(--${c})` }} />
              <strong>{c}</strong>
            </div>
          ))}
        </div>
        <h1>{copy.server_health_beautifully_clear_faaf4}</h1>
        <p className="subtle">
          {copy.plus_jakarta_sans_translucent_surfaces_fad07}
        </p>
      </Panel>
      <Panel
        title={copy.cards_and_controls_68dd5}
        eyebrow={copy.prototype_geometry_389ab}
        className="c-8"
      >
        <div className="button-row">
          <Button variant="primary">{copy.primary_action_29911}</Button>
          <Button>{copy.secondary_025de}</Button>
          <Button variant="danger">{copy.danger_58d17}</Button>
          <Status tone="success">{copy.online_c3e83}</Status>
          <Status tone="warning">{copy.starting_7725e}</Status>
          <Status tone="error">{copy.offline_e01fa}</Status>
        </div>
        <Notice title={copy.no_one_is_online_efae1}>
          {copy.the_server_is_quiet_new_joins_appear_h_d64a0}
        </Notice>
      </Panel>
      <Panel
        title={copy.minecraft_identity_a662c}
        eyebrow={copy.original_svg_block_restrained_accents_fc440}
        className="c-4"
      >
        <div className="server-icon">
          <BlockMark />
        </div>
      </Panel>
      <section
        className="card kpi c-4"
        style={{ "--c": "var(--c2)" } as React.CSSProperties}
      >
        <div className="kpi-top">
          <span className="kpi-chip">
            <Icon name="performance" />
          </span>
          <div className="kpi-label">
            {copy.tick_rate_528a7}
            <small>{copy.target_20_97209}</small>
          </div>
        </div>
        <div className="kpi-main">
          <strong className="kpi-value num">20.00</strong>
          <span className="kpi-unit">{copy.tps_1d8e7}</span>
        </div>
        <div className="kpi-foot">
          <span className="delta up">{copy["20_0_average_73874"]}</span>
        </div>
        <svg className="spark" viewBox="0 0 180 40">
          <path className="ln" d="M0 20H180" />
        </svg>
      </section>
      <section className="card console c-8">
        <header className="con-head">
          <h2>{copy.console_9f334}</h2>
          <span className="conn">{copy.connected_c2f9b}</span>
        </header>
        <div className="log">
          <div className="log-row k-done">
            <time className="log-time">19:12:42</time>
            <span className="log-lvl">{copy.info_9c9cf}</span>
            <span className="log-src plugin">{copy.paper_22d50}</span>
            <span className="log-msg">{copy.server_is_ready_6ce62}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
