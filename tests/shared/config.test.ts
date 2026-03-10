import { describe, it, expect } from 'vitest';
import { loadConfig, DEFAULT_CONFIG, deepMerge } from '../../packages/shared/src/config.js';

describe('loadConfig', () => {
  it('returns defaults for a nonexistent file', () => {
    const config = loadConfig('/tmp/__clawwatch_nonexistent_config_xyz.json');
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('merges partial overrides preserving defaults', () => {
    // deepMerge is the mechanism loadConfig uses — test it directly
    const partial = {
      dashboardPort: 9999,
      budget: {
        dailyLimitUsd: 100,
      },
    };
    const merged = deepMerge(DEFAULT_CONFIG, partial as typeof DEFAULT_CONFIG);

    expect(merged.dashboardPort).toBe(9999);
    expect(merged.budget.dailyLimitUsd).toBe(100);
    // Unchanged budget fields are preserved
    expect(merged.budget.sessionLimitUsd).toBe(DEFAULT_CONFIG.budget.sessionLimitUsd);
    expect(merged.budget.alertThreshold).toBe(DEFAULT_CONFIG.budget.alertThreshold);
    // Unrelated top-level keys are preserved
    expect(merged.detectors).toEqual(DEFAULT_CONFIG.detectors);
  });
});
