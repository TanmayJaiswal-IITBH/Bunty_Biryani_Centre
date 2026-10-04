import type { AdminSession } from '@shared/api-types.js';
import useSWR, { useSWRConfig } from 'swr';
import type { ApiError } from '../../../lib/api';

export const ADMIN_SESSION_KEY = '/api/admin/me';

/** Who is logged in, from the server (`/api/admin/me`). A 401 means nobody. */
export function useAdminSession() {
  return useSWR<AdminSession, ApiError>(ADMIN_SESSION_KEY, {
    shouldRetryOnError: false,
  });
}

/** Drops every cached response, e.g. after logout, so nothing from the session lingers. */
export function useClearSwrCache() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true, undefined, { revalidate: false });
}

/** `next` is honoured only for admin pages: no open redirect. */
export function safeNext(next: string | null): string {
  if (
    next &&
    (next === '/admin' || next.startsWith('/admin/')) &&
    !next.startsWith('/admin/login')
  ) {
    return next;
  }
  return '/admin';
}
