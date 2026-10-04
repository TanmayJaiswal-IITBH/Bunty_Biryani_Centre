import type { ErrorRequestHandler } from 'express';
import { ZodError, z } from 'zod';
import type { ErrorCode } from '../../shared/errors.js';
import { AppError } from '../lib/app-error.js';
import type { Logger } from '../lib/logger.js';

interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
}

function body(code: ErrorCode, message: string, details?: Record<string, unknown>): ErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

function hasProp<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

const BODY_PARSER_TYPES = new Set([
  'entity.parse.failed',
  'entity.too.large',
  'encoding.unsupported',
  'charset.unsupported',
  'request.aborted',
  'request.size.invalid',
]);

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AppError) {
      res.status(err.status).json(body(err.code, err.message, err.details));
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json(
        body('VALIDATION_ERROR', 'Please check the highlighted fields.', {
          fieldErrors: z.flattenError(err).fieldErrors,
        }),
      );
      return;
    }

    if (hasProp(err, 'type') && typeof err.type === 'string' && BODY_PARSER_TYPES.has(err.type)) {
      res.status(400).json(body('VALIDATION_ERROR', 'Invalid request.'));
      return;
    }

    // A unique violation no service handled (Batch 2 §6.3).
    if (hasProp(err, 'code') && err.code === 'P2002') {
      const meta = hasProp(err, 'meta') ? err.meta : undefined;
      const target = hasProp(meta, 'target') ? meta.target : undefined;
      const field = Array.isArray(target) ? String(target[0]) : undefined;
      res
        .status(409)
        .json(body('DUPLICATE', 'That already exists.', field ? { field } : undefined));
      return;
    }

    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('unhandled error', {
      reqId: req.id,
      errName: error.name,
      message: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json(
        body('INTERNAL_ERROR', 'Something went wrong. Please try again.', { requestId: req.id }),
      );
  };
}
