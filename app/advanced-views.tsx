"use client";

import { ActionButton, Badge, Button, Empty, Panel, PageHeader, Select } from "./ui/workspace";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionError, captureActionTarget, sendDashboardAction } from "../lib/data-source";
import { number, records, str, type JsonMap } from "../lib/control-state";
import {
  bytes,
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
  serverId: string,
): Promise<void> {
  const target = captureActionTarget(serverId, kind);
  const start = await sendDashboardAction(action, parameters, kind, target),
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
          target,
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
      target,
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
    selected?.kind ?? (props.can("files.list", "PAPER") ? "PAPER" : "HOST");
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
      const result = await props.run(
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
      return r;
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
    <section className="pp-workspace" data-ui6-workspace="Configuration">
      <PageHeader title="Configuration" description={kind==='HOST'?'Host fallback is read-only.':dirty?'Unsaved changes need review.':'Read and edit permitted text files.'} primary={<ActionButton variant="primary" disabled={!selected?.editable || !dirty || !props.can("files.write",kind)} disabledReason="Open a writable file and make changes first." onClick={save}>{diff?"Save reviewed changes":"Review changes"}</ActionButton>}/>
      <div className="pp-toolbar">
        <label>
          Root
          <Select aria-label="Root"
            value={root}
            onValueChange={(selectedValue) => {
              if (dirty && !window.confirm("Discard unsaved edits?")) return;
              setRoot(selectedValue);
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
          </Select>
        </label>
        <nav className="pp-row" aria-label="File path">
          <Button onClick={() => changeDirectory("")}>{root}</Button>
          {path
            .split("/")
            .filter(Boolean)
            .map((part, i) => (
              <Button
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
              </Button>
            ))}
        </nav>
        <Badge>{kind === "HOST" ? "Host companion" : "Paper agent"}</Badge>
      </div>
      {(listing.error || error) && (
        <p className="pp-notice" role="alert">
          {error || listing.error}
        </p>
      )}
      <div className="pp-file-split">
        <Panel
          title="Files"
          aside={
            <Button className="" onClick={listing.refresh}>
              Refresh
            </Button>
          }
        >
          <div className="pp-stack">
            <label>
              Find a filename
              <input
                placeholder="Search this folder"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="pp-file-list">
            {path && (
              <Button
                onClick={() =>
                  changeDirectory(path.split("/").slice(0, -1).join("/"))
                }
              >
                ↰ Parent folder
              </Button>
            )}
            {listing.busy ? (
              <p className="pp-stack">Loading folder…</p>
            ) : (
              entries.map((e) => (
                <Button
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
                        : `${bytes(e.size)}${e.editable ? "" : ". read-only"}`}
                    </small>
                  </span>
                </Button>
              ))
            )}
          </div>
          <div className="pp-row pp-stack">
            <Button
              className=""
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>{page + 1}</span>
            <Button
              className=""
              disabled={!listing.data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
          {(props.can("files.create", kind) ||
            props.can("files.upload", kind)) && (
            <div className="pp-form pp-stack">
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
                  Upload text file. up to 24 KiB
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
              <div className="pp-toolbar pp-stack">
                <Badge>
                  {selected.editable ? "Editable text" : "Read-only"}
                </Badge>
                <Button
                  className=""
                  onClick={() => setSyntax(!syntax)}
                >
                  {syntax ? "Edit" : "Syntax preview"}
                </Button>
                <Button
                  className=""
                  disabled={!dirty}
                  onClick={() => setDiff(!diff)}
                >
                  {diff ? "Hide diff" : "Review diff"}
                </Button>
                {props.can("files.write", kind) && selected.editable && (
                  <ActionButton disabled={!dirty} onClick={save}>
                    {diff ? "Save reviewed changes" : "Review changes"}
                  </ActionButton>
                )}
                <Button
                  className=""
                  onClick={() => void open(selected.path)}
                >
                  Reload file
                </Button>
              </div>
              {syntax ? (
                <Syntax content={content} />
              ) : (
                <textarea
                  className="pp-editor"
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
                <div className="pp-diff">
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
              <p className="pp-muted pp-stack">
                Changes use the file hash to detect conflicts. Reload the owning
                plugin or restart Paper when required. JSON is validated before
                saving; validate YAML against the plugin&apos;s schema locally.
              </p>
              <div className="pp-row pp-stack">
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
                          props.state.serverId,
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
                    <Button
                      className=""
                      onClick={() => controller.current?.abort()}
                    >
                      Cancel download
                    </Button>
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
    </section>
  );
}
function fuzzy(name: string, query: string) {
  let at = 0;
  for (const c of name.toLowerCase()) if (c === query.toLowerCase()[at]) at++;
  return at === query.length;
}
function Syntax({ content }: { content: string }) {
  return (
    <pre className="pp-syntax">
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
