import { copy } from "../i18n/en";
import { downloadTransfer } from "../adapter/transfers";
import { useEffect, useRef, useState } from "react";
import { session, type Prepared } from "../adapter/session";
import { record, records, str, type JsonMap } from "../adapter/control-state";
import { useSession } from "../hooks";
import { Panel, Button, Notice, Status } from "../components/ui";
import { Icon } from "../components/Icon";
import { ActionReview } from "../features/ActionReview";
export default function Files() {
  const snap = useSession();
  const [path, setPath] = useState(""),
    [entries, setEntries] = useState<JsonMap[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState(""),
    [original, setOriginal] = useState(""),
    [hash, setHash] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [filter, setFilter] = useState("");
  const generation = useRef(snap.revision);
  generation.current = snap.revision;
  const dirty = draft !== original;
  const [destination, setDestination] = useState(""),
    [newName, setNewName] = useState("");
  const kind = (action: string) =>
    session.reason(action, "HOST") && !session.reason(action, "PAPER")
      ? ("PAPER" as const)
      : ("HOST" as const);
  const refresh = async (p = path) => {
    const rev = snap.revision;
    setBusy(true);
    setError("");
    try {
      const r = await session.query(
        "files.list",
        { path: p },
        kind("files.list"),
      );
      if (rev === generation.current)
        setEntries(records(record(r.data).entries));
    } catch (e) {
      if (rev === generation.current)
        setError(e instanceof Error ? e.message : "Files unavailable.");
    } finally {
      if (rev === generation.current) setBusy(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [snap.state.serverId, snap.revision]);
  useEffect(() => {
    if (snap.fixture && entries.length && !selected) void open(entries[0]);
  }, [entries]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const routeGuard = (e: Event) => {
      if (dirty && !confirm("Discard your unsaved file draft?"))
        e.preventDefault();
    };
    addEventListener("beforeunload", warn);
    addEventListener("plexon:beforeNavigate", routeGuard);
    return () => {
      removeEventListener("beforeunload", warn);
      removeEventListener("plexon:beforeNavigate", routeGuard);
    };
  }, [dirty]);
  const open = async (file: JsonMap) => {
    const p = str(file.path, [path, str(file.name)].filter(Boolean).join("/"));
    if (dirty && !confirm("Discard your unsaved draft and open another file?"))
      return;
    if (file.directory === true) {
      setPath(p);
      void refresh(p);
      return;
    }
    const rev = snap.revision;
    setBusy(true);
    setError("");
    try {
      const r = await session.query(
          "files.read",
          { path: p },
          kind("files.read"),
        ),
        data = record(r.data);
      if (rev !== generation.current) return;
      if (data.editable === false || typeof data.content !== "string")
        throw new Error(
          "This file is binary or too large to edit in the browser.",
        );
      setSelected(p);
      setDraft(data.content);
      setOriginal(data.content);
      setHash(str(data.sha256, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const prepare = (a: string, p: JsonMap) => {
    try {
      setPrepared(session.prepare(a, p, kind(a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unavailable.");
    }
  };
  return (
    <>
      <div className="file-toolbar">
        <label className="field">
          {copy.folder_30baa}
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={copy.server_root_4889a}
          />
        </label>
        <Button
          onClick={() => void refresh()}
          disabled={busy || Boolean(session.reason("files.list", "HOST"))}
        >
          <Icon name="folder" />
          {copy.browse_2f3b5}
        </Button>
        <Status tone={dirty ? "warning" : "neutral"}>
          {dirty ? "Unsaved draft" : selected ? "File open" : "Server files"}
        </Status>
      </div>
      <div className="files-layout">
        <Panel
          title={copy.file_browser_b89ec}
          eyebrow={path || "Server root"}
          action={
            <input
              className="compact-search"
              aria-label={copy.find_file_20cdd}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={copy.find_a_file_54887}
            />
          }
        >
          <div className="file-list">
            {entries
              .filter((f) =>
                str(f.name).toLowerCase().includes(filter.toLowerCase()),
              )
              .map((f) => (
                <button
                  className={`file-row ${selected === f.path ? "selected" : ""}`}
                  key={str(f.path, str(f.name))}
                  onClick={() => void open(f)}
                >
                  <span className="file-icon">
                    <Icon name={f.directory === true ? "folder" : "logs"} />
                  </span>
                  <span>
                    <strong>{str(f.name)}</strong>
                    <small>
                      {f.directory === true
                        ? "Folder"
                        : f.editable === true
                          ? "Text file"
                          : "Read only"}
                    </small>
                  </span>
                  <Icon name="chevron" />
                </button>
              ))}
            {!entries.length && (
              <div className="inline-empty">
                <strong>
                  {busy ? "Loading files…" : "No files available"}
                </strong>
                <span>
                  {session.reason("files.list", "HOST") ||
                    "Choose a server folder to browse its contents."}
                </span>
              </div>
            )}
          </div>
        </Panel>
        <Panel
          title={selected || "File editor"}
          eyebrow={copy.reviewed_saves_concurrent_changes_keep_c7f07}
          action={
            <Status tone={dirty ? "warning" : "neutral"}>
              {dirty ? "Modified" : "Saved"}
            </Status>
          }
        >
          {selected ? (
            <>
              <label className="field">
                {copy.contents_f5cbd}
                <textarea
                  className="code-editor"
                  rows={20}
                  spellCheck={false}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                      e.preventDefault();
                      if (dirty && hash)
                        prepare("files.write", {
                          path: selected,
                          content: draft,
                          sha256: hash,
                        });
                    }
                  }}
                />
              </label>
              <div className="button-row">
                <Button
                  variant="primary"
                  disabled={
                    !dirty ||
                    !hash ||
                    Boolean(session.reason("files.write", kind("files.write")))
                  }
                  onClick={() =>
                    prepare("files.write", {
                      path: selected,
                      content: draft,
                      sha256: hash,
                    })
                  }
                >
                  {copy.review_save_72005}
                </Button>
                <Button onClick={() => setDraft(original)} disabled={!dirty}>
                  {copy.reset_draft_cdca2}
                </Button>
                <Button
                  disabled={Boolean(
                    session.reason("files.download", kind("files.download")),
                  )}
                  onClick={() =>
                    void downloadTransfer(
                      "files.download",
                      { path: selected },
                      selected.split("/").at(-1) ?? "file",
                      kind("files.download"),
                      new AbortController().signal,
                      () => {},
                    ).catch((e) => setError(e.message))
                  }
                >
                  {copy.download_a479c}
                </Button>
                <Button
                  variant="danger"
                  disabled={
                    !hash ||
                    Boolean(
                      session.reason("files.delete", kind("files.delete")),
                    )
                  }
                  onClick={() =>
                    prepare("files.delete", { path: selected, sha256: hash })
                  }
                >
                  {copy.delete_f6fdb}
                </Button>
              </div>
              <label className="field" style={{ marginTop: 14 }}>
                {copy.rename_to_23e20}
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={copy.new_relative_path_ffc42}
                />
              </label>
              <Button
                disabled={
                  !destination ||
                  !hash ||
                  Boolean(session.reason("files.rename", kind("files.rename")))
                }
                onClick={() =>
                  prepare("files.rename", {
                    path: selected,
                    destination,
                    sha256: hash,
                  })
                }
              >
                {copy.review_rename_269ae}
              </Button>
              <p className="subtle" style={{ marginTop: 12 }}>
                {copy.ctrl_cmd_s_reviews_the_save_a_server_s_83d94}
              </p>
            </>
          ) : (
            <div className="editor-empty">
              <Icon name="folder" />
              <h2>{copy.pick_a_file_to_get_started_19ba4}</h2>
              <p>{copy.configuration_files_open_here_your_dra_484ad}</p>
            </div>
          )}
        </Panel>
      </div>
      {error && (
        <Notice tone="error" title={copy.files_need_attention_9848c}>
          {error}
        </Notice>
      )}
      <Panel
        title={copy.add_a_text_file_cb48e}
        eyebrow={copy.creates_are_capped_at_24_kib_by_the_se_348f4}
      >
        <div className="button-row">
          <label className="field">
            {copy.filename_a3cbb}
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={copy.config_yml_df5a4}
            />
          </label>
          <Button
            disabled={
              !newName ||
              Boolean(session.reason("files.create", kind("files.create")))
            }
            onClick={() =>
              prepare("files.create", {
                path: [path, newName].filter(Boolean).join("/"),
                content: "",
              })
            }
          >
            {copy.review_create_23211}
          </Button>
          <label className="btn">
            {copy.upload_text_201bc}
            <input
              type="file"
              className="sr-only"
              accept=".yml,.yaml,.properties,.json,.toml,.txt,.log"
              disabled={Boolean(
                session.reason("files.upload", kind("files.upload")),
              )}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 24576) {
                  setError(
                    "Text uploads are limited to 24 KiB by this server.",
                  );
                  return;
                }
                prepare("files.upload", {
                  path: [path, f.name].filter(Boolean).join("/"),
                  content: await f.text(),
                });
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="subtle" style={{ marginTop: 12 }}>
          {copy.file_operations_use_the_agent_that_adv_2ddce}
        </p>
      </Panel>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}
