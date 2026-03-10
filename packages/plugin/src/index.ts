import type { EngineCommand, Detection } from '@clawwatch/shared';
import { SocketClient } from './socket-client.js';
import { QuickRuleEngine } from './rule-engine.js';
import { BudgetEnforcer } from './budget-enforcer.js';
import {
  makeSessionStartEvent,
  makeSessionEndEvent,
  makeToolCallEvent,
  makeLlmCallEvent,
  hashArguments,
} from './interceptors.js';

export { SocketClient } from './socket-client.js';
export { QuickRuleEngine } from './rule-engine.js';
export { BudgetEnforcer } from './budget-enforcer.js';
export {
  makeSessionStartEvent,
  makeSessionEndEvent,
  makeToolCallEvent,
  makeLlmCallEvent,
  hashArguments,
} from './interceptors.js';

/**
 * Main plugin class that OpenClaw would instantiate and call.
 *
 * Lifecycle:
 *   const plugin = new ClawWatchPlugin();
 *   await plugin.activate();
 *   // ... interceptors fire ...
 *   await plugin.deactivate();
 */
export class ClawWatchPlugin {
  readonly socketClient: SocketClient;
  readonly ruleEngine: QuickRuleEngine;
  readonly budgetEnforcer: BudgetEnforcer;

  private detectionCallback: ((detection: Detection) => void) | null = null;

  constructor(socketPath?: string) {
    this.socketClient = new SocketClient(socketPath);
    this.ruleEngine = new QuickRuleEngine();
    this.budgetEnforcer = new BudgetEnforcer();
  }

  /**
   * Register a callback that fires whenever a detection is produced
   * (either from the in-plugin rule engine or from the Engine).
   */
  onDetection(cb: (detection: Detection) => void): void {
    this.detectionCallback = cb;
  }

  /**
   * Start the plugin: connect socket and wire up command handling.
   */
  activate(): void {
    this.socketClient.onCommand((cmd: EngineCommand) => {
      this.handleCommand(cmd);
    });
    this.socketClient.connect();
  }

  /**
   * Stop the plugin: disconnect socket and clean up.
   */
  deactivate(): void {
    this.socketClient.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Interceptor callbacks — OpenClaw would wire these into its hook system
  // ---------------------------------------------------------------------------

  /**
   * Message interceptor: fires when a new user message arrives.
   * Marks session start if needed.
   */
  onMessage(msg: {
    sessionId: string;
    modelId: string;
    provider: string;
    content: string;
    isFirst?: boolean;
  }): void {
    if (msg.isFirst) {
      const event = makeSessionStartEvent({
        sessionId: msg.sessionId,
        modelId: msg.modelId,
        provider: msg.provider,
        initialPrompt: msg.content,
      });
      this.socketClient.send(event as unknown as Record<string, unknown>);
    }
  }

  /**
   * Tool argument interceptor: fires before tool execution.
   * Runs quick rule engine check and forwards event.
   */
  onToolArg(data: {
    sessionId: string;
    toolName: string;
    args: unknown;
  }): Detection | null {
    const argsHash = hashArguments(data.args);
    const detection = this.ruleEngine.recordToolCall(
      data.sessionId,
      data.toolName,
      argsHash,
    );
    if (detection) {
      this.socketClient.send(detection as unknown as Record<string, unknown>);
      this.detectionCallback?.(detection);
    }
    return detection;
  }

  /**
   * Tool result interceptor: fires after tool execution.
   * Forwards tool call event to Engine.
   */
  onToolResult(data: {
    sessionId: string;
    toolName: string;
    args: unknown;
    resultSummary: string;
    durationMs: number;
  }): void {
    const event = makeToolCallEvent({
      sessionId: data.sessionId,
      toolName: data.toolName,
      args: data.args,
      resultSummary: data.resultSummary,
      durationMs: data.durationMs,
    });
    this.socketClient.send(event as unknown as Record<string, unknown>);
  }

  /**
   * LLM call result interceptor: fires after an LLM response.
   */
  onLlmResult(data: {
    sessionId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  }): void {
    const event = makeLlmCallEvent(data);
    this.socketClient.send(event as unknown as Record<string, unknown>);
  }

  /**
   * Session end interceptor.
   */
  onSessionEnd(sessionId: string): void {
    const event = makeSessionEndEvent(sessionId);
    this.socketClient.send(event as unknown as Record<string, unknown>);
    this.ruleEngine.clearSession(sessionId);
    this.budgetEnforcer.clearSession(sessionId);
  }

  /**
   * before_model_resolve hook — returns a rejection message if budget exceeded,
   * or null to allow the call to proceed.
   */
  beforeModelResolve(sessionId: string): string | null {
    const exceeded = this.budgetEnforcer.check(sessionId);
    if (exceeded) {
      return `Budget exceeded for session ${sessionId}: spent $${exceeded.spent.toFixed(2)} of $${exceeded.budget.toFixed(2)} limit. Override with budgetEnforcer.override().`;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private handleCommand(cmd: EngineCommand): void {
    switch (cmd.type) {
      case 'budget_exceeded':
        this.budgetEnforcer.markExceeded(cmd);
        break;
      case 'detection_alert':
        this.detectionCallback?.(cmd.detection);
        break;
    }
  }
}
