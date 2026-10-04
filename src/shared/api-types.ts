import type { ErrorCode } from './errors.js';

/** Every API error looks like this (Batch 1 §8.1). `message` is safe to show to a customer. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Response of `POST /api/admin/login` and `GET /api/admin/me`. */
export interface AdminSession {
  username: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
}
