import { v4 as uuidv4 } from 'uuid';
import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface ToolAbuseConfig {
  max_calls_per_minute: number;
}

export class ToolAbuseDetector implements Detector {
  readonly name = 'tool_abuse' as const;
  readonly type = 'rule' as const;
  readonly defaultEnabled = true;

  constructor(private config: ToolAbuseConfig) {}

  analyze(event: PluginEvent, context: SessionContext): Detection | null {
    if (event.type !== 'tool_call') return null;

    const { tool_name, timestamp } = event as {
      type: 'tool_call';
      tool_name: string;
      timestamp: number;
    };

    const windowMs = 60 * 1000;
    const cutoff = timestamp - windowMs;

    const recentSameTool = context.recent_tool_calls.filter(
      (c) => c.tool_name === tool_name && c.timestamp >= cutoff,
    );

    // +1 to include current event
    const count = recentSameTool.length + 1;

    if (count <= this.config.max_calls_per_minute) return null;

    const severity = count > 10 ? 'critical' : 'info';

    return {
      id: uuidv4(),
      session_id: context.session_id,
      timestamp,
      detector_type: 'tool_abuse',
      severity,
      description: `Tool "${tool_name}" called ${count} times in the last 60s (limit: ${this.config.max_calls_per_minute}/min)`,
      evidence: {
        tool_name,
        call_count: count,
        max_calls_per_minute: this.config.max_calls_per_minute,
        window_seconds: 60,
      },
    };
  }
}
