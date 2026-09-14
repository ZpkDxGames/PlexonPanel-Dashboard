from pathlib import Path

path = Path("app/backups-view-3-4-1.tsx")
text = path.read_text()

old = '''  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(FAILURE_KEY);
      if (stored) setLastFailure(JSON.parse(stored) as FailureRecord);
    } catch {
      // A blocked session store must not block operational controls.
    }
  }, []);'''
new = '''  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.sessionStorage.getItem(FAILURE_KEY);
      if (stored) {
        timer = window.setTimeout(() => {
          try {
            setLastFailure(JSON.parse(stored) as FailureRecord);
          } catch {
            // Invalid persisted diagnostics are ignored.
          }
        }, 0);
      }
    } catch {
      // A blocked session store must not block operational controls.
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);'''
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f"stored failure effect: expected one match, found {text.count(old)}")
    text = text.replace(old, new)

old = '''  useEffect(() => {
    props.setUnsaved?.(dirty);
    return () => props.setUnsaved?.(false);
  }, [dirty, props.setUnsaved]);'''
new = '''  const setUnsaved = props.setUnsaved;
  useEffect(() => {
    setUnsaved?.(dirty);
    return () => setUnsaved?.(false);
  }, [dirty, setUnsaved]);'''
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f"unsaved effect: expected one match, found {text.count(old)}")
    text = text.replace(old, new)

path.write_text(text)
print("3.4.1 backup view lint fixes applied")
