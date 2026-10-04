// One JSON line per event on stdout. Never log bodies, cookies, phone numbers or passwords
// (Batch 1 §9.6): callers pass only safe fields, and this redacts risky key names as a backstop.

export type LogFields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

const RISKY_KEY = /pass|phone|cookie|body|authorization|token|secret|address|name$/i;
const ALLOWED_KEYS = new Set(['name', 'errName', 'method', 'path', 'reqId', 'orderNumber']);

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = RISKY_KEY.test(key) && !ALLOWED_KEYS.has(key) ? '[redacted]' : value;
  }
  return out;
}

export function createLogger(
  write: (line: string) => void = (l) => process.stdout.write(`${l}\n`),
): Logger {
  const log = (level: string, msg: string, fields?: LogFields) => {
    write(
      JSON.stringify({
        t: new Date().toISOString(),
        level,
        msg,
        ...(fields ? redact(fields) : {}),
      }),
    );
  };
  return {
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
  };
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
