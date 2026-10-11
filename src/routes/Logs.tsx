import { copy } from "../i18n/en";
import { ConsoleView } from "../components/ConsoleView";
import { Panel, Button } from "../components/ui";
export default function Logs() {
  return (
    <>
      <Panel
        title={copy.session_history_d7e9e}
        eyebrow={copy.search_and_export_the_retained_server_22db1}
        action={
          <Button onClick={() => (location.hash = "Files")}>
            {copy.browse_log_files_a9901}
          </Button>
        }
      >
        <p className="subtle">
          {copy.the_current_browser_retains_up_to_2_50_2b6e7}
        </p>
      </Panel>
      <ConsoleView readOnly />
    </>
  );
}
