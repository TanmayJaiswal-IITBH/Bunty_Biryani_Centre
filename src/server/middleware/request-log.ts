import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../lib/logger.js';

/** Assigns a request id and logs one line when the response finishes. No query string, no body. */
export function requestLog(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const id = randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    const startedAt = performance.now();
    res.on('finish', () => {
      logger.info('request', {
        reqId: id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(performance.now() - startedAt),
      });
    });
    next();
  };
}
