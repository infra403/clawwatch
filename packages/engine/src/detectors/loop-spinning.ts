import { v4 as uuidv4 } from 'uuid';
import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface LoopSpinningConfig {
  window_seconds: number;
  min_repeats: number;
}

export class LoopSpinningDetector implements Detector {
  readonly name = 'loop_spinning' as const;
  readonly type = 'rule' as const;
  readonly defaultEnabled = true;

  constructor(private config: LoopSpinningConfig) {}

  analyze(event: PluginEvent, context: SessionContext): Detection | null {
    if (event.type !== 'tool_call') return null;

    const { tool_name, arguments_hash, timestamp } = event as {
      type: 'tool_call';
      tool_name: string;
      arguments_hash: string;
      timestamp: number;
    };

    const windowMs = this.config.window_seconds * 1000;
    const cutoff = timestamp - windowMs;

    // Count matching calls in window from recent history
    const matchingInWindow = context.recent_tool_calls.filter(
      (c) =>
        c.tool_name === tool_name &&
        c.arguments_hash === arguments_hash &&
        c.timestamp >= cutoff,
    );

    // +1 to include current event
    const count = matchingInWindow.length + 1;

    if (count < this.config.min_repeats) return null;

    const severity = count >= 5 ? 'critical' : 'warning';

    return {
      id: uuidv4(),
      session_id: context.session_id,
      timestamp: event.timestamp,
      detector_type: 'loop_spinning',
      severity,
      description: `Tool "${tool_name}" called ${count} times with identical arguments within ${this.config.window_seconds}s window`,
      evidence: {
        tool_name,
        arguments_hash,
        repeat_count: count,
        window_seconds: this.config.window_seconds,
      },
    };
  }
}
