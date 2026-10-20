export interface PlayerRef { uuid?: string | null; name?: string | null }
export const toSelectionKey = (p: PlayerRef): string =>
  p.uuid ? p.uuid.toLowerCase() : p.name ? `name:${p.name.toLowerCase()}` : "";
export const matchesSelection = (p: PlayerRef, key: string): boolean =>
  !!key && (key.toLowerCase().startsWith("name:")
    ? !!p.name && p.name.toLowerCase() === key.slice(5).toLowerCase()
    : !!p.uuid && p.uuid.toLowerCase() === key.toLowerCase());
