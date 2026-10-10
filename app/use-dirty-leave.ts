"use client";

import { useCallback, useRef } from "react";

/** Browser navigation shares one dirty-editor guard; it never saves implicitly. */
export function useDirtyLeaveGuard() {
  const unsaved = useRef(false);
  const setUnsaved = useCallback((dirty: boolean) => {
    unsaved.current = dirty;
  }, []);
  const leaveEditor = useCallback(() =>
    !unsaved.current || window.confirm("Discard unsaved changes?"), []);
  const clearUnsaved = useCallback(() => { unsaved.current = false; }, []);
  return { setUnsaved, leaveEditor, clearUnsaved };
}
