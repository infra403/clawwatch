import { describe, it, expect } from 'vitest';
import { ModelMismatchDetector } from '../../../packages/engine/src/detectors/model-mismatch.js';

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

describe('ModelMismatchDetector (Phase 1 stub)', () => {
  const detector = new ModelMismatchDetector({ cost_complexity_ratio: 10 });

  it('always returns null for tool_call events', () => {
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

  it('always returns null for llm_call events with expensive model', () => {
    const event = {
      type: 'llm_call' as const,
      session_id: 's1',
      timestamp: Date.now(),
      model_id: 'claude-opus-4-6',
      input_tokens: 500,
      output_tokens: 10,
      cost_usd: 1.5,
      latency_ms: 500,
    };
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('always returns null for generic events', () => {
    const event = {
      type: 'session_start',
      session_id: 's1',
      timestamp: Date.now(),
    };
    expect(detector.analyze(event, makeContext())).toBeNull();
  });

  it('has correct metadata', () => {
    expect(detector.name).toBe('model_mismatch');
    expect(detector.type).toBe('heuristic');
    expect(detector.defaultEnabled).toBe(false);
  });

  it('returns null regardless of context state', () => {
    const event = {
      type: 'llm_call' as const,
      session_id: 's1',
      timestamp: Date.now(),
      model_id: 'claude-opus-4-6',
      input_tokens: 100,
      output_tokens: 5,
      cost_usd: 50,
      latency_ms: 200,
    };
    const ctx = makeContext({
      model_id: 'claude-opus-4-6',
      total_cost_usd: 999,
      initial_prompt: 'hello',
    });
    expect(detector.analyze(event, ctx)).toBeNull();
  });
});
