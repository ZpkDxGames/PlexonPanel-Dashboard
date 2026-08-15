export class SlidingWindowRateLimiter {
  private readonly entries = new Map<string, number[]>();

  constructor(
    private readonly maximumAttempts: number,
    private readonly windowMilliseconds: number,
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMilliseconds;
    const attempts = (this.entries.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (attempts.length >= this.maximumAttempts) {
      this.entries.set(key, attempts);
      return false;
    }
    attempts.push(now);
    this.entries.set(key, attempts);
    return true;
  }

  prune(now = Date.now()): void {
    const cutoff = now - this.windowMilliseconds;
    for (const [key, attempts] of this.entries) {
      const active = attempts.filter((timestamp) => timestamp > cutoff);
      if (active.length === 0) this.entries.delete(key);
      else this.entries.set(key, active);
    }
  }
}
