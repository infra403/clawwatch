import type { LlmCallRow, ToolCallRow } from './db.js';

const MAX_RECENT = 50;

export interface SessionContext {
  session_id: string;
  model_id: string;
  start_timestamp: number;
  last_event_timestamp: number;
  initial_prompt?: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  llm_call_count: number;
  tool_call_count: number;
  recent_llm_calls: LlmCallRow[];
  recent_tool_calls: ToolCallRow[];
}

export class SessionTracker {
  private sessions: Map<string, SessionContext> = new Map();

  startSession(
    id: string,
    modelId: string,
    timestamp: number,
    initialPrompt?: string
  ): void {
    const ctx: SessionContext = {
      session_id: id,
      model_id: modelId,
      start_timestamp: timestamp,
      last_event_timestamp: timestamp,
      initial_prompt: initialPrompt,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      llm_call_count: 0,
      tool_call_count: 0,
      recent_llm_calls: [],
      recent_tool_calls: [],
    };
    this.sessions.set(id, ctx);
  }

  endSession(id: string): SessionContext | undefined {
    const ctx = this.sessions.get(id);
    if (ctx) {
      this.sessions.delete(id);
    }
    return ctx;
  }

  getContext(id: string): SessionContext | undefined {
    return this.sessions.get(id);
  }

  addLlmCall(sessionId: string, event: LlmCallRow, costUsd: number): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) return;

    ctx.total_input_tokens += event.input_tokens;
    ctx.total_output_tokens += event.output_tokens;
    ctx.total_cost_usd += costUsd;
    ctx.llm_call_count += 1;
    ctx.last_event_timestamp = event.timestamp;

    ctx.recent_llm_calls.push(event);
    if (ctx.recent_llm_calls.length > MAX_RECENT) {
      ctx.recent_llm_calls.shift();
    }
  }

  addToolCall(sessionId: string, event: ToolCallRow): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) return;

    ctx.tool_call_count += 1;
    ctx.last_event_timestamp = event.timestamp;

    ctx.recent_tool_calls.push(event);
    if (ctx.recent_tool_calls.length > MAX_RECENT) {
      ctx.recent_tool_calls.shift();
    }
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
