import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface ModelMismatchConfig {
  cost_complexity_ratio: number;
}

/**
 * ModelMismatchDetector — Phase 1 stub.
 *
 * This detector is intended to flag cases where an expensive model is being
 * used for a task whose complexity doesn't warrant the cost (e.g., using
 * claude-opus for trivial one-liners). Implementing it requires a task
 * complexity scoring system that is not yet available.
 *
 * Always returns null until the complexity-scoring pipeline is wired up in
 * a future phase.
 */
export class ModelMismatchDetector implements Detector {
  readonly name = 'model_mismatch' as const;
  readonly type = 'heuristic' as const;
  readonly defaultEnabled = false;

  constructor(private _config: ModelMismatchConfig) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  analyze(_event: PluginEvent, _context: SessionContext): Detection | null {
    // Phase 1 stub — not yet implemented.
    return null;
  }
}
