import { describe, it, expect } from 'vitest';
import { StallingDetector } from '../../../packages/engine/src/detectors/stalling.js';

const makeEvent = (ts: number) => ({
  type: 'tool_call' as const,
  session_id: 's1',
  timestamp: ts,
  tool_name: 'bash',
  arguments_hash: 'abc',
  result_summary: '',
  duration_ms: 100,
});

const makeContext = (lastEventTs: number, overrides: Record<string, unknown> = {}) => ({
  session_id: 's1',
  started_at: Date.now(),
  model_id: 'claude-opus-4-6',
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost_usd: 0,
  recent_tool_calls: [] as any[],
  recent_llm_calls: [] as any[],
  last_event_timestamp: lastEventTs,
  ...overrides,
});

describe('StallingDetector', () => {
  // timeout = 30s → warn at >30s, critical at >60s
  const detector = new StallingDetector({ timeout_seconds: 30 });

  it('returns null when gap is smaller than timeout', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 10000); // 10s gap
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns null when gap equals timeout exactly', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 30000); // exactly 30s — not > threshold
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns warning detection when gap is between 30s and 60s', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 45000); // 45s gap
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.detector_type).toBe('stalling');
  });

  it('returns critical detection when gap exceeds 60s', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 90000); // 90s gap
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('records gap in evidence', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 45000);
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.evidence.gap_ms).toBe(45000);
    expect(result!.evidence.gap_seconds).toBeCloseTo(45, 0);
    expect(result!.evidence.timeout_seconds).toBe(30);
  });

  it('works with any event type (not just tool_call)', () => {
    const now = Date.now();
    const llmEvent = {
      type: 'llm_call' as const,
      session_id: 's1',
      timestamp: now,
      model_id: 'claude-opus-4-6',
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.01,
      latency_ms: 500,
    };
    const ctx = makeContext(now - 45000);
    const result = detector.analyze(llmEvent, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });

  it('sets correct session_id on detection', () => {
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 45000, { session_id: 'my-session' });
    const result = detector.analyze(event, ctx);
    expect(result!.session_id).toBe('my-session');
  });

  it('handles custom timeout_seconds configuration', () => {
    const customDetector = new StallingDetector({ timeout_seconds: 10 });
    const now = Date.now();
    const event = makeEvent(now);
    const ctx = makeContext(now - 15000); // 15s gap > 10s threshold
    const result = customDetector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });
});
