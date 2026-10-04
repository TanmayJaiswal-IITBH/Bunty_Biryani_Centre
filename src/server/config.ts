import { z } from 'zod';

export interface Config {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  isDevelopment: boolean;
  databaseUrl: string;
  jwtSecret: string;
  /** Exact public origin, e.g. https://bbc.onrender.com. Used by the Origin check. */
  appOrigin: string;
  /** Origins the Origin check accepts (appOrigin, plus dev-only extras). */
  allowedOrigins: string[];
  port: number;
  trustProxy: number;
  /** Only ever set when NODE_ENV=test. */
  clockOverride: string | undefined;
}

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    error: 'NODE_ENV must be development, test or production',
  }),
  DATABASE_URL: z.string({ error: 'DATABASE_URL is required' }).min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  APP_ORIGIN: z.preprocess(emptyToUndefined, z.string().optional()),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  TRUST_PROXY: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(10).optional()),
  CLOCK_OVERRIDE: z.preprocess(emptyToUndefined, z.string().optional()),
  DEV_ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
});

function parseOrigin(value: string, name: string, problems: string[]): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    return url.origin;
  } catch {
    problems.push(`${name} must be an origin such as https://example.com (got "${value}")`);
    return undefined;
  }
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const e = parsed.data;
  const problems: string[] = [];

  const isProduction = e.NODE_ENV === 'production';
  const isDevelopment = e.NODE_ENV === 'development';

  if (isProduction && !e.APP_ORIGIN) problems.push('APP_ORIGIN is required in production');
  if (isProduction && e.CLOCK_OVERRIDE) {
    problems.push('CLOCK_OVERRIDE must not be set in production');
  }
  if (e.CLOCK_OVERRIDE && Number.isNaN(Date.parse(e.CLOCK_OVERRIDE))) {
    problems.push('CLOCK_OVERRIDE must be an ISO date-time');
  }

  const appOrigin =
    parseOrigin(e.APP_ORIGIN ?? 'http://localhost:3000', 'APP_ORIGIN', problems) ??
    'http://localhost:3000';

  const allowedOrigins = [appOrigin];
  if (isDevelopment) {
    allowedOrigins.push('http://localhost:5173');
    for (const raw of (e.DEV_ALLOWED_ORIGINS ?? '').split(',')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const origin = parseOrigin(trimmed, 'DEV_ALLOWED_ORIGINS', problems);
      if (origin) allowedOrigins.push(origin);
    }
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    env: e.NODE_ENV,
    isProduction,
    isDevelopment,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    appOrigin,
    allowedOrigins: [...new Set(allowedOrigins)],
    port: e.PORT ?? 3000,
    trustProxy: e.TRUST_PROXY ?? (isProduction ? 1 : 0),
    // The override is honoured only in tests (Batch 1 T7).
    clockOverride: e.NODE_ENV === 'test' ? e.CLOCK_OVERRIDE : undefined,
  };
}

/** For seeds and the admin CLI, which need the database but not the rest of the config. */
export function loadDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL;
  if (!url) throw new ConfigError(['DATABASE_URL is required']);
  return url;
}
