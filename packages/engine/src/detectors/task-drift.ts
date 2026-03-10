import type {
  Detector,
  Detection,
  PluginEvent,
  SessionContext,
} from '@clawwatch/shared';

export interface TaskDriftConfig {
  similarity_threshold: number;
}

/**
 * TaskDriftDetector — Phase 1 stub.
 *
 * This detector is intended to catch cases where the agent drifts away from
 * the user's original task by comparing ongoing tool/LLM activity against the
 * initial prompt using semantic similarity. It requires an embedding model or
 * NLP pipeline that is not yet integrated.
 *
 * Always returns null until the similarity-comparison pipeline is wired up in
 * a future phase.
 */
export class TaskDriftDetector implements Detector {
  readonly name = 'task_drift' as const;
  readonly type = 'heuristic' as const;
  readonly defaultEnabled = false;

  constructor(private _config: TaskDriftConfig) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  analyze(_event: PluginEvent, _context: SessionContext): Detection | null {
    // Phase 1 stub — not yet implemented.
    return null;
  }
}
