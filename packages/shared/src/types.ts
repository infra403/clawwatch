// ---------------------------------------------------------------------------
// IPC Event types
// ---------------------------------------------------------------------------

export interface SessionStartEvent {
  type: 'session_start';
  sessionId: string;
  timestamp: number;
  pid: number;
  workingDir: string;
  model: string;
}

export interface SessionEndEvent {
  type: 'session_end';
  sessionId: string;
  timestamp: number;
  exitCode: number | null;
}

export interface LlmCallEvent {
  type: 'llm_call';
  sessionId: string;
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  cost: number;
}

export interface ToolCallEvent {
  type: 'tool_call';
  sessionId: string;
  timestamp: number;
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface PluginEvent {
  type: 'plugin_event';
  sessionId: string;
  timestamp: number;
  plugin: string;
  payload: unknown;
}

export type IpcEvent =
  | SessionStartEvent
  | SessionEndEvent
  | LlmCallEvent
  | ToolCallEvent
  | PluginEvent;

// ---------------------------------------------------------------------------
// Command types (engine -> plugin / client)
// ---------------------------------------------------------------------------

export interface BudgetExceededCommand {
  type: 'budget_exceeded';
  sessionId: string;
  budget: number;
  spent: number;
}

export interface DetectionAlertCommand {
  type: 'detection_alert';
  sessionId: string;
  detection: Detection;
}

export type EngineCommand = BudgetExceededCommand | DetectionAlertCommand;

// ---------------------------------------------------------------------------
// Detection types
// ---------------------------------------------------------------------------

export type DetectorType =
  | 'spin_loop'
  | 'tool_thrash'
  | 'cost_spike'
  | 'context_bloat'
  | 'prompt_injection'
  | 'runaway_session';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Detection {
  id: string;
  sessionId: string;
  detectorType: DetectorType;
  severity: Severity;
  timestamp: number;
  message: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

export interface SessionContext {
  sessionId: string;
  startTime: number;
  pid: number;
  workingDir: string;
  model: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  llmCallCount: number;
  toolCallCount: number;
  detections: Detection[];
}

// ---------------------------------------------------------------------------
// Detector interface
// ---------------------------------------------------------------------------

export interface Detector {
  type: DetectorType;
  analyze(event: IpcEvent, context: SessionContext): Detection | null;
}

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

export interface ModelPricingOverride {
  inputPer1M: number;
  outputPer1M: number;
}

export interface BudgetConfig {
  dailyLimitUsd: number;
  sessionLimitUsd: number;
  alertThreshold: number; // 0-1 fraction of limit
}

export interface DetectorConfig {
  enabled: boolean;
  spinLoopThreshold: number;
  toolThrashThreshold: number;
  costSpikeMultiplier: number;
  contextBloatThreshold: number; // tokens
  runawaySessionMinutes: number;
}

export interface ClawWatchConfig {
  dashboardPort: number;
  budget: BudgetConfig;
  detectors: DetectorConfig;
  pricingOverrides: Record<string, ModelPricingOverride>;
}
