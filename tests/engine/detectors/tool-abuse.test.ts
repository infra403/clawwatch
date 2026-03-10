import { describe, it, expect } from 'vitest';
import { ToolAbuseDetector } from '../../../packages/engine/src/detectors/tool-abuse.js';

const makeToolCall = (name: string, ts: number) => ({
  type: 'tool_call' as const,
  session_id: 's1',
  tool_name: name,
  arguments_hash: 'any',
  result_summary: '',
  duration_ms: 100,
  timestamp: ts,
});

const makeContext = (recentToolCalls: ReturnType<typeof makeToolCall>[] = [], overrides: Record<string, unknown> = {}) => ({
  session_id: 's1',
  started_at: Date.now(),
  model_id: 'claude-opus-4-6',
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost_usd: 0,
  recent_tool_calls: recentToolCalls,
  recent_llm_calls: [] as any[],
  last_event_timestamp: Date.now(),
  ...overrides,
});

describe('ToolAbuseDetector', () => {
  // max_calls_per_minute = 5
  const detector = new ToolAbuseDetector({ max_calls_per_minute: 5 });

  it('returns null when call count is at or below limit', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // 4 in history + 1 current = 5 = limit → not > limit → null
    const ctx = makeContext([
      makeToolCall('bash', now - 10000),
      makeToolCall('bash', now - 20000),
      makeToolCall('bash', now - 30000),
      makeToolCall('bash', now - 40000),
    ]);
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('returns detection when count exceeds limit', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // 5 in history + 1 current = 6 > 5 → detection
    const ctx = makeContext([
      makeToolCall('bash', now - 5000),
      makeToolCall('bash', now - 10000),
      makeToolCall('bash', now - 15000),
      makeToolCall('bash', now - 20000),
      makeToolCall('bash', now - 25000),
    ]);
    const result = detector.analyze(event, ctx);
    expect(result).not.toBeNull();
    expect(result!.detector_type).toBe('tool_abuse');
  });

  it('returns info severity when count is above limit but <= 10', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // 7 in history + 1 = 8 → info (not > 10)
    const history = Array.from({ length: 7 }, (_, i) =>
      makeToolCall('bash', now - (i + 1) * 5000)
    );
    const result = detector.analyze(event, makeContext(history));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('info');
  });

  it('returns critical severity when count exceeds 10', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // 10 in history + 1 = 11 → critical
    const history = Array.from({ length: 10 }, (_, i) =>
      makeToolCall('bash', now - (i + 1) * 3000)
    );
    const result = detector.analyze(event, makeContext(history));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('only counts the same tool name', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // 5 calls to 'read', but current event is 'bash' → count = 1 for bash
    const ctx = makeContext([
      makeToolCall('read', now - 5000),
      makeToolCall('read', now - 10000),
      makeToolCall('read', now - 15000),
      makeToolCall('read', now - 20000),
      makeToolCall('read', now - 25000),
    ]);
    expect(detector.analyze(event, ctx)).toBeNull();
  });

  it('ignores calls outside 60s window', () => {
    const now = Date.now();
    const event = makeToolCall('bash', now);
    // All in history are older than 60s → only current event counts → 1 call → null
    const ctx = makeContext([
      makeToolCall('bash', now - 70000),
      makeToolCall('bash', now - 80000),
      makeToolCall('bash', now - 90000),
      makeToolCall('bash', now - 100000),
      makeToolCall('bash', now - 110000),
    ]);
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
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('records correct evidence fields', () => {
    const now = Date.now();
    const event = makeToolCall('grep', now);
    const history = Array.from({ length: 7 }, (_, i) =>
      makeToolCall('grep', now - (i + 1) * 5000)
    );
    const result = detector.analyze(event, makeContext(history));
    expect(result).not.toBeNull();
    expect(result!.evidence.tool_name).toBe('grep');
    expect(result!.evidence.call_count).toBe(8);
    expect(result!.evidence.max_calls_per_minute).toBe(5);
    expect(result!.evidence.window_seconds).toBe(60);
  });
});
