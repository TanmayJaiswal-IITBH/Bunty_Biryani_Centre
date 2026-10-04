import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, loadDatabaseUrl } from '../../src/server/config';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://bbc:bbc@localhost:5433/bbc_dev',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('parses a valid environment and fills defaults', () => {
    const c = loadConfig(valid);
    expect(c.port).toBe(3000);
    expect(c.trustProxy).toBe(0);
    expect(c.appOrigin).toBe('http://localhost:3000');
    expect(c.isDevelopment).toBe(true);
    expect(c.isProduction).toBe(false);
  });

  it('fails without DATABASE_URL, naming the problem', () => {
    const rest = Object.fromEntries(
      Object.entries(valid).filter(([key]) => key !== 'DATABASE_URL'),
    );
    expect(() => loadConfig(rest)).toThrow(ConfigError);
    expect(() => loadConfig(rest)).toThrow(/DATABASE_URL/);
  });

  it('fails when JWT_SECRET is shorter than 32 characters', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('reports every problem at once', () => {
    try {
      loadConfig({ NODE_ENV: 'development' });
      expect.unreachable();
    } catch (err) {
      expect((err as ConfigError).problems.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('refuses CLOCK_OVERRIDE in production', () => {
    const env = { ...valid, NODE_ENV: 'production', APP_ORIGIN: 'https://bbc.example.com' };
    expect(() => loadConfig({ ...env, CLOCK_OVERRIDE: '2026-10-04T13:40:00Z' })).toThrow(
      /CLOCK_OVERRIDE/,
    );
    expect(loadConfig(env).clockOverride).toBeUndefined();
  });

  it('honours CLOCK_OVERRIDE only when NODE_ENV=test', () => {
    const iso = '2026-10-04T13:40:00Z';
    expect(loadConfig({ ...valid, NODE_ENV: 'test', CLOCK_OVERRIDE: iso }).clockOverride).toBe(iso);
    expect(
      loadConfig({ ...valid, NODE_ENV: 'development', CLOCK_OVERRIDE: iso }).clockOverride,
    ).toBeUndefined();
  });

  it('requires APP_ORIGIN in production and trusts one proxy hop by default', () => {
    const env = { ...valid, NODE_ENV: 'production' };
    expect(() => loadConfig(env)).toThrow(/APP_ORIGIN/);
    const c = loadConfig({ ...env, APP_ORIGIN: 'https://bbc.example.com/' });
    expect(c.appOrigin).toBe('https://bbc.example.com');
    expect(c.trustProxy).toBe(1);
    expect(c.allowedOrigins).toEqual(['https://bbc.example.com']);
  });

  it('adds the Vite and LAN origins only in development', () => {
    const extra = 'http://192.168.1.20:5173';
    const dev = loadConfig({ ...valid, DEV_ALLOWED_ORIGINS: extra });
    expect(dev.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:5173', extra]);
    const test = loadConfig({ ...valid, NODE_ENV: 'test', DEV_ALLOWED_ORIGINS: extra });
    expect(test.allowedOrigins).toEqual(['http://localhost:3000']);
  });

  it('rejects an APP_ORIGIN that is not an origin', () => {
    expect(() => loadConfig({ ...valid, APP_ORIGIN: 'not a url' })).toThrow(/APP_ORIGIN/);
  });
});

describe('loadDatabaseUrl', () => {
  it('needs only DATABASE_URL', () => {
    expect(loadDatabaseUrl({ DATABASE_URL: 'postgresql://x' })).toBe('postgresql://x');
    expect(() => loadDatabaseUrl({})).toThrow(ConfigError);
  });
});
