import { createHash } from 'node:crypto';
import type {
  ToolCallPluginEvent,
  LlmCallPluginEvent,
  SessionStartPluginEvent,
  SessionEndPluginEvent,
} from '@clawwatch/shared';

/**
 * Build a session_start plugin event.
 */
export function makeSessionStartEvent(opts: {
  sessionId: string;
  modelId: string;
  provider: string;
  initialPrompt?: string;
}): SessionStartPluginEvent {
  return {
    type: 'session_start',
    session_id: opts.sessionId,
    timestamp: Date.now(),
    model_id: opts.modelId,
    provider: opts.provider,
    initial_prompt: opts.initialPrompt,
  };
}

/**
 * Build a session_end plugin event.
 */
export function makeSessionEndEvent(sessionId: string): SessionEndPluginEvent {
  return {
    type: 'session_end',
    session_id: sessionId,
    timestamp: Date.now(),
  };
}

/**
 * Build a tool_call plugin event from intercepted data.
 * Computes SHA-256 hash of the arguments for loop detection.
 */
export function makeToolCallEvent(opts: {
  sessionId: string;
  toolName: string;
  args: unknown;
  resultSummary: string;
  durationMs: number;
}): ToolCallPluginEvent {
  return {
    type: 'tool_call',
    session_id: opts.sessionId,
    timestamp: Date.now(),
    tool_name: opts.toolName,
    arguments_hash: hashArguments(opts.args),
    result_summary: opts.resultSummary,
    duration_ms: opts.durationMs,
  };
}

/**
 * Build an llm_call plugin event from intercepted data.
 */
export function makeLlmCallEvent(opts: {
  sessionId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}): LlmCallPluginEvent {
  return {
    type: 'llm_call',
    session_id: opts.sessionId,
    timestamp: Date.now(),
    model_id: opts.modelId,
    input_tokens: opts.inputTokens,
    output_tokens: opts.outputTokens,
    cost_usd: opts.costUsd,
    latency_ms: opts.latencyMs,
  };
}

/**
 * SHA-256 hash of serialized arguments for dedup/loop detection.
 */
export function hashArguments(args: unknown): string {
  const serialized = JSON.stringify(args ?? null);
  return createHash('sha256').update(serialized).digest('hex');
}
