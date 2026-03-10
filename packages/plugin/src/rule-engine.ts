import type { Detection, DetectorType, DetectionSeverity } from '@clawwatch/shared';
import { randomUUID } from 'node:crypto';

/**
 * Per-session tracking state for the quick rule engine.
 */
interface SessionState {
  /** Recent consecutive tool calls: [toolName, argsHash] */
  recentCalls: Array<{ tool: string; hash: string; timestamp: number }>;
  /** Sliding window of tool call timestamps keyed by tool name */
  toolTimestamps: Map<string, number[]>;
}

/**
 * Lightweight in-plugin rule engine for immediate loop / abuse detection.
 * Runs synchronously and must complete in <1ms.
 */
export class QuickRuleEngine {
  private sessions = new Map<string, SessionState>();

  /** Consecutive identical calls threshold */
  private readonly loopThreshold = 3;
  /** Same-tool calls within window */
  private readonly abuseThreshold = 6;
  /** Abuse detection window in ms */
  private readonly abuseWindowMs = 60_000;

  /**
   * Record a tool call and check for immediate detections.
   * Returns a Detection if a rule fires, null otherwise.
   */
  recordToolCall(
    sessionId: string,
    toolName: string,
    argumentsHash: string,
  ): Detection | null {
    const state = this.getOrCreateSession(sessionId);
    const now = Date.now();

    // Push the new call
    state.recentCalls.push({ tool: toolName, hash: argumentsHash, timestamp: now });

    // Keep only the last N calls needed for loop detection
    if (state.recentCalls.length > this.loopThreshold) {
      state.recentCalls.shift();
    }

    // --- Rule 1: Consecutive identical calls (same tool + same hash) ---
    if (state.recentCalls.length >= this.loopThreshold) {
      const allSame = state.recentCalls.every(
        (c) => c.tool === toolName && c.hash === argumentsHash,
      );
      if (allSame) {
        return this.makeDetection(sessionId, 'loop_spinning', 'warning', {
          tool: toolName,
          arguments_hash: argumentsHash,
          consecutive_count: this.loopThreshold,
        });
      }
    }

    // --- Rule 2: Tool abuse (same tool >= 6 times in 60s) ---
    if (!state.toolTimestamps.has(toolName)) {
      state.toolTimestamps.set(toolName, []);
    }
    const timestamps = state.toolTimestamps.get(toolName)!;
    timestamps.push(now);

    // Prune timestamps outside the window
    const cutoff = now - this.abuseWindowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.abuseThreshold) {
      return this.makeDetection(sessionId, 'tool_abuse', 'warning', {
        tool: toolName,
        calls_in_window: timestamps.length,
        window_seconds: this.abuseWindowMs / 1000,
      });
    }

    return null;
  }

  /**
   * Clear state for a session (e.g. on session end).
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private getOrCreateSession(sessionId: string): SessionState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = { recentCalls: [], toolTimestamps: new Map() };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  private makeDetection(
    sessionId: string,
    type: DetectorType,
    severity: DetectionSeverity,
    evidence: Record<string, unknown>,
  ): Detection {
    return {
      id: randomUUID(),
      session_id: sessionId,
      timestamp: Date.now(),
      detector_type: type,
      severity,
      description: `Quick rule: ${type} detected for session ${sessionId}`,
      evidence,
    };
  }
}
