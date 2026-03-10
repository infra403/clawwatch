import type { Detector, ClawWatchConfig } from '@clawwatch/shared';
import { LoopSpinningDetector } from './loop-spinning.js';
import { TokenBloatDetector } from './token-bloat.js';
import { StallingDetector } from './stalling.js';
import { ToolAbuseDetector } from './tool-abuse.js';
import { TaskDriftDetector } from './task-drift.js';
import { ModelMismatchDetector } from './model-mismatch.js';

export function createDetectors(config: ClawWatchConfig): Detector[] {
  const d = config.detectors;
  const detectors: Detector[] = [];
  if (d.loop_spinning.enabled) detectors.push(new LoopSpinningDetector(d.loop_spinning as any));
  if (d.token_bloat.enabled) detectors.push(new TokenBloatDetector(d.token_bloat as any));
  if (d.stalling.enabled) detectors.push(new StallingDetector(d.stalling as any));
  if (d.tool_abuse.enabled) detectors.push(new ToolAbuseDetector(d.tool_abuse as any));
  if (d.task_drift.enabled) detectors.push(new TaskDriftDetector(d.task_drift as any));
  if (d.model_mismatch.enabled) detectors.push(new ModelMismatchDetector(d.model_mismatch as any));
  return detectors;
}

export {
  LoopSpinningDetector,
  TokenBloatDetector,
  StallingDetector,
  ToolAbuseDetector,
  TaskDriftDetector,
  ModelMismatchDetector,
};
