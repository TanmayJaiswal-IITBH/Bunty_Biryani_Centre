// Web storage can be missing or throw (private mode, blocked site data, quota, no window).
// These helpers never throw: a failed read is `null`, a failed write or remove is silently skipped.

export type StorageArea = 'local' | 'session';

function area(which: StorageArea): Storage | null {
  if (typeof window === 'undefined') return null;
  return which === 'session' ? window.sessionStorage : window.localStorage;
}

export function readStorage(key: string, which: StorageArea = 'local'): string | null {
  try {
    return area(which)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, which: StorageArea = 'local'): void {
  try {
    area(which)?.setItem(key, value);
  } catch {
    // Storage unavailable: the value simply won't survive a reload.
  }
}

export function removeStorage(key: string, which: StorageArea = 'local'): void {
  try {
    area(which)?.removeItem(key);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}
