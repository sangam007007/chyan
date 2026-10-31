import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cluster from 'node:cluster';
import fs from 'node:fs';
import path from 'node:path';

import routes from '@/routes/index.js';
import { errorHandler } from '@/middleware/error-handler.js';
import { env } from '@/config/env.js';

/**
 * How many copies of the server to run (one per CPU core you want to use). One Node process uses one core,
 * so this is what lets a bigger machine serve more people. The server keeps no state in memory (sessions are
 * in Redis and Postgres), so any number of copies can run side by side.
 */
const WORKERS = Math.max(1, Math.min(32, Number(process.env.WEB_CONCURRENCY) || 1));

/** Folder with the built website (frontend `dist`). When set, this server also serves the website: one address, no CORS. */
const FRONTEND_DIST = process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : null;
const serveFrontend = !!FRONTEND_DIST && fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

function createApp() {
  const app = express();

  // Behind a proxy (Render, Cloudflare, Caddy, nginx...) set TRUST_PROXY to how many proxies sit in front, usually 1.
  // Then req.ip is the real visitor, not the proxy: rate limits and session IPs depend on it.
  const hops = Number(process.env.TRUST_PROXY);
  if (hops > 0) app.set('trust proxy', hops);

  // Security middleware
  app.use(helmet(serveFrontend ? {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        // blob: = chat pictures fetched with the login token; https: = Google profile pictures
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  } : undefined));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(cookieParser());

  // Uploaded avatars (written by ProfileService to UPLOAD_DIR/avatars)
  // Discussion images are private: they are served only by the logged-in /api/discussions/image route
  app.use('/uploads/discussions', (_req, res) => res.status(404).end());
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '1h' }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount all routes
  app.use(routes);

  // The website (built files), with a fallback to index.html so deep links like /dashboard work after a reload
  if (serveFrontend && FRONTEND_DIST) {
    app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), { maxAge: '1y', immutable: true, index: false }));
    // service worker, manifest, icons...: always re-checked so an update reaches phones quickly
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  // Global error handler (must be AFTER all routes)
  app.use(errorHandler);
  return app;
}

// Safety net: a stray rejected promise should be logged, not take the whole server down.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const PORT = process.env.PORT || 3000;
const app = createApp();

if (WORKERS > 1 && cluster.isPrimary) {
  console.log(`Backend starting ${WORKERS} workers on port ${PORT}${serveFrontend ? ' (also serving the website)' : ''}`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    console.error(`[cluster] worker ${worker.process.pid} exited (${code}), starting a new one`);
    cluster.fork();
  });
} else {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}${WORKERS > 1 ? ` (worker ${process.pid})` : ''}${serveFrontend ? ', also serving the website' : ''}`);
  });
}

export default app;
