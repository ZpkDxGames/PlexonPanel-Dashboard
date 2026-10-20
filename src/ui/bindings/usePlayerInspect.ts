"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useViewSync } from "./view-sync";
import { toSelectionKey, type PlayerRef } from "./player-selection";
export function usePlayerInspect() {
  const router = useRouter(), { patch } = useViewSync();
  return useCallback((player: PlayerRef) => {
    const key = toSelectionKey(player);
    if (!key) return;
    patch({ selectedPlayerUuid: key });
    router.push("/players");
  }, [patch, router]);
}
