import { v4 as uuidv4 } from 'uuid';
import type {
  PluginEvent,
  SessionStartPluginEvent,
  SessionEndPluginEvent,
  LlmCallPluginEvent,
  ToolCallPluginEvent,
  ClawWatchConfig,
  Detector,
  Detection,
  EngineCommand,
  SessionContext as DetectorSessionContext,
} from '@clawwatch/shared';
import type { LlmCallRow, ToolCallRow } from './db.js';
import { ClawWatchDB } from './db.js';
import { SessionTracker } from './session-tracker.js';
import { CostCalculator } from './cost-calculator.js';
import { BudgetGuardian } from './budget-guardian.js';
import { calculateEfficiency } from './efficiency-scorer.js';
import { createDetectors } from './detectors/index.js';

export interface PipelineOptions {
  config: ClawWatchConfig;
  db: ClawWatchDB;
  onCommand?: (command: EngineCommand) => void;
}

export class Pipeline {
  private config: ClawWatchConfig;
  private db: ClawWatchDB;
  private tracker: SessionTracker;
  private costCalc: CostCalculator;
  private budgetGuardian: BudgetGuardian;
  private detectors: Detector[];
  private onCommand: (command: EngineCommand) => void;

  /** Track last LLM call ID per session for tool call association */
  private lastLlmCallId: Map<string, string> = new Map();

  constructor(opts: PipelineOptions) {
    this.config = opts.config;
    this.db = opts.db;
    this.onCommand = opts.onCommand ?? (() => {});
    this.tracker = new SessionTracker();
    this.costCalc = new CostCalculator(opts.config.pricingOverrides);
    this.budgetGuardian = new BudgetGuardian(opts.config.budget);
    this.detectors = createDetectors(opts.config);
  }

  process(event: PluginEvent): void {
    switch (event.type) {
      case 'session_start':
        this.handleSessionStart(event as SessionStartPluginEvent);
        break;
      case 'session_end':
        this.handleSessionEnd(event as SessionEndPluginEvent);
        break;
      case 'llm_call':
        this.handleLlmCall(event as LlmCallPluginEvent);
        break;
      case 'tool_call':
        this.handleToolCall(event as ToolCallPluginEvent);
        break;
      default:
        // GenericPluginEvent — run detectors only
        this.runDetectors(event);
        break;
    }
  }

  private handleSessionStart(event: SessionStartPluginEvent): void {
    const sessionId = event.session_id;

    // Track in memory
    this.tracker.startSession(
      sessionId,
      event.model_id,
      event.timestamp,
      event.initial_prompt,
    );

    // Persist to DB
    this.db.insertSession({
      id: sessionId,
      openclaw_session_id: sessionId,
      started_at: event.timestamp,
      model_id: event.model_id,
      provider: event.provider,
      status: 'active',
    });
  }

  private handleSessionEnd(event: SessionEndPluginEvent): void {
    const sessionId = event.session_id;
    const ctx = this.tracker.getContext(sessionId);
    if (!ctx) return;

    // Calculate efficiency score
    const detections = this.db.getDetectionsBySession(sessionId);
    const detectionCounts = this.aggregateDetections(detections);
    const efficiencyScore = calculateEfficiency(
      ctx.total_input_tokens + ctx.total_output_tokens,
      ctx.total_input_tokens + ctx.total_output_tokens - this.sumWastedTokens(detections),
      detectionCounts,
    );

    // End in DB
    this.db.endSession(sessionId, event.timestamp, efficiencyScore);

    // Clean up
    this.tracker.endSession(sessionId);
    this.lastLlmCallId.delete(sessionId);
  }

  private handleLlmCall(event: LlmCallPluginEvent): void {
    const sessionId = event.session_id;
    const ctx = this.tracker.getContext(sessionId);
    if (!ctx) return;

    // Calculate cost
    const costUsd = this.costCalc.calculate(
      event.model_id,
      event.input_tokens,
      event.output_tokens,
    );

    const callId = uuidv4();

    // Build DB row
    const row: LlmCallRow = {
      id: callId,
      session_id: sessionId,
      timestamp: event.timestamp,
      model_id: event.model_id,
      provider: ctx.model_id === event.model_id ? 'anthropic' : 'unknown',
      input_tokens: event.input_tokens,
      output_tokens: event.output_tokens,
      cost_usd: costUsd,
      latency_ms: event.latency_ms,
    };

    // Persist
    this.db.insertLlmCall(row);
    this.db.updateSessionTokens(sessionId, event.input_tokens, event.output_tokens, costUsd);

    // Update tracker
    this.tracker.addLlmCall(sessionId, row, costUsd);

    // Track for tool call association
    this.lastLlmCallId.set(sessionId, callId);

    // Run detectors
    this.runDetectors(event);

    // Check budget
    this.checkBudget(sessionId);
  }

  private handleToolCall(event: ToolCallPluginEvent): void {
    const sessionId = event.session_id;
    const ctx = this.tracker.getContext(sessionId);
    if (!ctx) return;

    const callId = uuidv4();
    const llmCallId = this.lastLlmCallId.get(sessionId) ?? '';

    const row: ToolCallRow = {
      id: callId,
      session_id: sessionId,
      llm_call_id: llmCallId,
      timestamp: event.timestamp,
      tool_name: event.tool_name,
      arguments_hash: event.arguments_hash,
      result_summary: event.result_summary,
      duration_ms: event.duration_ms,
    };

    // Persist
    this.db.insertToolCall(row);

    // Update tracker
    this.tracker.addToolCall(sessionId, row);

    // Run detectors
    this.runDetectors(event);
  }

  private runDetectors(event: PluginEvent): void {
    const sessionId = (event as { session_id: string }).session_id;
    const ctx = this.tracker.getContext(sessionId);
    if (!ctx) return;

    // Convert session-tracker context to detector-expected context
    const detectorCtx = this.toDetectorContext(ctx);

    for (const detector of this.detectors) {
      const detection = detector.analyze(event, detectorCtx);
      if (detection) {
        this.db.insertDetection(detection);
        this.onCommand({
          type: 'detection_alert',
          sessionId,
          detection,
        });
      }
    }
  }

  private toDetectorContext(
    ctx: import('./session-tracker.js').SessionContext,
  ): DetectorSessionContext {
    return {
      session_id: ctx.session_id,
      started_at: ctx.start_timestamp,
      initial_prompt: ctx.initial_prompt,
      model_id: ctx.model_id,
      total_input_tokens: ctx.total_input_tokens,
      total_output_tokens: ctx.total_output_tokens,
      total_cost_usd: ctx.total_cost_usd,
      last_event_timestamp: ctx.last_event_timestamp,
      recent_tool_calls: ctx.recent_tool_calls.map((t) => ({
        type: 'tool_call' as const,
        session_id: t.session_id,
        timestamp: t.timestamp,
        tool_name: t.tool_name,
        arguments_hash: t.arguments_hash,
        result_summary: t.result_summary ?? '',
        duration_ms: t.duration_ms,
      })),
      recent_llm_calls: ctx.recent_llm_calls.map((l) => ({
        type: 'llm_call' as const,
        session_id: l.session_id,
        timestamp: l.timestamp,
        model_id: l.model_id,
        input_tokens: l.input_tokens,
        output_tokens: l.output_tokens,
        cost_usd: l.cost_usd,
        latency_ms: l.latency_ms,
      })),
    };
  }

  private checkBudget(sessionId: string): void {
    const ctx = this.tracker.getContext(sessionId);
    if (!ctx) return;

    const dailyMetrics = this.db.getTodayMetrics();

    const alerts = this.budgetGuardian.check({
      sessionSpend: ctx.total_cost_usd,
      dailySpend: dailyMetrics.total_cost,
    });

    for (const alert of alerts) {
      if (alert.level === 'exceeded') {
        this.onCommand({
          type: 'budget_exceeded',
          sessionId,
          budget: alert.limitUsd,
          spent: alert.currentUsd,
        });
      }
    }
  }

  private aggregateDetections(
    detections: Record<string, unknown>[],
  ): { severity: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const d of detections) {
      const sev = d.severity as string;
      counts.set(sev, (counts.get(sev) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([severity, count]) => ({
      severity,
      count,
    }));
  }

  private sumWastedTokens(detections: Record<string, unknown>[]): number {
    return detections.reduce(
      (sum, d) => sum + ((d.tokens_wasted as number) ?? 0),
      0,
    );
  }
}
