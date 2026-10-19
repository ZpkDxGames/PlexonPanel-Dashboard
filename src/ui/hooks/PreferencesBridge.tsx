import { useEffect } from "react";
import {
  preferences,
  applyPreferencesToDocument,
  usePreferences,
} from "../../store/preferences";
export function PreferencesBridge() {
  const p = usePreferences();
  useEffect(() => {
    const apply = () => applyPreferencesToDocument(preferences.getSnapshot());
    apply();
    const q = matchMedia("(prefers-color-scheme: light)");
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, [p]);
  return null;
}
