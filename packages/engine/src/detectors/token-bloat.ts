import { v4 as uuidv4 } from 'uuid';
import { getModelPricing } from '@clawwatch/shared';
import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface TokenBloatConfig {
  ratio_multiplier: number;
}

export class TokenBloatDetector implements Detector {
  readonly name = 'token_bloat' as const;
  readonly type = 'heuristic' as const;
  readonly defaultEnabled = true;

  constructor(private config: TokenBloatConfig) {}

  analyze(event: PluginEvent, context: SessionContext): Detection | null {
    if (event.type !== 'llm_call') return null;

    const { input_tokens, output_tokens, model_id, timestamp } = event as {
      type: 'llm_call';
      input_tokens: number;
      output_tokens: number;
      model_id: string;
      timestamp: number;
    };

    const baseline = getModelPricing(model_id ?? context.model_id);
    if (!baseline) return null;

    const p90 = baseline.p90_input_output_ratio ?? 8;
    const ratio = input_tokens / Math.max(output_tokens, 1);
    const threshold = p90 * this.config.ratio_multiplier;

    if (ratio <= threshold) return null;

    const severity = ratio > p90 * 3 ? 'critical' : 'warning';

    return {
      id: uuidv4(),
      session_id: context.session_id,
      timestamp,
      detector_type: 'token_bloat',
      severity,
      description: `Token ratio ${ratio.toFixed(1)} exceeds ${threshold.toFixed(1)} (baseline p90: ${p90}, multiplier: ${this.config.ratio_multiplier})`,
      evidence: {
        input_tokens,
        output_tokens,
        ratio,
        threshold,
        p90_baseline: p90,
        model_id: model_id ?? context.model_id,
      },
    };
  }
}
