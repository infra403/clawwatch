import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { ClawWatchConfig } from '@clawwatch/shared';
import type { ClawWatchDB } from '../db.js';
import { registerRoutes, broadcastSSE } from './routes.js';
import type { ServerResponse } from 'node:http';

export interface ApiServerOptions {
  db: ClawWatchDB;
  config: ClawWatchConfig;
  onConfigChange?: (config: ClawWatchConfig) => void;
}

export interface ApiServer {
  start: (port: number) => Promise<string>;
  stop: () => Promise<void>;
  broadcast: (event: unknown) => void;
  /** Exposed for testing with fastify.inject() */
  app: ReturnType<typeof Fastify>;
}

export function createApiServer(opts: ApiServerOptions): ApiServer {
  const app = Fastify({ logger: false });
  const sseClients = new Set<ServerResponse>();

  let currentConfig = opts.config;

  // Register CORS
  app.register(cors, { origin: true });

  // Register routes
  registerRoutes(app, {
    db: opts.db,
    getConfig: () => currentConfig,
    setConfig: (config: ClawWatchConfig) => {
      currentConfig = config;
      opts.onConfigChange?.(config);
    },
    sseClients,
  });

  // Serve dashboard static files in production
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dashboardDist = join(__dirname, '../../../dashboard/dist');
  if (existsSync(dashboardDist)) {
    app.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
      wildcard: false, // Let API routes take precedence
    });

    // SPA fallback for client-side routing
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.status(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return {
    app,
    async start(port: number) {
      const address = await app.listen({ port, host: '0.0.0.0' });
      return address;
    },
    async stop() {
      // Close all SSE clients
      for (const client of sseClients) {
        try {
          client.end();
        } catch {
          // Ignore
        }
      }
      sseClients.clear();
      await app.close();
    },
    broadcast(event: unknown) {
      broadcastSSE(sseClients, event);
    },
  };
}
