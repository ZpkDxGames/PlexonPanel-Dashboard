import { toast as sonner } from "sonner";
export const toast = {
  push(
    title: string,
    message?: string,
    tone: "neutral" | "success" | "warning" | "error" = "neutral",
  ) {
    const options = { description: message };
    return tone === "neutral"
      ? sonner(title, options)
      : sonner[tone](title, options);
  },
  dismiss: (id: number | string) => sonner.dismiss(id),
};
export function ToastViewport() {
  return null;
}
