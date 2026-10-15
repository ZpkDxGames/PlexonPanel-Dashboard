import type { Preferences } from "./store/preferences";

export const motionTokens: Record<Preferences["motion"], { fast: number; base: number; slow: number; page: number }> = {
  full: { fast: .14, base: .22, slow: .36, page: .48 },
  reduced: { fast: .09, base: .11, slow: .14, page: .16 },
  off: { fast: 0, base: 0, slow: 0, page: 0 },
};

export const emphasizedEase = [.16, 1, .3, 1] as const;
