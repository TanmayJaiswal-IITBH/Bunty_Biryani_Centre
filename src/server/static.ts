import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

/**
 * Serves the built React app and the SPA fallback. Returns false (and mounts nothing) when
 * `clientDir/index.html` doesn't exist, so a missing build never breaks the API.
 */
export function mountClient(app: Express, clientDir: string): boolean {
  const indexPath = path.join(clientDir, 'index.html');
  if (!existsSync(indexPath)) return false;

  app.use(
    express.static(clientDir, {
      index: false,
      setHeaders(res, filePath) {
        const topFolder = path.relative(clientDir, filePath).split(path.sep)[0];
        // Vite hashes everything under /assets/, so it can be cached forever.
        res.setHeader(
          'Cache-Control',
          topFolder === 'assets' ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
        );
      },
    }),
  );

  // SPA fallback: only for page navigations. A missing script or image must stay a 404, so
  // require an explicit text/html in Accept (browsers send it; fetch/script requests don't).
  app.use((req, res, next) => {
    const isApi = req.path === '/api' || req.path.startsWith('/api/');
    const wantsHtml = (req.get('accept') ?? '').includes('text/html');
    if ((req.method !== 'GET' && req.method !== 'HEAD') || isApi || !wantsHtml) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  });

  return true;
}
