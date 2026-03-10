import type { FastifyInstance } from 'fastify';
import type { ClawWatchConfig } from '@clawwatch/shared';
import { CONFIG_PATH, deepMerge } from '@clawwatch/shared';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ClawWatchDB } from '../db.js';
import type { ServerResponse } from 'node:http';

export interface RouteContext {
  db: ClawWatchDB;
  getConfig: () => ClawWatchConfig;
  setConfig: (config: ClawWatchConfig) => void;
  sseClients: Set<ServerResponse>;
}

export function registerRoutes(app: FastifyInstance, ctx: RouteContext): void {
  // GET /api/overview
  app.get('/api/overview', async () => {
    const metrics = ctx.db.getTodayMetrics();
    const activeSessions = ctx.db.getActiveSessions();
    return {
      ...metrics,
      active_sessions: activeSessions.length,
    };
  });

  // GET /api/sessions
  app.get('/api/sessions', async (request) => {
    const query = request.query as { status?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    return ctx.db.getSessions({
      status: query.status,
      limit: isNaN(limit) ? 50 : limit,
    });
  });

  // GET /api/sessions/:id
  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = ctx.db.getSession(id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    const llm_calls = ctx.db.getLlmCallsBySession(id);
    const tool_calls = ctx.db.getToolCallsBySession(id);
    const detections = ctx.db.getDetectionsBySession(id);
    return { session, llm_calls, tool_calls, detections };
  });

  // GET /api/detections
  app.get('/api/detections', async (request) => {
    const query = request.query as { limit?: string; type?: string; severity?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    return ctx.db.getRecentDetections(isNaN(limit) ? 50 : limit);
  });

  // GET /api/config
  app.get('/api/config', async () => {
    return ctx.getConfig();
  });

  // PUT /api/config
  app.put('/api/config', async (request) => {
    const partial = request.body as Partial<ClawWatchConfig>;
    const current = ctx.getConfig();
    const merged = deepMerge(current, partial);
    try {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    } catch {
      // Config file write may fail in test environments — that's ok
    }
    ctx.setConfig(merged);
    return merged;
  });

  // GET /api/sse
  app.get('/api/sse', (request, reply) => {
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    ctx.sseClients.add(raw);

    // Keepalive every 15 seconds
    const keepalive = setInterval(() => {
      try {
        raw.write(': keepalive\n\n');
      } catch {
        // Client disconnected
      }
    }, 15_000);

    request.raw.on('close', () => {
      clearInterval(keepalive);
      ctx.sseClients.delete(raw);
    });
  });
}

export function broadcastSSE(clients: Set<ServerResponse>, event: unknown): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch {
      clients.delete(client);
    }
  }
}
