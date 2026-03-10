import { describe, it, expect } from 'vitest';
import { LoopSpinningDetector } from '../../../packages/engine/src/detectors/loop-spinning.js';

const makeToolCall = (name: string, hash: string, ts: number) => ({
  type: 'tool_call' as const,
  session_id: 's1',
  tool_name: name,
  arguments_hash: hash,
  result_summary: '',
  duration_ms: 100,
  timestamp: ts,
});

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  session_id: 's1',
  started_at: Date.now(),
  model_id: 'claude-opus-4-6',
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost_usd: 0,
  recent_tool_calls: [] as ReturnType<typeof makeToolCall>[],
  recent_llm_calls: [] as any[],
  last_event_timestamp: Date.now(),
  ...overrides,
});

describe('LoopSpinningDetector', () => {
  const detector = new LoopSpinningDetector({ window_seconds: 60, min_repeats: 3 });

  it('returns null for a single call (no repetition)', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({ recent_tool_calls: [] });
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns null when only 2 matching calls in window', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [makeToolCall('bash', 'abc123', now - 10000)],
    });
    // count = 1 (history) + 1 (current) = 2, below min_repeats=3
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns warning detection when 3 repeats in window', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [
        makeToolCall('bash', 'abc123', now - 10000),
        makeToolCall('bash', 'abc123', now - 20000),
      ],
    });
    // count = 2 + 1 = 3
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.detector_type).toBe('loop_spinning');
    expect(result!.evidence.repeat_count).toBe(3);
  });

  it('returns critical detection when 5+ repeats', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [
        makeToolCall('bash', 'abc123', now - 5000),
        makeToolCall('bash', 'abc123', now - 10000),
        makeToolCall('bash', 'abc123', now - 15000),
        makeToolCall('bash', 'abc123', now - 20000),
      ],
    });
    // count = 4 + 1 = 5 → critical
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.evidence.repeat_count).toBe(5);
  });

  it('ignores calls outside the time window', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [
        makeToolCall('bash', 'abc123', now - 70000), // outside 60s window
        makeToolCall('bash', 'abc123', now - 80000), // outside window
      ],
    });
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('does not confuse calls with different tool names', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [
        makeToolCall('read', 'abc123', now - 5000),
        makeToolCall('write', 'abc123', now - 10000),
      ],
    });
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('does not confuse calls with different argument hashes', () => {
    const now = Date.now();
    const event = makeToolCall('bash', 'abc123', now);
    const ctx = makeContext({
      recent_tool_calls: [
        makeToolCall('bash', 'def456', now - 5000),
        makeToolCall('bash', 'ghi789', now - 10000),
      ],
    });
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns null for non-tool_call events', () => {
    const now = Date.now();
    const event = {
      type: 'llm_call' as const,
      session_id: 's1',
      timestamp: now,
      model_id: 'claude-opus-4-6',
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.01,
      latency_ms: 500,
    };
    const ctx = makeContext();
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns correct session_id and tool_name in evidence', () => {
    const now = Date.now();
    const event = makeToolCall('grep', 'xyz999', now);
    const ctx = makeContext({
      session_id: 'session-abc',
      recent_tool_calls: [
        makeToolCall('grep', 'xyz999', now - 5000),
        makeToolCall('grep', 'xyz999', now - 10000),
      ],
    });
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('session-abc');
    expect(result!.evidence.tool_name).toBe('grep');
    expect(result!.evidence.arguments_hash).toBe('xyz999');
  });
});
