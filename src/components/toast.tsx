import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

type ToastTone = "neutral" | "success" | "warning" | "error";
type ToastItem = {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
};

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
  dismiss(id: number) {
    items = items.filter((item) => item.id !== id);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => items,
};

export function ToastViewport() {
  const current = useSyncExternalStore(toast.subscribe, toast.getSnapshot);
  return (
    <div className="toast-viewport" aria-live="polite">
      {current.map((item) => (
        <div className={`toast ${item.tone}`} key={item.id}>
          <span className="toast-icon">
            <Icon
              name={
                item.tone === "success"
                  ? "check"
                  : item.tone === "error" || item.tone === "warning"
                    ? "alert"
                    : "sparkle"
              }
            />
          </span>
          <span>
            <strong>{item.title}</strong>
            {item.message && <small>{item.message}</small>}
          </span>
          <button
            onClick={() => toast.dismiss(item.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}
