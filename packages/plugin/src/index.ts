// Re-export for direct usage
export { ClawWatchPlugin } from './plugin.js';
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
 * OpenClaw plugin definition.
 *
 * Exports a default object with `register(api)` that wires ClawWatch hooks
 * into the OpenClaw lifecycle: session_start, before_tool_call, after_tool_call,
 * session_end, and message_received.
 */
const plugin = {
  id: 'clawwatch',
  name: 'ClawWatch',
  description: 'AI Agent efficiency monitor',
  version: '0.1.0',

  register(api: any) {
    // Dynamic import to keep top-level clean (ESM)
    const instancePromise = import('./plugin.js').then(
      ({ ClawWatchPlugin }) => new ClawWatchPlugin(),
    );

    let instance: Awaited<typeof instancePromise> | null = null;

    // Eagerly resolve — plugin.ts is in the same bundle so this is essentially sync
    void instancePromise.then((i) => {
      instance = i;
    });

    // Register as service (manages Engine lifecycle)
    api.registerService({
      id: 'clawwatch-engine',
      start: async () => {
        instance = await instancePromise;
        instance.activate();
        api.logger?.info?.('ClawWatch activated — monitoring agent efficiency');
      },
      stop: async () => {
        instance?.deactivate();
        api.logger?.info?.('ClawWatch deactivated');
      },
    });

    // Session start
    api.on('session_start', (event: any, ctx: any) => {
      instance?.onMessage({
        sessionId: ctx.sessionId ?? event.sessionId,
        modelId: 'unknown', // resolved on first LLM call
        provider: 'unknown',
        content: '',
        isFirst: true,
      });
    });

    // Message received — capture initial prompt for task drift baseline
    api.on('message_received', (_event: any, _ctx: any) => {
      // The first message_received in a session carries the user's prompt.
      // Future: store it for task drift baseline analysis.
    });

    // Before tool call — quick rule engine check + budget gate
    api.on('before_tool_call', (event: any, ctx: any) => {
      if (!instance) return;

      const detection = instance.onToolArg({
        sessionId: ctx.sessionKey ?? '',
        toolName: event.toolName,
        args: event.params,
      });

      // Budget check
      const budgetBlock = instance.beforeModelResolve(ctx.sessionKey ?? '');
      if (budgetBlock) {
        return { block: true, blockReason: budgetBlock };
      }

      if (detection) {
        return { block: false }; // Don't block, just record
      }
    });

    // After tool call — capture result and forward
    api.on('after_tool_call', (event: any, ctx: any) => {
      instance?.onToolResult({
        sessionId: ctx.sessionKey ?? '',
        toolName: event.toolName,
        args: event.params,
        resultSummary:
          typeof event.result === 'string'
            ? event.result.slice(0, 200)
            : JSON.stringify(event.result).slice(0, 200),
        durationMs: event.durationMs ?? 0,
      });
    });

    // Session end
    api.on('session_end', (event: any, ctx: any) => {
      instance?.onSessionEnd(ctx.sessionId ?? event.sessionId);
    });
  },
};

export default plugin;
