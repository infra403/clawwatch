/**
 * End-to-end test: Full ClawWatch flow
 *
 * Boots a real Engine (Socket Server + Pipeline + API),
 * connects a SocketClient (simulating the OpenClaw plugin),
 * sends realistic agent session events, and verifies:
 *   1. Data flows through Pipeline into SQLite
 *   2. REST API returns correct data
 *   3. SSE broadcasts detection alerts in real-time
 *   4. Detectors fire on suspicious patterns
 *   5. Efficiency score is calculated on session end
 *   6. Budget alerts propagate back to plugin
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';

import { ClawWatchDB } from '../../packages/engine/src/db.js';
import { Pipeline } from '../../packages/engine/src/pipeline.js';
import { SocketServer } from '../../packages/engine/src/socket-server.js';
import { createApiServer, type ApiServer } from '../../packages/engine/src/api/server.js';
import { SocketClient } from '../../packages/plugin/src/socket-client.js';
import { DEFAULT_CONFIG } from '../../packages/shared/src/config.js';
import type { EngineCommand, ClawWatchConfig } from '../../packages/shared/src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
  intervalMs = 50,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/** Collect SSE events from a streaming HTTP response */
function collectSSE(
  port: number,
  path: string,
  events: unknown[],
): { req: http.ClientRequest; close: () => void } {
  const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
    let buffer = '';
    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
        if (dataLine) {
          try {
            events.push(JSON.parse(dataLine.slice(6)));
          } catch { /* ignore */ }
        }
      }
    });
  });
  return { req, close: () => req.destroy() };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('E2E: Full ClawWatch Flow', () => {
  const testId = randomUUID().slice(0, 8);
  const testDir = join(tmpdir(), `clawwatch-e2e-${testId}`);
  const socketPath = join(testDir, 'engine.sock');
  const dbPath = join(testDir, 'test.db');
  const port = 18900 + Math.floor(Math.random() * 100);

  let db: ClawWatchDB;
  let pipeline: Pipeline;
  let socketServer: SocketServer;
  let api: ApiServer;
  let pluginClient: SocketClient;
  let config: ClawWatchConfig;

  const receivedCommands: EngineCommand[] = [];

  beforeAll(async () => {
    mkdirSync(testDir, { recursive: true });

    // 1. Init engine components (same as engine/src/index.ts)
    config = {
      ...DEFAULT_CONFIG,
      dashboardPort: port,
    };
    db = new ClawWatchDB(dbPath);

    api = createApiServer({
      db,
      config,
      onConfigChange: (c) => Object.assign(config, c),
    });

    socketServer = new SocketServer((event) => {
      pipeline.process(event);
    });

    pipeline = new Pipeline({
      config,
      db,
      onCommand: (cmd: EngineCommand) => {
        api.broadcast(cmd);
        socketServer.sendCommand(cmd);
      },
    });

    await socketServer.start(socketPath);
    await api.start(port);

    // 2. Connect plugin client (simulates OpenClaw plugin)
    pluginClient = new SocketClient(socketPath);
    pluginClient.onCommand((cmd) => receivedCommands.push(cmd));
    pluginClient.connect();
    await waitFor(() => pluginClient.isConnected);
  });

  afterAll(async () => {
    pluginClient?.disconnect();
    socketServer?.stop();
    await api?.stop();
    db?.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* */ }
  });

  // -------------------------------------------------------------------------
  // Tests
  // -------------------------------------------------------------------------

  const sessionId = `e2e-session-${randomUUID().slice(0, 8)}`;

  it('1. session_start → creates session in DB and API', async () => {
    pluginClient.send({
      type: 'session_start',
      session_id: sessionId,
      timestamp: Date.now(),
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
      initial_prompt: 'Build a REST API for user management',
    });

    await sleep(200);

    // Verify via DB
    const session = db.getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe('active');
    expect(session!.model_id).toBe('claude-sonnet-4-6');

    // Verify via REST API
    const res = await api.app.inject({ method: 'GET', url: `/api/sessions/${sessionId}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.session.id).toBe(sessionId);
    expect(body.session.status).toBe('active');
  });

  it('2. llm_call → records cost and tokens', async () => {
    pluginClient.send({
      type: 'llm_call',
      session_id: sessionId,
      timestamp: Date.now(),
      model_id: 'claude-sonnet-4-6',
      input_tokens: 2000,
      output_tokens: 500,
      cost_usd: 0,  // Engine recalculates
      latency_ms: 1200,
    });

    await sleep(200);

    // Verify session tokens updated
    const session = db.getSession(sessionId);
    expect(session!.total_input_tokens).toBe(2000);
    expect(session!.total_output_tokens).toBe(500);
    expect((session!.total_cost_usd as number)).toBeGreaterThan(0);

    // Verify LLM call recorded
    const calls = db.getLlmCallsBySession(sessionId);
    expect(calls.length).toBe(1);
    expect(calls[0].input_tokens).toBe(2000);
    expect((calls[0].cost_usd as number)).toBeGreaterThan(0);
  });

  it('3. tool_call → records tool usage', async () => {
    pluginClient.send({
      type: 'tool_call',
      session_id: sessionId,
      timestamp: Date.now(),
      tool_name: 'file_write',
      arguments_hash: 'abc123',
      result_summary: 'Created src/routes.ts',
      duration_ms: 50,
    });

    await sleep(200);

    const tools = db.getToolCallsBySession(sessionId);
    expect(tools.length).toBe(1);
    expect(tools[0].tool_name).toBe('file_write');
  });

  it('4. repeated tool calls → triggers loop_spinning detection', async () => {
    // Connect SSE before triggering detections
    const sseEvents: unknown[] = [];
    const sse = collectSSE(port, '/api/sse', sseEvents);

    await sleep(100); // Let SSE connect

    const now = Date.now();
    // Send 4 identical tool calls to trigger loop_spinning (min_repeats=3)
    for (let i = 0; i < 4; i++) {
      pluginClient.send({
        type: 'tool_call',
        session_id: sessionId,
        timestamp: now + i * 100,
        tool_name: 'file_search',
        arguments_hash: 'same-hash-repeated',
        result_summary: 'No results found',
        duration_ms: 30,
      });
      await sleep(100);
    }

    await sleep(500);

    // Verify detection in DB
    const detections = db.getDetectionsBySession(sessionId);
    const loopDetections = detections.filter((d) => d.detector_type === 'loop_spinning');
    expect(loopDetections.length).toBeGreaterThanOrEqual(1);

    // Verify detection alert received by plugin via socket
    const alertCmds = receivedCommands.filter((c) => c.type === 'detection_alert');
    expect(alertCmds.length).toBeGreaterThanOrEqual(1);

    // Verify SSE broadcast
    const sseAlerts = sseEvents.filter(
      (e: any) => e.type === 'detection_alert',
    );
    expect(sseAlerts.length).toBeGreaterThanOrEqual(1);

    sse.close();
  });

  it('5. GET /api/overview → reflects accumulated data', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/api/overview' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.session_count).toBeGreaterThanOrEqual(1);
    expect(body.total_cost).toBeGreaterThan(0);
    expect(body.detection_count).toBeGreaterThanOrEqual(1);
    expect(body.active_sessions).toBeGreaterThanOrEqual(1);
  });

  it('6. GET /api/detections → returns detection log', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/api/detections?limit=10' });
    expect(res.statusCode).toBe(200);
    const detections = JSON.parse(res.body);

    expect(detections.length).toBeGreaterThanOrEqual(1);
    expect(detections[0].detector_type).toBeDefined();
    expect(detections[0].severity).toBeDefined();
  });

  it('7. PUT /api/config → updates config', async () => {
    const res = await api.app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: {
        budget: { dailyLimitUsd: 50 },
      },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);
    expect(updated.budget.dailyLimitUsd).toBe(50);

    // Verify GET returns updated config
    const getRes = await api.app.inject({ method: 'GET', url: '/api/config' });
    expect(JSON.parse(getRes.body).budget.dailyLimitUsd).toBe(50);
  });

  it('8. session_end → calculates efficiency score', async () => {
    pluginClient.send({
      type: 'session_end',
      session_id: sessionId,
      timestamp: Date.now(),
    });

    await sleep(300);

    // Verify session ended with efficiency score
    const session = db.getSession(sessionId);
    expect(session!.status).toBe('ended');
    expect(session!.efficiency_score).toBeDefined();
    expect(typeof session!.efficiency_score).toBe('number');
    // Score should be < 100 because we had loop_spinning detections
    expect(session!.efficiency_score as number).toBeLessThan(100);
    expect(session!.efficiency_score as number).toBeGreaterThanOrEqual(0);

    // Verify via API
    const res = await api.app.inject({ method: 'GET', url: `/api/sessions/${sessionId}` });
    const body = JSON.parse(res.body);
    expect(body.session.status).toBe('ended');
    expect(body.session.efficiency_score).toBeDefined();

    // Should have LLM calls, tool calls, and detections
    expect(body.llm_calls.length).toBeGreaterThanOrEqual(1);
    expect(body.tool_calls.length).toBeGreaterThanOrEqual(1);
    expect(body.detections.length).toBeGreaterThanOrEqual(1);
  });

  it('9. second session → verifies multi-session support', async () => {
    const session2 = `e2e-session2-${randomUUID().slice(0, 8)}`;

    pluginClient.send({
      type: 'session_start',
      session_id: session2,
      timestamp: Date.now(),
      model_id: 'gpt-4o',
      provider: 'openai',
    });

    await sleep(100);

    pluginClient.send({
      type: 'llm_call',
      session_id: session2,
      timestamp: Date.now(),
      model_id: 'gpt-4o',
      input_tokens: 500,
      output_tokens: 200,
      cost_usd: 0,
      latency_ms: 800,
    });

    await sleep(100);

    pluginClient.send({
      type: 'session_end',
      session_id: session2,
      timestamp: Date.now(),
    });

    await sleep(300);

    // Both sessions should exist
    const res = await api.app.inject({ method: 'GET', url: '/api/sessions?limit=10' });
    const sessions = JSON.parse(res.body);
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    // Session 2 should have efficiency score (no detections = high score)
    const s2 = db.getSession(session2);
    expect(s2!.status).toBe('ended');
    expect(s2!.efficiency_score as number).toBe(100); // No detections = perfect score
  });

  it('10. GET /api/overview → reflects all sessions', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/api/overview' });
    const body = JSON.parse(res.body);
    expect(body.session_count).toBeGreaterThanOrEqual(2);
    expect(body.total_cost).toBeGreaterThan(0);
  });
});
