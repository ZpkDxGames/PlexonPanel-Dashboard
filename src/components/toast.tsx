import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import { usePreferences } from "../store/preferences";
import { motionTokens } from "../motion";

type ToastTone = "neutral" | "success" | "warning" | "error";
type ToastItem = { id: number; title: string; message?: string; tone: ToastTone };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const toast = {
  push(title: string, message?: string, tone: ToastTone = "neutral") {
    const id = nextId++;
    items = [...items, { id, title, message, tone }].slice(-4);
    emit();
    setTimeout(() => toast.dismiss(id), 4200);
  },
  dismiss(id: number) { items = items.filter((item) => item.id !== id); emit(); },
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot: () => items,
};

export function ToastViewport() {
  const current = useSyncExternalStore(toast.subscribe, toast.getSnapshot);
  const { motion: motionPreference } = usePreferences();
  return <div className="toast-viewport" aria-live="polite">
    <AnimatePresence initial={false}>{current.map((item) => <motion.div className={`toast ${item.tone}`} key={item.id} initial={{ opacity: 0, x: motionPreference === "full" ? 24 : 0, scale: motionPreference === "full" ? .98 : 1 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: motionPreference === "full" ? 16 : 0, scale: motionPreference === "full" ? .98 : 1 }} transition={{ duration: motionTokens[motionPreference].base }}>
      <span className="toast-icon"><Icon name={item.tone === "success" ? "check" : item.tone === "error" || item.tone === "warning" ? "alert" : "sparkle"} /></span>
      <span><strong>{item.title}</strong>{item.message && <small>{item.message}</small>}</span>
      <button onClick={() => toast.dismiss(item.id)} aria-label="Dismiss notification"><Icon name="close" /></button>
    </motion.div>)}</AnimatePresence>
  </div>;
}
