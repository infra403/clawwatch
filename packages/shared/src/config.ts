import { readFileSync, watchFile } from 'node:fs';
import { DEFAULT_DASHBOARD_PORT } from './constants.js';
import type { ClawWatchConfig } from './types.js';

export const DEFAULT_CONFIG: ClawWatchConfig = {
  dashboardPort: DEFAULT_DASHBOARD_PORT,
  budget: {
    dailyLimitUsd: 20,
    sessionLimitUsd: 5,
    alertThreshold: 0.8,
  },
  detectors: {
    loop_spinning: { enabled: true, window_seconds: 60, min_repeats: 3 },
    token_bloat: { enabled: true, ratio_multiplier: 2 },
    stalling: { enabled: true, timeout_seconds: 30 },
    tool_abuse: { enabled: true, max_calls_per_minute: 5 },
    task_drift: { enabled: true, similarity_threshold: 0.3 },
    model_mismatch: { enabled: true, cost_complexity_ratio: 10 },
  },
  pricingOverrides: {},
};

export function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base } as T;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideVal = override[key];
    const baseVal = base[key];
    if (
      overrideVal !== undefined &&
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal as object, overrideVal as object) as T[keyof T];
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[keyof T];
    }
  }
  return result;
}

export function loadConfig(configPath: string): ClawWatchConfig {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const partial = JSON.parse(raw) as Partial<ClawWatchConfig>;
    return deepMerge(DEFAULT_CONFIG, partial);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function watchConfig(
  configPath: string,
  onChange: (config: ClawWatchConfig) => void,
): () => void {
  const listener = () => {
    const config = loadConfig(configPath);
    onChange(config);
  };
  watchFile(configPath, { interval: 1000 }, listener);
  return () => {
    // Node's watchFile doesn't expose an easy stop via the listener ref,
    // so we unwatchFile with the listener.
    import('node:fs').then(({ unwatchFile }) => unwatchFile(configPath, listener));
  };
}
