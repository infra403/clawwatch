import { describe, it, expect } from 'vitest';
import { TokenBloatDetector } from '../../../packages/engine/src/detectors/token-bloat.js';

const makeLlmCall = (inputTokens: number, outputTokens: number, modelId = 'claude-opus-4-6', ts = Date.now()) => ({
  type: 'llm_call' as const,
  session_id: 's1',
  timestamp: ts,
  model_id: modelId,
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  cost_usd: 0.01,
  latency_ms: 500,
});

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  session_id: 's1',
  started_at: Date.now(),
  model_id: 'claude-opus-4-6',
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost_usd: 0,
  recent_tool_calls: [] as any[],
  recent_llm_calls: [] as any[],
  last_event_timestamp: Date.now(),
  ...overrides,
});

describe('TokenBloatDetector', () => {
  // claude-opus-4-6 has p90_input_output_ratio = 8
  // With ratio_multiplier = 2, threshold = 8 * 2 = 16
  const detector = new TokenBloatDetector({ ratio_multiplier: 2 });

  it('returns null for a normal ratio below threshold', () => {
    // ratio = 1000 / 200 = 5, threshold = 16 → below
    const event = makeLlmCall(1000, 200);
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('returns null for a ratio exactly at threshold', () => {
    // ratio = 16/1 = 16, threshold = 16 → not > threshold
    const event = makeLlmCall(16000, 1000);
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('returns warning detection when ratio exceeds threshold but not 3x', () => {
    // ratio = 17, threshold = 16, 3x threshold = 24 → warning
    const event = makeLlmCall(17000, 1000);
    const result = detector.analyze(event, makeContext());
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.detector_type).toBe('token_bloat');
  });

  it('returns critical detection when ratio exceeds 3x p90 baseline', () => {
    // p90 = 8, 3x = 24, ratio = 25 → critical
    const event = makeLlmCall(25000, 1000);
    const result = detector.analyze(event, makeContext());
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('returns null for non-llm_call events', () => {
    const event = {
      type: 'tool_call' as const,
      session_id: 's1',
      timestamp: Date.now(),
      tool_name: 'bash',
      arguments_hash: 'abc',
      result_summary: '',
      duration_ms: 100,
    };
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('returns null when model pricing is unknown', () => {
    const event = makeLlmCall(50000, 100, 'unknown-model-xyz');
    // No pricing for unknown model → null
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('records evidence fields correctly', () => {
    const event = makeLlmCall(20000, 1000, 'claude-opus-4-6');
    const result = detector.analyze(event, makeContext());
    expect(result).not.toBeNull();
    expect(result!.evidence).toMatchObject({
      input_tokens: 20000,
      output_tokens: 1000,
      model_id: 'claude-opus-4-6',
      p90_baseline: 8,
    });
    expect(typeof result!.evidence.ratio).toBe('number');
    expect(typeof result!.evidence.threshold).toBe('number');
  });

  it('handles zero output tokens (uses Math.max(output, 1))', () => {
    // ratio = 10000 / 1 = 10000 → critical
    const event = makeLlmCall(10000, 0);
    const result = detector.analyze(event, makeContext());
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('works with different models that have different baselines', () => {
    // claude-haiku-4-5 has p90 = 6, threshold = 6*2 = 12
    const event = makeLlmCall(13000, 1000, 'claude-haiku-4-5');
    const result = detector.analyze(event, makeContext({ model_id: 'claude-haiku-4-5' }));
    expect(result).not.toBeNull();
    expect(result!.evidence.p90_baseline).toBe(6);
  });
});
