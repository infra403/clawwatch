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
// Detection types (legacy)
// ---------------------------------------------------------------------------

export type LegacyDetectorType =
  | 'spin_loop'
  | 'tool_thrash'
  | 'cost_spike'
  | 'context_bloat'
  | 'prompt_injection'
  | 'runaway_session';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Detector types (v2)
// ---------------------------------------------------------------------------

export type DetectorType =
  | 'loop_spinning'
  | 'token_bloat'
  | 'stalling'
  | 'tool_abuse'
  | 'task_drift'
  | 'model_mismatch';

export type DetectionSeverity = 'info' | 'warning' | 'critical';

export interface Detection {
  id: string;
  session_id: string;
  timestamp: number;
  detector_type: DetectorType;
  severity: DetectionSeverity;
  description: string;
  evidence: Record<string, unknown>;
  tokens_wasted?: number;
  cost_wasted_usd?: number;
}

// ---------------------------------------------------------------------------
// Plugin event types (v2)
// ---------------------------------------------------------------------------

export interface ToolCallPluginEvent {
  type: 'tool_call';
  session_id: string;
  timestamp: number;
  tool_name: string;
  arguments_hash: string;
  result_summary: string;
  duration_ms: number;
}

export interface LlmCallPluginEvent {
  type: 'llm_call';
  session_id: string;
  timestamp: number;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export interface SessionStartPluginEvent {
  type: 'session_start';
  session_id: string;
  timestamp: number;
  model_id: string;
  provider: string;
  initial_prompt?: string;
}

export interface SessionEndPluginEvent {
  type: 'session_end';
  session_id: string;
  timestamp: number;
}

export interface GenericPluginEvent {
  type: string;
  session_id: string;
  timestamp: number;
  [key: string]: unknown;
}

export type PluginEvent =
  | ToolCallPluginEvent
  | LlmCallPluginEvent
  | SessionStartPluginEvent
  | SessionEndPluginEvent
  | GenericPluginEvent;

// ---------------------------------------------------------------------------
// Session context (v2)
// ---------------------------------------------------------------------------

export interface SessionContext {
  session_id: string;
  started_at: number;
  initial_prompt?: string;
  model_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  recent_tool_calls: ToolCallPluginEvent[];
  recent_llm_calls: LlmCallPluginEvent[];
  last_event_timestamp: number;
}

// ---------------------------------------------------------------------------
// Detector interface (v2)
// ---------------------------------------------------------------------------

export interface Detector {
  name: DetectorType;
  type: 'rule' | 'heuristic';
  defaultEnabled: boolean;
  analyze(event: PluginEvent, context: SessionContext): Detection | null;
}

// ---------------------------------------------------------------------------
// Legacy session context
// ---------------------------------------------------------------------------

export interface LegacySessionContext {
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
// Legacy detector interface
// ---------------------------------------------------------------------------

export interface LegacyDetector {
  type: LegacyDetectorType;
  analyze(event: IpcEvent, context: LegacySessionContext): Detection | null;
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

// ---------------------------------------------------------------------------
// Per-detector configs (v2)
// ---------------------------------------------------------------------------

export interface LoopSpinningConfig {
  enabled: boolean;
  window_seconds: number;
  min_repeats: number;
}

export interface TokenBloatConfig {
  enabled: boolean;
  ratio_multiplier: number;
}

export interface StallingConfig {
  enabled: boolean;
  timeout_seconds: number;
}

export interface ToolAbuseConfig {
  enabled: boolean;
  max_calls_per_minute: number;
}

export interface TaskDriftConfig {
  enabled: boolean;
  similarity_threshold: number;
}

export interface ModelMismatchConfig {
  enabled: boolean;
  cost_complexity_ratio: number;
}

export interface DetectorsConfig {
  loop_spinning: LoopSpinningConfig;
  token_bloat: TokenBloatConfig;
  stalling: StallingConfig;
  tool_abuse: ToolAbuseConfig;
  task_drift: TaskDriftConfig;
  model_mismatch: ModelMismatchConfig;
}

export interface ClawWatchConfig {
  dashboardPort: number;
  budget: BudgetConfig;
  detectors: DetectorsConfig;
  pricingOverrides: Record<string, ModelPricingOverride>;
}
