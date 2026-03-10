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
    enabled: true,
    spinLoopThreshold: 5,
    toolThrashThreshold: 10,
    costSpikeMultiplier: 3,
    contextBloatThreshold: 150000,
    runawaySessionMinutes: 60,
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
