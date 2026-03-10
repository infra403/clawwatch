import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClawWatchDB } from '../../packages/engine/src/db.js';
import { unlinkSync } from 'node:fs';

const TEST_DB = '/tmp/clawwatch-test-' + Date.now() + '.db';

describe('ClawWatchDB', () => {
  let db: ClawWatchDB;
  beforeEach(() => { db = new ClawWatchDB(TEST_DB); });
  afterEach(() => { db.close(); try { unlinkSync(TEST_DB); unlinkSync(TEST_DB + '-wal'); unlinkSync(TEST_DB + '-shm'); } catch {} });

  it('creates all 6 tables on init', () => {
    const tables = db.listTables();
    expect(tables).toContain('sessions');
    expect(tables).toContain('llm_calls');
    expect(tables).toContain('tool_calls');
    expect(tables).toContain('detections');
    expect(tables).toContain('budget_rules');
    expect(tables).toContain('daily_metrics');
  });

  it('inserts and retrieves a session', () => {
    db.insertSession({ id: 's1', openclaw_session_id: 'oc1', started_at: Date.now(), model_id: 'claude-opus-4-6', provider: 'anthropic', status: 'active' });
    const s = db.getSession('s1');
    expect(s).not.toBeNull();
    expect(s!.model_id).toBe('claude-opus-4-6');
    expect(s!.total_cost_usd).toBe(0);
  });

  it('updates session tokens incrementally', () => {
    db.insertSession({ id: 's1', openclaw_session_id: 'oc1', started_at: Date.now(), model_id: 'm', provider: 'p', status: 'active' });
    db.updateSessionTokens('s1', 100, 50, 0.05);
    db.updateSessionTokens('s1', 200, 100, 0.10);
    const s = db.getSession('s1');
    expect(s!.total_input_tokens).toBe(300);
    expect(s!.total_output_tokens).toBe(150);
    expect(s!.total_cost_usd).toBeCloseTo(0.15);
  });

  it('ends a session with score', () => {
    db.insertSession({ id: 's1', openclaw_session_id: 'oc1', started_at: Date.now(), model_id: 'm', provider: 'p', status: 'active' });
    db.endSession('s1', Date.now(), 85);
    const s = db.getSession('s1');
    expect(s!.status).toBe('ended');
    expect(s!.efficiency_score).toBe(85);
  });

  it('inserts and queries detections', () => {
    db.insertDetection({ id: 'd1', session_id: 's1', timestamp: Date.now(), detector_type: 'loop_spinning', severity: 'critical', description: 'test loop', evidence: { count: 5 }, tokens_wasted: 500, cost_wasted_usd: 0.25 });
    const dets = db.getDetectionsBySession('s1');
    expect(dets).toHaveLength(1);
    expect(dets[0].detector_type).toBe('loop_spinning');
    expect(JSON.parse(dets[0].evidence as string).count).toBe(5);
  });

  it('gets active sessions', () => {
    db.insertSession({ id: 's1', openclaw_session_id: 'oc1', started_at: Date.now(), model_id: 'm', provider: 'p', status: 'active' });
    db.insertSession({ id: 's2', openclaw_session_id: 'oc2', started_at: Date.now(), model_id: 'm', provider: 'p', status: 'ended' });
    const active = db.getActiveSessions();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('s1');
  });
});
