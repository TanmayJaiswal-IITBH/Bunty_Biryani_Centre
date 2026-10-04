// localStorage can be missing or throw (private mode, blocked site data, quota, no window).
// These helpers never throw: a failed read is `null`, a failed write is silently skipped.

export function readStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the cart simply won't survive a reload.
  }
}
