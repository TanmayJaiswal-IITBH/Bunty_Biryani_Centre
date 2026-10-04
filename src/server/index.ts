import path from 'node:path';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createPrisma } from './db.js';
import { createClock } from './lib/clock.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger();

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const prisma = createPrisma(config.databaseUrl);
const clock = createClock(config.clockOverride);

// `pnpm dev` passes --no-client: Vite serves the client, so a stale build must not sit beside it.
const clientDir = process.argv.includes('--no-client') ? null : path.resolve('dist/client');
const app = createApp({ prisma, clock, config, logger, clientDir });

const server = app.listen(config.port, (error?: Error) => {
  // Express 5 passes a bind failure (e.g. EADDRINUSE) to this callback instead of throwing.
  if (error) {
    logger.error('failed to start', {
      errName: error.name,
      message: error.message,
      port: config.port,
    });
    process.exit(1);
  }
  logger.info('listening', { port: config.port, env: config.env });
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });
  // Stop accepting connections, let in-flight requests finish (max 10 s), then close the pool.
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
