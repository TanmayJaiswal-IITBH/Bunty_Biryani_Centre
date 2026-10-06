import { useCallback, useSyncExternalStore } from 'react';

const TICK_MS = 15_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}

/**
 * Whole minutes since `since` (a `performance.now()` reading), re-read every 15 s. The impure
 * clock read lives in the snapshot callback, not the render body; the server snapshot is 0.
 */
export function useElapsedMinutes(since: number): number {
  const getSnapshot = useCallback(() => Math.floor((performance.now() - since) / 60_000), [since]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
