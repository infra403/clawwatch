import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SessionRow {
  id: string;
  openclaw_session_id: string;
  started_at: number;
  ended_at?: number | null;
  initial_prompt?: string;
  model_id: string;
  provider: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost_usd?: number;
  efficiency_score?: number | null;
  status: string;
}

export interface LlmCallRow {
  id: string;
  session_id: string;
  timestamp: number;
  model_id: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  prompt_text?: string;
  response_text?: string;
  react_loop_index?: number;
}

export interface ToolCallRow {
  id: string;
  session_id: string;
  llm_call_id: string;
  timestamp: number;
  tool_name: string;
  arguments_hash: string;
  arguments?: string;
  result_summary?: string;
  result_full?: string;
  duration_ms: number;
  is_duplicate?: number;
}

export interface DetectionRow {
  id: string;
  session_id: string;
  timestamp: number;
  detector_type: string;
  severity: string;
  description: string;
  evidence?: Record<string, unknown> | string;
  tokens_wasted?: number;
  cost_wasted_usd?: number;
}

export class ClawWatchDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        openclaw_session_id TEXT,
        started_at INTEGER,
        ended_at INTEGER NULL,
        initial_prompt TEXT,
        model_id TEXT,
        provider TEXT,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        total_cost_usd REAL DEFAULT 0,
        efficiency_score INTEGER,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS llm_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        timestamp INTEGER,
        model_id TEXT,
        provider TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        latency_ms INTEGER,
        prompt_text TEXT,
        response_text TEXT,
        react_loop_index INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        llm_call_id TEXT REFERENCES llm_calls(id),
        timestamp INTEGER,
        tool_name TEXT,
        arguments_hash TEXT,
        arguments TEXT,
        result_summary TEXT,
        result_full TEXT,
        duration_ms INTEGER,
        is_duplicate INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS detections (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        timestamp INTEGER,
        detector_type TEXT,
        severity TEXT,
        description TEXT,
        evidence TEXT DEFAULT '{}',
        tokens_wasted INTEGER DEFAULT 0,
        cost_wasted_usd REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS budget_rules (
        id TEXT PRIMARY KEY,
        scope TEXT,
        limit_usd REAL,
        warn_at_pct INTEGER DEFAULT 80,
        action TEXT DEFAULT 'pause',
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS daily_metrics (
        date TEXT PRIMARY KEY,
        total_sessions INTEGER,
        total_llm_calls INTEGER,
        total_tool_calls INTEGER,
        total_input_tokens INTEGER,
        total_output_tokens INTEGER,
        total_cost_usd REAL,
        total_waste_usd REAL,
        avg_efficiency_score INTEGER,
        detections_count TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_llm_calls_session_timestamp ON llm_calls(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_session_name_hash ON tool_calls(session_id, tool_name, arguments_hash);
      CREATE INDEX IF NOT EXISTS idx_detections_session_type ON detections(session_id, detector_type);
      CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections(timestamp);
    `);
  }

  listTables(): string[] {
    const rows = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  insertSession(s: SessionRow): void {
    this.db
      .prepare(`
        INSERT INTO sessions (id, openclaw_session_id, started_at, ended_at, initial_prompt, model_id, provider,
          total_input_tokens, total_output_tokens, total_cost_usd, efficiency_score, status)
        VALUES (@id, @openclaw_session_id, @started_at, @ended_at, @initial_prompt, @model_id, @provider,
          @total_input_tokens, @total_output_tokens, @total_cost_usd, @efficiency_score, @status)
      `)
      .run({
        ended_at: null,
        initial_prompt: null,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        efficiency_score: null,
        ...s,
      });
  }

  getSession(id: string): Record<string, unknown> | null {
    const row = this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  updateSessionTokens(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): void {
    this.db
      .prepare(`
        UPDATE sessions
        SET total_input_tokens = total_input_tokens + @inputTokens,
            total_output_tokens = total_output_tokens + @outputTokens,
            total_cost_usd = total_cost_usd + @costUsd
        WHERE id = @sessionId
      `)
      .run({ sessionId, inputTokens, outputTokens, costUsd });
  }

  endSession(sessionId: string, endedAt: number, efficiencyScore: number): void {
    this.db
      .prepare(`
        UPDATE sessions
        SET ended_at = @endedAt, efficiency_score = @efficiencyScore, status = 'ended'
        WHERE id = @sessionId
      `)
      .run({ sessionId, endedAt, efficiencyScore });
  }

  insertLlmCall(c: LlmCallRow): void {
    this.db
      .prepare(`
        INSERT INTO llm_calls (id, session_id, timestamp, model_id, provider, input_tokens, output_tokens,
          cost_usd, latency_ms, prompt_text, response_text, react_loop_index)
        VALUES (@id, @session_id, @timestamp, @model_id, @provider, @input_tokens, @output_tokens,
          @cost_usd, @latency_ms, @prompt_text, @response_text, @react_loop_index)
      `)
      .run({
        prompt_text: null,
        response_text: null,
        react_loop_index: 0,
        ...c,
      });
  }

  insertToolCall(t: ToolCallRow): void {
    this.db
      .prepare(`
        INSERT INTO tool_calls (id, session_id, llm_call_id, timestamp, tool_name, arguments_hash,
          arguments, result_summary, result_full, duration_ms, is_duplicate)
        VALUES (@id, @session_id, @llm_call_id, @timestamp, @tool_name, @arguments_hash,
          @arguments, @result_summary, @result_full, @duration_ms, @is_duplicate)
      `)
      .run({
        arguments: null,
        result_summary: null,
        result_full: null,
        is_duplicate: 0,
        ...t,
      });
  }

  insertDetection(d: DetectionRow): void {
    const evidence =
      typeof d.evidence === 'object' && d.evidence !== null
        ? JSON.stringify(d.evidence)
        : (d.evidence ?? '{}');
    this.db
      .prepare(`
        INSERT INTO detections (id, session_id, timestamp, detector_type, severity, description,
          evidence, tokens_wasted, cost_wasted_usd)
        VALUES (@id, @session_id, @timestamp, @detector_type, @severity, @description,
          @evidence, @tokens_wasted, @cost_wasted_usd)
      `)
      .run({
        tokens_wasted: 0,
        cost_wasted_usd: 0,
        ...d,
        evidence,
      });
  }

  getDetectionsBySession(sessionId: string): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM detections WHERE session_id = ? ORDER BY timestamp ASC`)
      .all(sessionId) as Record<string, unknown>[];
  }

  getRecentDetections(limit = 20): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM detections ORDER BY timestamp DESC LIMIT ?`)
      .all(limit) as Record<string, unknown>[];
  }

  getActiveSessions(): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC`)
      .all() as Record<string, unknown>[];
  }

  getLlmCallsBySession(sessionId: string): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM llm_calls WHERE session_id = ? ORDER BY timestamp ASC`)
      .all(sessionId) as Record<string, unknown>[];
  }

  getToolCallsBySession(sessionId: string): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM tool_calls WHERE session_id = ? ORDER BY timestamp ASC`)
      .all(sessionId) as Record<string, unknown>[];
  }

  getTodayMetrics(): {
    total_cost: number;
    total_waste: number;
    detection_count: number;
    session_count: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(today).getTime();
    const endOfDay = startOfDay + 86400000;

    const costRow = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_cost_usd), 0) as total_cost, COUNT(*) as session_count
         FROM sessions WHERE started_at >= ? AND started_at < ?`
      )
      .get(startOfDay, endOfDay) as { total_cost: number; session_count: number };

    const wasteRow = this.db
      .prepare(
        `SELECT COALESCE(SUM(cost_wasted_usd), 0) as total_waste, COUNT(*) as detection_count
         FROM detections WHERE timestamp >= ? AND timestamp < ?`
      )
      .get(startOfDay, endOfDay) as { total_waste: number; detection_count: number };

    return {
      total_cost: costRow.total_cost,
      total_waste: wasteRow.total_waste,
      detection_count: wasteRow.detection_count,
      session_count: costRow.session_count,
    };
  }

  close(): void {
    this.db.close();
  }
}
