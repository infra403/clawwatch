import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { ClawWatchDB } from '../../packages/engine/src/db.js';
import { createApiServer } from '../../packages/engine/src/api/server.js';
import { DEFAULT_CONFIG } from '../../packages/shared/src/config.js';
import type { ApiServer } from '../../packages/engine/src/api/server.js';

const TEST_DB = '/tmp/clawwatch-api-test-' + Date.now() + '.db';

describe('API Server', () => {
  let db: ClawWatchDB;
  let api: ApiServer;

  beforeEach(async () => {
    db = new ClawWatchDB(TEST_DB);
    api = createApiServer({ db, config: { ...DEFAULT_CONFIG } });
    await api.app.ready();
  });

  afterEach(async () => {
    await api.stop();
    db.close();
    try {
      unlinkSync(TEST_DB);
      unlinkSync(TEST_DB + '-wal');
      unlinkSync(TEST_DB + '-shm');
    } catch {
      // Ignore
    }
  });

  describe('GET /api/overview', () => {
    it('returns today metrics with active_sessions count', async () => {
      // Insert a session started today
      db.insertSession({
        id: 's1',
        openclaw_session_id: 'oc1',
        started_at: Date.now(),
        model_id: 'claude-opus-4-6',
        provider: 'anthropic',
        status: 'active',
      });

      const res = await api.app.inject({ method: 'GET', url: '/api/overview' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('total_cost');
      expect(body).toHaveProperty('total_waste');
      expect(body).toHaveProperty('detection_count');
      expect(body).toHaveProperty('session_count');
      expect(body).toHaveProperty('active_sessions');
      expect(body.active_sessions).toBe(1);
      expect(body.session_count).toBe(1);
    });
  });

  describe('GET /api/sessions', () => {
    it('returns sessions list', async () => {
      db.insertSession({
        id: 's1',
        openclaw_session_id: 'oc1',
        started_at: Date.now(),
        model_id: 'claude-opus-4-6',
        provider: 'anthropic',
        status: 'active',
      });
      db.insertSession({
        id: 's2',
        openclaw_session_id: 'oc2',
        started_at: Date.now() - 1000,
        model_id: 'claude-opus-4-6',
        provider: 'anthropic',
        status: 'ended',
      });

      const res = await api.app.inject({ method: 'GET', url: '/api/sessions' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
    });

    it('filters by status', async () => {
      db.insertSession({
        id: 's1',
        openclaw_session_id: 'oc1',
        started_at: Date.now(),
        model_id: 'm',
        provider: 'p',
        status: 'active',
      });
      db.insertSession({
        id: 's2',
        openclaw_session_id: 'oc2',
        started_at: Date.now(),
        model_id: 'm',
        provider: 'p',
        status: 'ended',
      });

      const res = await api.app.inject({
        method: 'GET',
        url: '/api/sessions?status=active',
      });
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('s1');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        db.insertSession({
          id: `s${i}`,
          openclaw_session_id: `oc${i}`,
          started_at: Date.now() - i * 1000,
          model_id: 'm',
          provider: 'p',
          status: 'active',
        });
      }

      const res = await api.app.inject({
        method: 'GET',
        url: '/api/sessions?limit=2',
      });
      const body = res.json();
      expect(body).toHaveLength(2);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('returns session detail with calls and detections', async () => {
      const now = Date.now();
      db.insertSession({
        id: 's1',
        openclaw_session_id: 'oc1',
        started_at: now,
        model_id: 'claude-opus-4-6',
        provider: 'anthropic',
        status: 'active',
      });
      db.insertLlmCall({
        id: 'l1',
        session_id: 's1',
        timestamp: now,
        model_id: 'claude-opus-4-6',
        provider: 'anthropic',
        input_tokens: 100,
        output_tokens: 50,
        cost_usd: 0.01,
        latency_ms: 200,
      });
      db.insertToolCall({
        id: 't1',
        session_id: 's1',
        llm_call_id: 'l1',
        timestamp: now,
        tool_name: 'read_file',
        arguments_hash: 'abc123',
        duration_ms: 50,
      });
      db.insertDetection({
        id: 'd1',
        session_id: 's1',
        timestamp: now,
        detector_type: 'loop_spinning',
        severity: 'warning',
        description: 'Spinning detected',
      });

      const res = await api.app.inject({ method: 'GET', url: '/api/sessions/s1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.session).toBeDefined();
      expect(body.session.id).toBe('s1');
      expect(body.llm_calls).toHaveLength(1);
      expect(body.tool_calls).toHaveLength(1);
      expect(body.detections).toHaveLength(1);
    });

    it('returns 404 for unknown session', async () => {
      const res = await api.app.inject({ method: 'GET', url: '/api/sessions/unknown' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/detections', () => {
    it('returns recent detections', async () => {
      db.insertDetection({
        id: 'd1',
        session_id: 's1',
        timestamp: Date.now(),
        detector_type: 'loop_spinning',
        severity: 'critical',
        description: 'Loop detected',
        tokens_wasted: 500,
        cost_wasted_usd: 0.25,
      });
      db.insertDetection({
        id: 'd2',
        session_id: 's1',
        timestamp: Date.now() - 1000,
        detector_type: 'token_bloat',
        severity: 'warning',
        description: 'Token bloat',
      });

      const res = await api.app.inject({ method: 'GET', url: '/api/detections' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
    });

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        db.insertDetection({
          id: `d${i}`,
          session_id: 's1',
          timestamp: Date.now() - i * 1000,
          detector_type: 'loop_spinning',
          severity: 'warning',
          description: `Detection ${i}`,
        });
      }

      const res = await api.app.inject({
        method: 'GET',
        url: '/api/detections?limit=3',
      });
      const body = res.json();
      expect(body).toHaveLength(3);
    });
  });

  describe('GET /api/config', () => {
    it('returns current config', async () => {
      const res = await api.app.inject({ method: 'GET', url: '/api/config' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.dashboardPort).toBe(DEFAULT_CONFIG.dashboardPort);
      expect(body.budget).toBeDefined();
      expect(body.detectors).toBeDefined();
    });
  });

  describe('PUT /api/config', () => {
    it('deep-merges and returns updated config', async () => {
      const res = await api.app.inject({
        method: 'PUT',
        url: '/api/config',
        payload: { budget: { dailyLimitUsd: 50 } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Updated value
      expect(body.budget.dailyLimitUsd).toBe(50);
      // Preserved original values
      expect(body.budget.sessionLimitUsd).toBe(DEFAULT_CONFIG.budget.sessionLimitUsd);
      expect(body.detectors).toBeDefined();

      // Verify subsequent GET returns updated config
      const res2 = await api.app.inject({ method: 'GET', url: '/api/config' });
      expect(res2.json().budget.dailyLimitUsd).toBe(50);
    });
  });

  describe('GET /api/sse', () => {
    it('sets up SSE endpoint that streams events', async () => {
      // Use inject with a custom dispatch to verify the SSE route exists and sets correct headers
      // We can't fully test SSE with inject since it waits for response end,
      // so we test it by starting the server on a real port briefly
      const address = await api.start(0); // random port
      const url = `${address.replace('0.0.0.0', '127.0.0.1')}/api/sse`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        const res = await fetch(url, { signal: controller.signal });
        expect(res.headers.get('content-type')).toBe('text/event-stream');
        expect(res.headers.get('cache-control')).toBe('no-cache');
        controller.abort();
      } catch (err: unknown) {
        // AbortError is expected since the stream doesn't end
        if (err instanceof Error && err.name !== 'AbortError') throw err;
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  describe('broadcast', () => {
    it('broadcast function exists on api server', () => {
      expect(typeof api.broadcast).toBe('function');
    });
  });
});
