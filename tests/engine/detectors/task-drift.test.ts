import { describe, it, expect } from 'vitest';
import { TaskDriftDetector } from '../../../packages/engine/src/detectors/task-drift.js';

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

describe('TaskDriftDetector (Phase 1 stub)', () => {
  const detector = new TaskDriftDetector({ similarity_threshold: 0.3 });

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

  it('always returns null for llm_call events', () => {
    const event = {
      type: 'llm_call' as const,
      session_id: 's1',
      timestamp: Date.now(),
      model_id: 'claude-opus-4-6',
      input_tokens: 10000,
      output_tokens: 100,
      cost_usd: 0.01,
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
    expect(detector.name).toBe('task_drift');
    expect(detector.type).toBe('heuristic');
    expect(detector.defaultEnabled).toBe(false);
  });

  it('returns null regardless of context state', () => {
    const event = {
      type: 'tool_call' as const,
      session_id: 's1',
      timestamp: Date.now(),
      tool_name: 'write',
      arguments_hash: 'xyz',
      result_summary: '',
      duration_ms: 200,
    };
    const ctx = makeContext({
      initial_prompt: 'Fix the bug in auth.ts',
      total_input_tokens: 999999,
      total_cost_usd: 100,
    });
    expect(detector.analyze(event, ctx)).toBeNull();
  });
});
