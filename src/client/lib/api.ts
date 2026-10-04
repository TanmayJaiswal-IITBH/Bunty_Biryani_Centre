import type { ApiErrorBody } from '@shared/api-types.js';
import type { ErrorCode } from '@shared/errors.js';

/** A failed API call. `NETWORK_ERROR` means the server wasn't reached at all. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly details: Record<string, unknown> | undefined;

  constructor(
    status: number,
    code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

// Set by the admin guard: an admin request that comes back 401 clears the session and goes to login.
let onAdminUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onAdminUnauthorized = handler;
}

// /me is how the guard asks "am I logged in?", and login is expected to fail; both handle 401 themselves.
const OWN_401 = new Set(['/api/admin/me', '/api/admin/login']);

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = undefined;
  }
  const error = isApiErrorBody(parsed)
    ? new ApiError(res.status, parsed.error.code, parsed.error.message, parsed.error.details)
    : new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');

  if (res.status === 401 && path.startsWith('/api/admin/') && !OWN_401.has(path)) {
    onAdminUnauthorized?.();
  }
  throw error;
}

/** SWR fetcher. */
export const fetcher = <T>(path: string): Promise<T> => api<T>(path);
