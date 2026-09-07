"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionError, sendDashboardAction } from "../lib/data-source";
import { number, records, str, type JsonMap } from "../lib/control-state";
import { SCOPES } from "../lib/scopes";
import {
  ActionButton,
  Agent,
  Badge,
  bytes,
  Empty,
  Panel,
  time,
  useQuery,
  type ViewProps,
} from "./control-views";

export async function downloadTransfer(
  action: "files.download" | "backup.download",
  parameters: JsonMap,
  filename: string,
  kind: "PAPER" | "HOST",
  signal: AbortSignal,
  progress: (n: number) => void,
): Promise<void> {
  const start = await sendDashboardAction(action, parameters, kind),
    id = str(start.data.transferId, ""),
    expected = str(start.data.sha256, ""),
    total = number(start.data.bytes);
  if (!id || total === null || total > 64 * 1024 * 1024)
    throw new Error("Download exceeds browser limits");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  try {
    for (let sequence = 0; sequence <= 4096; sequence++) {
      if (signal.aborted) throw new Error("Download cancelled");
      const result = await sendDashboardAction(
          `${action}.chunk`,
          { transferId: id, sequence },
          kind,
        ),
        data = result.data;
      if (
        data.transferId !== id ||
        data.sequence !== sequence ||
        data.sha256 !== expected ||
        typeof data.data !== "string"
      )
        throw new Error("Invalid transfer sequence");
      const binary = atob(data.data);
      if (binary.length > 16384) throw new Error("Chunk exceeds limit");
      const chunk = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      received += chunk.length;
      if (received > total)
        throw new Error("Transfer grew beyond declared size");
      chunks.push(chunk);
      progress(total ? received / total : 1);
      if (data.eof === true) break;
      if (sequence === 4096) throw new Error("Transfer limit exceeded");
    }
    if (received !== total) throw new Error("Incomplete transfer");
    const content = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      content.set(chunk, offset);
      offset += chunk.length;
    }
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", content)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== expected) throw new Error("SHA-256 verification failed");
    if (signal.aborted) throw new Error("Download cancelled");
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/octet-stream" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    void sendDashboardAction(
      action === "files.download"
        ? "files.transfer.cancel"
        : "backup.download.cancel",
      { transferId: id },
      kind,
    ).catch(() => {});
  }
}
export function FilesView(props: ViewProps) {
  const [root, setRoot] = useState("server"),
    [path, setPath] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<{
      path: string;
      sha256: string;
      original: string;
      editable: boolean;
      kind: "PAPER" | "HOST";
    } | null>(null),
    [content, setContent] = useState(""),
    [diff, setDiff] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [syntax, setSyntax] = useState(false),
    [download, setDownload] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const kind: "PAPER" | "HOST" =
    selected?.kind ?? (props.state.ready?.agents.host ? "HOST" : "PAPER");
  const allowed = props.can("files.list", kind),
    listing = useQuery("files.list", { root, path, page }, allowed, kind),
    entries = records(listing.data.entries, 100).filter((e) =>
      fuzzy(str(e.name), search),
    ),
    dirty = selected !== null && content !== selected.original;
  const setUnsaved = props.setUnsaved;
  useEffect(() => {
    setUnsaved?.(dirty);
    return () => setUnsaved?.(false);
  }, [dirty, setUnsaved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const changeDirectory = (next: string) => {
    if (
      dirty &&
      !window.confirm("Discard unsaved edits before opening another folder?")
    )
      return;
    setSelected(null);
    setContent("");
    setDiff(false);
    setPath(next);
    setPage(0);
    setError("");
  };
  const open = async (file: string, canRead = true) => {
    if (dirty && !window.confirm("Discard unsaved edits?")) return;
    setError("");
    if (!canRead || !props.can("files.read", kind)) {
      setSelected({
        path: file,
        sha256: "",
        original: "",
        editable: false,
        kind,
      });
      setContent("");
      setDiff(false);
      return;
    }
    try {
      const result = await sendDashboardAction(
        "files.read",
        { root, path: file },
        kind,
      );
      const original = str(result.data.content, "");
      setSelected({
        path: file,
        sha256: str(result.data.sha256),
        original,
        editable: result.data.editable === true,
        kind,
      });
      setContent(original);
      setDiff(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File cannot be opened");
    }
  };
  const save = useCallback(async () => {
    if (!selected || !dirty || !props.can("files.write", kind)) return;
    setError("");
    if (new TextEncoder().encode(content).length > 24576) {
      setError("Text files are limited to 24 KiB.");
      return;
    }
    if (selected.path.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch {
        setError("JSON validation failed. Correct the syntax before saving.");
        return;
      }
    }
    if (!diff) {
      setDiff(true);
      return;
    }
    try {
      const r = await props.run(
        "files.write",
        { root, path: selected.path, content, sha256: selected.sha256 },
        kind,
      );
      setSelected({
        ...selected,
        original: content,
        sha256: str(r.data.sha256),
      });
      setDiff(false);
      listing.refresh();
    } catch (e) {
      setError(
        e instanceof ActionError && e.status === "CONFLICT"
          ? "Conflict: the server file changed. Your edits are preserved. Copy them before reloading the file."
          : e instanceof Error
            ? e.message
            : "Save failed",
      );
    }
  }, [selected, dirty, props, kind, content, diff, root, listing]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save]);
  useEffect(() => {
    return () => controller.current?.abort();
  }, []);
  if (!allowed)
    return (
      <Empty title="Files are unavailable">
        This page needs files.list and a locally enabled file root on a
        connected agent.
      </Empty>
    );
  return (
    <>
      <div className="cr-toolbar">
        <label>
          Root
          <select
            value={root}
            onChange={(e) => {
              if (dirty && !window.confirm("Discard unsaved edits?")) return;
              setRoot(e.target.value);
              setSelected(null);
              setPath("");
              setPage(0);
            }}
          >
            {(Array.isArray(listing.data.roots)
              ? listing.data.roots
              : ["server"]
            ).map((r) => (
              <option key={String(r)}>{String(r)}</option>
            ))}
          </select>
        </label>
        <nav className="cr-breadcrumbs" aria-label="File path">
          <button onClick={() => changeDirectory("")}>{root}</button>
          {path
            .split("/")
            .filter(Boolean)
            .map((part, i) => (
              <button
                key={i}
                onClick={() =>
                  changeDirectory(
                    path
                      .split("/")
                      .slice(0, i + 1)
                      .join("/"),
                  )
                }
              >
                / {part}
              </button>
            ))}
        </nav>
        <Badge>{kind === "HOST" ? "Host companion" : "Paper agent"}</Badge>
      </div>
      {(listing.error || error) && (
        <p className="cr-alert" role="alert">
          {error || listing.error}
        </p>
      )}
      <div className="cr-file-split">
        <Panel
          title="Files"
          aside={
            <button className="cr-button" onClick={listing.refresh}>
              Refresh
            </button>
          }
        >
          <div className="cr-pad">
            <label>
              Find a filename
              <input
                placeholder="Search this folder"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="cr-file-list">
            {path && (
              <button
                onClick={() =>
                  changeDirectory(path.split("/").slice(0, -1).join("/"))
                }
              >
                ↰ Parent folder
              </button>
            )}
            {listing.busy ? (
              <p className="cr-pad">Loading folder…</p>
            ) : (
              entries.map((e) => (
                <button
                  key={str(e.name)}
                  className={
                    selected?.path === (path ? path + "/" : "") + e.name
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    const next = (path ? path + "/" : "") + str(e.name);
                    if (e.directory) changeDirectory(next);
                    else
                      void open(
                        next,
                        e.editable === true ||
                          (next.toLowerCase().endsWith(".sql") &&
                            Number(e.size) <= 24576),
                      );
                  }}
                >
                  <span aria-hidden>{e.directory ? "▱" : "▤"}</span>
                  <span>
                    {str(e.name)}
                    <small>
                      {e.directory
                        ? "Folder"
                        : `${bytes(e.size)}${e.editable ? "" : " · read-only"}`}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="cr-actions cr-pad">
            <button
              className="cr-button"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>{page + 1}</span>
            <button
              className="cr-button"
              disabled={!listing.data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
          {(props.can("files.create", kind) ||
            props.can("files.upload", kind)) && (
            <div className="cr-form cr-pad">
              <label>
                New filename
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="example.yml"
                  maxLength={128}
                />
              </label>
              {props.can("files.create", kind) && (
                <ActionButton
                  disabled={!name}
                  onClick={() =>
                    props
                      .run(
                        "files.create",
                        {
                          root,
                          path: (path ? path + "/" : "") + name,
                          content: "",
                        },
                        kind,
                      )
                      .then(() => {
                        setName("");
                        listing.refresh();
                      })
                  }
                >
                  Create text file
                </ActionButton>
              )}
              {props.can("files.upload", kind) && (
                <label>
                  Upload text file · up to 24 KiB
                  <input
                    type="file"
                    accept=".yml,.yaml,.json,.properties,.conf,.toml,.txt,.md"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 24576) {
                        setError("Uploads are limited to 24 KiB text files.");
                        return;
                      }
                      void file
                        .text()
                        .then((text) =>
                          props.run(
                            "files.upload",
                            {
                              root,
                              path: (path ? path + "/" : "") + file.name,
                              content: text,
                            },
                            kind,
                          ),
                        )
                        .then(() => listing.refresh())
                        .catch(() => {});
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </Panel>
        <Panel
          title={selected?.path ?? "Text editor"}
          aside={dirty ? <Badge tone="amber">Unsaved</Badge> : undefined}
        >
          {selected ? (
            <>
              <div className="cr-toolbar cr-pad">
                <Badge>
                  {selected.editable ? "Editable text" : "Read-only"}
                </Badge>
                <button
                  className="cr-button"
                  onClick={() => setSyntax(!syntax)}
                >
                  {syntax ? "Edit" : "Syntax preview"}
                </button>
                <button
                  className="cr-button"
                  disabled={!dirty}
                  onClick={() => setDiff(!diff)}
                >
                  {diff ? "Hide diff" : "Review diff"}
                </button>
                {props.can("files.write", kind) && selected.editable && (
                  <ActionButton disabled={!dirty} onClick={save}>
                    {diff ? "Save reviewed changes" : "Review changes"}
                  </ActionButton>
                )}
                <button
                  className="cr-button"
                  onClick={() => void open(selected.path)}
                >
                  Reload file
                </button>
              </div>
              {syntax ? (
                <Syntax content={content} />
              ) : (
                <textarea
                  className="cr-editor"
                  aria-label="File contents"
                  spellCheck={false}
                  value={content}
                  readOnly={
                    !selected.editable || !props.can("files.write", kind)
                  }
                  onChange={(e) => {
                    setContent(e.target.value);
                    setDiff(false);
                  }}
                />
              )}
              {diff && (
                <div className="cr-diff">
                  <div>
                    <h3>On server when opened</h3>
                    <pre>{selected.original}</pre>
                  </div>
                  <div>
                    <h3>Your changes</h3>
                    <pre>{content}</pre>
                  </div>
                </div>
              )}
              <p className="cr-hint cr-pad">
                Changes use the file hash to detect conflicts. Reload the owning
                plugin or restart Paper when required. JSON is validated before
                saving; validate YAML against the plugin&apos;s schema locally.
              </p>
              <div className="cr-actions cr-pad">
                {props.can("files.download", kind) && (
                  <ActionButton
                    disabled={download !== null}
                    onClick={async () => {
                      controller.current = new AbortController();
                      setDownload(0);
                      try {
                        await downloadTransfer(
                          "files.download",
                          { root, path: selected.path },
                          selected.path.split("/").at(-1)!,
                          kind,
                          controller.current.signal,
                          setDownload,
                        );
                        props.notice("Download verified with SHA-256.");
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Download failed",
                        );
                      } finally {
                        setDownload(null);
                      }
                    }}
                  >
                    Download
                  </ActionButton>
                )}
                {download !== null && (
                  <>
                    <progress max={1} value={download} />
                    <button
                      className="cr-button"
                      onClick={() => controller.current?.abort()}
                    >
                      Cancel download
                    </button>
                  </>
                )}
                {props.can("files.rename", kind) && (
                  <>
                    <input
                      aria-label="New relative filename"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="New filename"
                    />
                    <ActionButton
                      disabled={!name || dirty}
                      onClick={() =>
                        props
                          .run(
                            "files.rename",
                            {
                              root,
                              path: selected.path,
                              destination: (path ? path + "/" : "") + name,
                              sha256: selected.sha256,
                            },
                            kind,
                          )
                          .then(() => {
                            setSelected(null);
                            listing.refresh();
                          })
                      }
                    >
                      Rename
                    </ActionButton>
                  </>
                )}
                {props.can("files.delete", kind) && (
                  <ActionButton
                    danger
                    disabled={dirty}
                    onClick={() =>
                      props
                        .run(
                          "files.delete",
                          {
                            root,
                            path: selected.path,
                            sha256: selected.sha256,
                          },
                          kind,
                        )
                        .then(() => {
                          setSelected(null);
                          listing.refresh();
                        })
                    }
                  >
                    Delete
                  </ActionButton>
                )}
              </div>
            </>
          ) : (
            <Empty title="Choose a text file">
              Browse a configured server root to open a file. Identities,
              secrets, active logs, symlinks and binary edits are restricted.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
function fuzzy(name: string, query: string) {
  let at = 0;
  for (const c of name.toLowerCase()) if (c === query.toLowerCase()[at]) at++;
  return at === query.length;
}
function Syntax({ content }: { content: string }) {
  return (
    <pre className="cr-syntax">
      {content.split("\n").map((line, i) => {
        const match = /^(\s*)([^:#=]+)([:=])(.*)$/.exec(line);
        return (
          <span key={i}>
            {match ? (
              <>
                {match[1]}
                <b>{match[2]}</b>
                {match[3]}
                <i>{match[4]}</i>
              </>
            ) : (
              line
            )}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}
export function BackupsView(props: ViewProps) {
  const [page, setPage] = useState(0);
  const allowed = props.can("backup.list", "HOST"),
    query = useQuery("backup.list", { page }, allowed, "HOST"),
    [restore, setRestore] = useState<{
      id: string;
      token: string;
      serverName: string;
    } | null>(null),
    [typed, setTyped] = useState(""),
    [error, setError] = useState(""),
    [download, setDownload] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!allowed)
    return (
      <Empty title="Backups need the host companion">
        Connect the host agent and enable backups locally. Your device also
        needs backup.view.
      </Empty>
    );
  const progress = props.state.backupProgress;
  return (
    <>
      <div className="cr-toolbar">
        <p>
          Local archives remain authoritative. Provider:{" "}
          {str(query.data.provider)}
        </p>
        <button className="cr-button" onClick={query.refresh}>
          Refresh
        </button>
        {props.can("backup.create", "HOST") && (
          <ActionButton
            onClick={() =>
              props.run("backup.create", {}, "HOST").then(() => query.refresh())
            }
          >
            Create backup
          </ActionButton>
        )}
      </div>
      {query.data.recoveryRequired === true && (
        <p className="cr-alert">
          Restore recovery is required locally before starting Paper.
        </p>
      )}
      {(query.error || error) && (
        <p className="cr-alert" role="alert">
          {error || query.error}
        </p>
      )}
      {progress && (
        <Panel
          title="Backup progress"
          aside={<Badge>{str(progress.phase)}</Badge>}
        >
          <div className="cr-pad">
            <progress
              max={1}
              value={
                ["complete", "restored"].includes(str(progress.phase))
                  ? 1
                  : undefined
              }
            />
            <p>
              {bytes(progress.bytes)} processed · {str(progress.backupId)}
            </p>
          </div>
        </Panel>
      )}
      <Panel title="Available backups">
        {records(query.data.backups, 1000).length ? (
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Size / duration</th>
                  <th>Copies</th>
                  <th>SHA-256</th>
                  <th>Origin</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records(query.data.backups, 1000)
                  .slice(0, 100)
                  .map((b) => (
                    <tr key={str(b.backupId)}>
                      <td>
                        {time(b.timestamp)}
                        <small>{str(b.state)}</small>
                      </td>
                      <td>
                        {bytes(b.bytes)}
                        <small>
                          {Math.round(Number(b.durationMillis) / 1000)} seconds
                        </small>
                      </td>
                      <td>
                        <Badge tone={b.local ? "green" : "quiet"}>Local</Badge>
                        <Badge tone={b.offsite ? "green" : "quiet"}>
                          {b.offsite ? "Off-site" : "No off-site copy"}
                        </Badge>
                        {Boolean(b.error) && <small>{str(b.error)}</small>}
                      </td>
                      <td>
                        <button
                          className="cr-text-button"
                          title="Copy complete SHA-256"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(str(b.sha256))
                              .then(() => props.notice("SHA-256 copied."))
                          }
                        >
                          {str(b.sha256).slice(0, 12)}…
                        </button>
                      </td>
                      <td>
                        {b.emergency
                          ? "Emergency"
                          : b.automatic
                            ? "Scheduled"
                            : "Manual"}
                        <small>{str(b.initiatedBy)}</small>
                      </td>
                      <td>
                        <div className="cr-actions">
                          {props.can("backup.download", "HOST") && (
                            <ActionButton
                              disabled={
                                download !== null ||
                                Number(b.bytes) > 64 * 1024 * 1024
                              }
                              onClick={async () => {
                                controller.current = new AbortController();
                                setDownload(0);
                                try {
                                  await downloadTransfer(
                                    "backup.download",
                                    { backupId: b.backupId },
                                    `PlexonPanel-${b.backupId}.zip`,
                                    "HOST",
                                    controller.current.signal,
                                    setDownload,
                                  );
                                } catch (e) {
                                  setError(
                                    e instanceof Error
                                      ? e.message
                                      : "Download failed",
                                  );
                                } finally {
                                  setDownload(null);
                                }
                              }}
                            >
                              Download
                            </ActionButton>
                          )}
                          {props.can("backup.restore.prepare", "HOST") && (
                            <ActionButton
                              danger
                              onClick={() =>
                                props
                                  .run(
                                    "backup.restore.prepare",
                                    { backupId: b.backupId },
                                    "HOST",
                                  )
                                  .then((r) => {
                                    setTyped("");
                                    setRestore({
                                      id: str(b.backupId),
                                      token: str(r.data.confirmationToken),
                                      serverName: str(r.data.serverName),
                                    });
                                  })
                              }
                            >
                              Restore
                            </ActionButton>
                          )}
                          {props.can("backup.delete", "HOST") &&
                            !b.emergency && (
                              <ActionButton
                                danger
                                onClick={() =>
                                  props
                                    .run(
                                      "backup.delete",
                                      { backupId: b.backupId },
                                      "HOST",
                                    )
                                    .then(() => query.refresh())
                                }
                              >
                                Delete
                              </ActionButton>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={query.busy ? "Loading backups…" : "No backups yet"}>
            Create a manual archive or configure a local schedule.
          </Empty>
        )}
      </Panel>
      {download !== null && (
        <div className="cr-toolbar">
          <progress max={1} value={download} />
          <button
            className="cr-button"
            onClick={() => controller.current?.abort()}
          >
            Cancel download
          </button>
        </div>
      )}
      <div className="cr-actions">
        <button
          className="cr-button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="cr-button"
          disabled={query.data.hasMore !== true}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
      {restore && (
        <Panel title="Confirm stopped-server restore">
          <div className="cr-form cr-pad">
            <p>
              Paper must remain stopped. The host will create an emergency
              backup, verify the archive, and keep a rollback journal.
            </p>
            <label>
              Type {restore.serverName} to continue
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="cr-actions">
              <ActionButton
                danger
                disabled={typed !== restore.serverName}
                onClick={() =>
                  props
                    .run(
                      "backup.restore",
                      {
                        backupId: restore.id,
                        confirmationToken: restore.token,
                        serverName: typed,
                      },
                      "HOST",
                    )
                    .then(() => {
                      setRestore(null);
                      query.refresh();
                    })
                }
              >
                Restore archive
              </ActionButton>
              <button className="cr-button" onClick={() => setRestore(null)}>
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      )}
      <p className="cr-hint">
        Browser downloads are limited to 64 MiB. Larger archives remain
        available locally or through the configured off-site provider. Emergency
        backups are retained until reviewed locally.
      </p>
    </>
  );
}
export function ServerView(props: ViewProps) {
  const kind = props.state.ready?.agents.host ? "HOST" : "PAPER",
    query = useQuery(
      "server.status",
      {},
      props.can("server.status", kind),
      kind,
    ),
    service = { ...query.data, ...props.state.service };
  return (
    <>
      <Panel title="Server lifecycle">
        <div className="cr-agent-row">
          <Agent
            name="Paper agent"
            online={Boolean(props.state.ready?.agents.paper)}
            detail={props.state.ready?.server.pluginVersion ?? "—"}
          />
          <Agent
            name="Host companion"
            online={Boolean(props.state.ready?.agents.host)}
            detail={
              props.state.ready?.agents.hostInstalled
                ? "Attached locally"
                : "Not installed"
            }
          />
        </div>
        <div className="cr-pad">
          <Badge tone={props.state.ready?.agents.paper ? "green" : "amber"}>
            {str(
              service.state,
              props.state.ready?.agents.paper ? "running" : "Paper offline",
            )}
          </Badge>
          <div className="cr-actions">
            {["start", "stop", "restart"]
              .filter((a) => props.can(`server.${a}`, "HOST"))
              .map((a) => (
                <ActionButton
                  key={a}
                  danger={a !== "start"}
                  onClick={() =>
                    props
                      .run(`server.${a}`, {}, "HOST")
                      .then(() => query.refresh())
                  }
                >
                  {a === "start"
                    ? "Start"
                    : a === "stop"
                      ? "Graceful stop"
                      : "Restart"}
                </ActionButton>
              ))}
          </div>
          {!props.state.ready?.agents.host && (
            <p className="cr-hint">
              Starting or restarting Paper requires the optional host companion.
              The plugin remains available for monitoring and authorized Paper
              actions.
            </p>
          )}
          <p className="cr-hint">
            A start or restart succeeds only after the relay observes an
            authenticated Paper connection.
          </p>
          {query.error && <p className="cr-alert">{query.error}</p>}
        </div>
      </Panel>
      <Panel title="Runtime details">
        <dl className="cr-details cr-pad">
          {[
            ["Service", service.service],
            ["PID", service.pid],
            ["Java", props.state.system.javaVersion],
            ["Operating system", props.state.system.operatingSystem],
            ["Architecture", props.state.system.architecture],
            ["Minecraft", props.state.ready?.server.minecraftVersion],
            ["Paper agent", props.state.ready?.server.pluginVersion],
            ["Host agent", props.state.ready?.server.hostVersion],
            ["Dashboard", "2.2.0"],
            ["Protocol", "3"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt>{String(k)}</dt>
              <dd>{String(v ?? "Unavailable")}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
export function AuditView(props: ViewProps) {
  const [kind, setKind] = useState<"PAPER" | "HOST">("PAPER"),
    [filters, setFilters] = useState({
      actor: "",
      action: "",
      target: "",
      outcome: "",
      from: "",
      to: "",
    }),
    [submitted, setSubmitted] = useState<JsonMap>({}),
    [page, setPage] = useState(0);
  const action = props.can("audit.list", kind) ? "audit.list" : "audit.self",
    allowed = props.can(action, kind),
    query = useQuery(action, { ...submitted, page }, allowed, kind);
  return (
    <>
      <form
        className="cr-filter-grid"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSubmitted({
            ...filters,
            ...(filters.from
              ? { from: new Date(filters.from).toISOString() }
              : {}),
            ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
          });
        }}
      >
        <label>
          Source
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "PAPER" | "HOST");
              setPage(0);
            }}
          >
            <option>PAPER</option>
            {props.state.ready?.agents.host && <option>HOST</option>}
          </select>
        </label>
        {(["actor", "action", "target", "outcome"] as const).map((k) => (
          <label key={k}>
            {k}
            <input
              value={filters[k]}
              onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}
            />
          </label>
        ))}
        {(["from", "to"] as const).map((k) => (
          <label key={k}>
            {k}
            <input
              type="datetime-local"
              value={filters[k]}
              onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}
            />
          </label>
        ))}
        <button className="cr-button primary">Apply filters</button>
      </form>
      {query.error && <p className="cr-alert">{query.error}</p>}
      <Panel
        title={
          action === "audit.self"
            ? "Your device audit"
            : "Local authoritative audit"
        }
        aside={
          <button className="cr-button" onClick={query.refresh}>
            Refresh
          </button>
        }
      >
        {!allowed ? (
          <Empty title="Audit access unavailable" />
        ) : (
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor / role</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {records(query.data.entries, 50).map((e, i) => (
                  <tr key={`${e.requestId}-${i}`}>
                    <td>{time(e.timestamp)}</td>
                    <td>
                      {str(e.actorLabel)}
                      <small>{str(e.role)}</small>
                    </td>
                    <td>
                      {str(e.actionType)}
                      <small>{str(e.requestId)}</small>
                    </td>
                    <td>{str(e.target)}</td>
                    <td>
                      <Badge
                        tone={
                          e.outcome === "SUCCESS"
                            ? "green"
                            : e.outcome === "STARTED"
                              ? "quiet"
                              : "amber"
                        }
                      >
                        {str(e.outcome)}
                      </Badge>
                      <small>{str(e.code)}</small>
                    </td>
                    <td>{metricDuration(e.durationMillis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!records(query.data.entries).length && (
              <Empty
                title={query.busy ? "Loading audit…" : "No matching records"}
              />
            )}
          </div>
        )}
      </Panel>
      <div className="cr-toolbar">
        <button
          className="cr-button"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1} · 50 records per page</span>
        <button
          className="cr-button"
          disabled={!query.data.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
      <p className="cr-hint">
        Records are retrieved from local rotating JSONL files. This view scans a
        bounded recent window; older records remain available locally within
        retention.
      </p>
    </>
  );
}
function metricDuration(value: unknown) {
  const n = number(value);
  return n === null ? "—" : `${n} ms`;
}
export function AccessView(
  props: ViewProps & { forget: () => Promise<void>; pair: () => void },
) {
  const query = useQuery("devices.list", {}, props.can("devices.list")),
    current = props.state.ready?.device;
  return (
    <>
      <Panel title="This device">
        <div className="cr-pad">
          <h3>{current?.name ?? "Browser"}</h3>
          <Badge tone="cyan">{current?.role ?? "Unknown role"}</Badge>
          <p>
            Expires {time(current?.expiresAt)} · Paired{" "}
            {time(current?.issuedAt)}
          </p>
          <div className="cr-scope-list">
            {current?.scopes.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          <div className="cr-actions">
            <button className="cr-button" onClick={props.pair}>
              Pair another server
            </button>
            <ActionButton danger onClick={props.forget}>
              Forget this device
            </ActionButton>
          </div>
          <p className="cr-hint">
            Pairing a new device always requires a code generated locally with
            /plexonpanel pair &lt;role&gt;.
          </p>
        </div>
      </Panel>
      {props.can("devices.list") && (
        <Panel
          title="Paired devices"
          aside={
            <button className="cr-button" onClick={query.refresh}>
              Refresh
            </button>
          }
        >
          <div className="cr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Role</th>
                  <th>Paired</th>
                  <th>Last seen</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records(query.data.devices, 64).map((d) => (
                  <tr key={str(d.deviceId)}>
                    <td>
                      {str(d.name)}
                      <small>{str(d.deviceId)}</small>
                    </td>
                    <td>{str(d.role)}</td>
                    <td>{time(d.issuedAt)}</td>
                    <td>{time(d.lastSeen)}</td>
                    <td>{time(d.expiresAt)}</td>
                    <td>
                      {props.can("devices.revoke") && (
                        <ActionButton
                          danger
                          onClick={() =>
                            props
                              .run("devices.revoke", { deviceId: d.deviceId })
                              .then(() => query.refresh())
                          }
                        >
                          Revoke
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.error && <p className="cr-alert">{query.error}</p>}
        </Panel>
      )}
    </>
  );
}
export function SettingsView(props: ViewProps & { reconnect: () => void }) {
  const [density, setDensity] = useState("comfortable");
  useEffect(() => {
    const value = localStorage.getItem("plexonpanel-density") ?? "comfortable";
    Promise.resolve().then(() => setDensity(value));
  }, []);
  const ready = props.state.ready;
  return (
    <>
      <Panel title="Connection">
        <dl className="cr-details cr-pad">
          <div>
            <dt>Protocol</dt>
            <dd>3</dd>
          </div>
          <div>
            <dt>Server identity</dt>
            <dd>{props.state.serverId}</dd>
          </div>
          <div>
            <dt>Fingerprint</dt>
            <dd>{ready?.server.fingerprint ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Device role</dt>
            <dd>{ready?.device.role ?? "Unknown"}</dd>
          </div>
        </dl>
        <div className="cr-actions cr-pad">
          <button className="cr-button" onClick={props.reconnect}>
            Reconnect
          </button>
        </div>
      </Panel>
      <Panel title="Appearance">
        <label className="cr-pad">
          Table density
          <select
            value={density}
            onChange={(e) => {
              const value = e.target.value;
              setDensity(value);
              localStorage.setItem("plexonpanel-density", value);
              document.documentElement.dataset.plexonDensity = value;
            }}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <p className="cr-hint cr-pad">Saved only in this browser.</p>
      </Panel>
      <Panel title="Local capabilities">
        <div className="cr-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scope</th>
                <th>Paper policy</th>
                <th>Host policy</th>
                <th>This device</th>
              </tr>
            </thead>
            <tbody>
              {SCOPES.map((scope) => (
                <tr key={scope}>
                  <td>{scope}</td>
                  <td>
                    <Badge
                      tone={
                        ready?.server.paperCapabilities[scope]
                          ? "green"
                          : "quiet"
                      }
                    >
                      {ready?.server.paperCapabilities[scope]
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      tone={
                        ready?.server.hostCapabilities[scope]
                          ? "green"
                          : "quiet"
                      }
                    >
                      {ready?.server.hostCapabilities[scope]
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </td>
                  <td>
                    {ready?.device.scopes.includes(scope)
                      ? "Granted"
                      : "Not granted"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cr-hint cr-pad">
          Security capabilities are configured locally. This browser cannot
          enable a disabled capability or grant itself a scope.
        </p>
      </Panel>
    </>
  );
}
