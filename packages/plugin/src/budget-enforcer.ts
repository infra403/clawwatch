import type { BudgetExceededCommand } from '@clawwatch/shared';

/**
 * Budget enforcer that tracks whether the Engine has signaled budget exceeded.
 * Used by the `before_model_resolve` hook to soft-block further LLM calls.
 */
export class BudgetEnforcer {
  private exceededSessions = new Map<string, BudgetExceededCommand>();

  /**
   * Called when the Engine sends a budget_exceeded command.
   */
  markExceeded(command: BudgetExceededCommand): void {
    this.exceededSessions.set(command.sessionId, command);
  }

  /**
   * Called by the user to override the soft block for a session.
   */
  override(sessionId: string): void {
    this.exceededSessions.delete(sessionId);
  }

  /**
   * Check whether a session's budget has been exceeded.
   * Returns the command details if exceeded, null otherwise.
   */
  check(sessionId: string): BudgetExceededCommand | null {
    return this.exceededSessions.get(sessionId) ?? null;
  }

  /**
   * Clear state for a session (e.g. on session end).
   */
  clearSession(sessionId: string): void {
    this.exceededSessions.delete(sessionId);
  }
}
