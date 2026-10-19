import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Copy, Users } from "lucide-react";
import {
  useControl,
  useQuery,
  session,
  duration,
} from "../../hooks/useControl";
import { usePreferences } from "../../../store/preferences";
import { PlayerHead } from "../../primitives/AvatarStack";
import { Pill } from "../../primitives/Pill";
import { Sparkline } from "../../primitives/Sparkline";
import { MutationButton } from "../../review/ActionReviewModal";
import { playerHistoryPage } from "../../../presentation/player-history";
export function PlayerInspector({
  uuid,
  onClose,
}: {
  uuid: string | null;
  onClose: () => void;
}) {
  const { state } = useControl(),
    prefs = usePreferences(),
    p = state.players.find((p) => p.uuid === uuid),
    [cursor, setCursor] = useState<string | undefined>(),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState(false),
    kind = session.reason("players.history.list", "HOST") ? "PAPER" : "HOST",
    query = useQuery(
      "players.history.list",
      kind,
      { query: uuid ?? "", ...(cursor ? { cursor } : {}) },
      !!uuid,
    ),
    history = playerHistoryPage(query.data, uuid ?? "");
  return (
    <Dialog.Root
      open={!!uuid}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setCursor(undefined);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="pp-glass drawer">
          <Dialog.Close
            className="icon-btn absolute top-5 right-5"
            aria-label="Close player inspector"
          >
            <X size={16} />
          </Dialog.Close>
          <div className="flex gap-4 items-center mb-6">
            <PlayerHead
              provider={prefs.skinProvider}
              uuid={uuid ?? ""}
              name={String(p?.name ?? "Player")}
              size={64}
            />
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {String(p?.name ?? "Exact UUID")}
              </Dialog.Title>
              <Pill tone="emerald">{p ? "Online" : "Not in roster"}</Pill>
            </div>
          </div>
          <Dialog.Description>
            Exact identity and history for this current boot session.
          </Dialog.Description>
          <div className="pp-well p-3 mono text-xs break-all mt-4">
            {uuid}
            <button
              className="icon-btn ml-2"
              aria-label="Copy full UUID"
              onClick={() => {
                if (uuid)
                  void navigator.clipboard
                    .writeText(uuid)
                    .then(() => setCopied(true));
              }}
            >
              <Copy size={14} />
            </button>
            {copied && <span role="status">Copied</span>}
          </div>
          <dl className="grid grid-cols-2 gap-4 my-6">
            <div>
              <dt className="eyebrow">First seen this boot</dt>
              <dd className="mono text-xs break-all mt-2">
                {String(query.data.firstSeen ?? "Not reported")}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Last seen this boot</dt>
              <dd className="mono text-xs break-all mt-2">
                {String(query.data.lastSeen ?? "Not reported")}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">World</dt>
              <dd className="mt-2">{String(p?.world ?? "Not reported")}</dd>
            </div>
            <div>
              <dt className="eyebrow">Session</dt>
              <dd className="num mt-2">{duration(p?.onlineDurationMillis)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Position</dt>
              <dd className="mt-2">
                {p?.position
                  ? JSON.stringify(p.position)
                  : "Not exposed by read scope"}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Ping</dt>
              <dd className="num mt-2">
                {String(p?.pingMillis ?? p?.ping ?? "—")} ms
              </dd>
            </div>
          </dl>
          <div className="pp-well p-3" data-tone="cyan">
            <Sparkline values={[]} />
            <p className="text-secondary text-xs mt-2">
              Historical per-player ping is not provided by this producer.
            </p>
          </div>
          <h3 className="mt-6 mb-3">Join and leave history</h3>
          {query.error ? (
            <p className="gate-reason">{query.error}</p>
          ) : (
            <ol className="timeline">
              {history.entries.map((e) => (
                <li
                  key={String(e.eventId)}
                  data-tone={e.state === "JOINED" ? "emerald" : "slate"}
                >
                  {String(e.state)}
                  <p className="text-muted">{String(e.observedAt)}</p>
                  <p>{String(e.termination ?? "")}</p>
                </li>
              ))}
            </ol>
          )}
          {history.cursor && (
            <button
              className="btn mt-3"
              onClick={() => setCursor(history.cursor!)}
            >
              Earlier events
            </button>
          )}
          <div className="pp-hairline my-6" />
          <div className="grid grid-cols-2 gap-3">
            <MutationButton
              action="player.kick"
              kind="PAPER"
              label="Kick"
              tone="amber"
              parameters={{
                playerId: uuid ?? "",
                reason: "Removed by operator",
              }}
            />
            <MutationButton
              action="player.op"
              kind="PAPER"
              label="Op"
              parameters={{ playerId: uuid ?? "" }}
            />
            <MutationButton
              action="player.ban"
              kind="PAPER"
              label="Ban"
              tone="rose"
              parameters={{
                playerId: uuid ?? "",
                reason: "Banned by operator",
              }}
            />
          </div>
          <label className="block mt-5">
            Message
            <input
              className="field block w-full mt-2"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <div className="mt-3">
            <MutationButton
              action="player.message"
              kind="PAPER"
              label="Review message"
              parameters={{ playerId: uuid ?? "", message }}
              extraReason={!message ? "Enter a message before review." : ""}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
