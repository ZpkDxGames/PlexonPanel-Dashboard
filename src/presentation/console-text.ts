/** Presentation only. Retain the canonical Host row and strip only known leading Paper/journal metadata. */
export function consoleMessage(value: string): string {
  return value.replace(
    /^(?:\u001b\[[0-9;]*m)*(?:\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+(?:INFO|WARN|WARNING|ERROR|DEBUG|TRACE|SEVERE)\]\s*:\s*|\[\d{2}:\d{2}:\d{2}\]\s*\[(?:Server thread|Async Chat Thread[^\]]*|[^\]]+)\/(?:INFO|WARN|ERROR|DEBUG)\]\s*:\s*)/i,
    "",
  );
}
