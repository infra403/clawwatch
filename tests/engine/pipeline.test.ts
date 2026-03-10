import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pipeline } from '../../packages/engine/src/pipeline.js';
import { ClawWatchDB } from '../../packages/engine/src/db.js';
import { DEFAULT_CONFIG } from '../../packages/shared/src/config.js';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type {
  SessionStartPluginEvent,
  SessionEndPluginEvent,
  LlmCallPluginEvent,
  ToolCallPluginEvent,
  PluginEvent,
  EngineCommand,
} from '../../packages/shared/src/types.js';

describe('Pipeline', () => {
  let db: ClawWatchDB;
  let pipeline: Pipeline;
  let tmpDir: string;
  let emittedCommands: EngineCommand[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pipeline-test-'));
    db = new ClawWatchDB(join(tmpDir, 'test.db'));
    emittedCommands = [];
    pipeline = new Pipeline({
      config: DEFAULT_CONFIG,
      db,
      onCommand: (cmd) => emittedCommands.push(cmd),
    });
  });

  function sessionStart(overrides: Partial<SessionStartPluginEvent> = {}): SessionStartPluginEvent {
    return {
      type: 'session_start',
      session_id: 'sess-1',
      timestamp: Date.now(),
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
      ...overrides,
    };
  }

  function llmCall(overrides: Partial<LlmCallPluginEvent> = {}): LlmCallPluginEvent {
    return {
      type: 'llm_call',
      session_id: 'sess-1',
      timestamp: Date.now(),
      model_id: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: 0,
      latency_ms: 200,
      ...overrides,
    };
  }

  function toolCall(overrides: Partial<ToolCallPluginEvent> = {}): ToolCallPluginEvent {
    return {
      type: 'tool_call',
      session_id: 'sess-1',
      timestamp: Date.now(),
      tool_name: 'read_file',
      arguments_hash: 'abc123',
      result_summary: 'ok',
      duration_ms: 50,
      ...overrides,
    };
  }

  function sessionEnd(overrides: Partial<SessionEndPluginEvent> = {}): SessionEndPluginEvent {
    return {
      type: 'session_end',
      session_id: 'sess-1',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('processes a full session lifecycle', () => {
    pipeline.process(sessionStart());
    pipeline.process(llmCall());
    pipeline.process(toolCall());
    pipeline.process(sessionEnd());

    // Session should be persisted
    const session = db.getSession('sess-1');
    expect(session).not.toBeNull();
    expect(session!.status).toBe('ended');
    expect(session!.total_input_tokens).toBe(1000);
    expect(session!.total_output_tokens).toBe(500);
  });

  it('persists LLM calls to database', () => {
    pipeline.process(sessionStart());
    pipeline.process(llmCall());

    const calls = db.getLlmCallsBySession('sess-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].model_id).toBe('claude-sonnet-4-6');
  });

  it('persists tool calls to database', () => {
    pipeline.process(sessionStart());
    pipeline.process(llmCall()); // Need an LLM call for tool call to reference
    pipeline.process(toolCall());

    const calls = db.getToolCallsBySession('sess-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].tool_name).toBe('read_file');
  });

  it('calculates cost for LLM calls', () => {
    pipeline.process(sessionStart());
    pipeline.process(llmCall({ model_id: 'claude-opus-4-6', input_tokens: 1000, output_tokens: 500 }));

    const calls = db.getLlmCallsBySession('sess-1');
    expect(calls).toHaveLength(1);
    expect((calls[0].cost_usd as number)).toBeGreaterThan(0);
  });

  it('ignores events for unknown sessions', () => {
    // No session_start, so llm_call should be handled gracefully
    pipeline.process(llmCall({ session_id: 'unknown' }));

    const calls = db.getLlmCallsBySession('unknown');
    expect(calls).toHaveLength(0);
  });

  it('computes efficiency score on session end', () => {
    pipeline.process(sessionStart());
    pipeline.process(llmCall());
    pipeline.process(sessionEnd());

    const session = db.getSession('sess-1');
    expect(session).not.toBeNull();
    expect(typeof session!.efficiency_score).toBe('number');
    expect(session!.efficiency_score as number).toBeGreaterThanOrEqual(0);
    expect(session!.efficiency_score as number).toBeLessThanOrEqual(100);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
