import { describe, it, expect } from 'vitest';
import { SessionTracker } from '../../packages/engine/src/session-tracker.js';

describe('SessionTracker', () => {
  it('creates and retrieves a session context', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'claude-opus-4-6', Date.now(), 'Fix this bug');
    const ctx = tracker.getContext('s1');
    expect(ctx).toBeDefined();
    expect(ctx!.model_id).toBe('claude-opus-4-6');
    expect(ctx!.initial_prompt).toBe('Fix this bug');
    expect(ctx!.total_input_tokens).toBe(0);
  });

  it('tracks LLM call totals', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'model', Date.now());
    tracker.addLlmCall('s1', { type: 'llm_call', session_id: 's1', model_id: 'model', provider: 'p', input_tokens: 100, output_tokens: 50, latency_ms: 500, react_loop_index: 0, timestamp: Date.now() } as any, 0.05);
    const ctx = tracker.getContext('s1')!;
    expect(ctx.total_input_tokens).toBe(100);
    expect(ctx.total_output_tokens).toBe(50);
    expect(ctx.total_cost_usd).toBeCloseTo(0.05);
    expect(ctx.recent_llm_calls).toHaveLength(1);
  });

  it('tracks tool calls in recent history', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'model', Date.now());
    tracker.addToolCall('s1', { type: 'tool_call', session_id: 's1', tool_name: 'file_search', arguments_hash: 'abc', result_summary: '', duration_ms: 100, timestamp: Date.now() } as any);
    const ctx = tracker.getContext('s1')!;
    expect(ctx.recent_tool_calls).toHaveLength(1);
    expect(ctx.recent_tool_calls[0].tool_name).toBe('file_search');
  });

  it('ends session and returns context', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'model', Date.now());
    const ctx = tracker.endSession('s1');
    expect(ctx).toBeDefined();
    expect(tracker.getContext('s1')).toBeUndefined();
  });

  it('lists active session IDs', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'model', Date.now());
    tracker.startSession('s2', 'model', Date.now());
    tracker.endSession('s1');
    expect(tracker.getActiveSessionIds()).toEqual(['s2']);
  });

  it('caps recent calls at 50', () => {
    const tracker = new SessionTracker();
    tracker.startSession('s1', 'model', Date.now());
    for (let i = 0; i < 60; i++) {
      tracker.addToolCall('s1', { type: 'tool_call', session_id: 's1', tool_name: 't', arguments_hash: String(i), result_summary: '', duration_ms: 1, timestamp: Date.now() } as any);
    }
    expect(tracker.getContext('s1')!.recent_tool_calls).toHaveLength(50);
  });
});
