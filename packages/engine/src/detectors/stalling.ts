import { v4 as uuidv4 } from 'uuid';
import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface StallingConfig {
  timeout_seconds: number;
}

export class StallingDetector implements Detector {
  readonly name = 'stalling' as const;
  readonly type = 'rule' as const;
  readonly defaultEnabled = true;

  constructor(private config: StallingConfig) {}

  analyze(event: PluginEvent, context: SessionContext): Detection | null {
    const gapMs = event.timestamp - context.last_event_timestamp;
    const timeoutMs = this.config.timeout_seconds * 1000;

    if (gapMs <= timeoutMs) return null;

    const gapSeconds = gapMs / 1000;
    const severity = gapSeconds > 60 ? 'critical' : 'warning';

    return {
      id: uuidv4(),
      session_id: context.session_id,
      timestamp: event.timestamp,
      detector_type: 'stalling',
      severity,
      description: `No activity for ${gapSeconds.toFixed(1)}s (threshold: ${this.config.timeout_seconds}s)`,
      evidence: {
        gap_ms: gapMs,
        gap_seconds: gapSeconds,
        timeout_seconds: this.config.timeout_seconds,
        last_event_timestamp: context.last_event_timestamp,
      },
    };
  }
}
