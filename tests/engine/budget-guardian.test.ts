import { describe, it, expect } from 'vitest';
import { BudgetGuardian, type BudgetAlert } from '../../packages/engine/src/budget-guardian.js';
import type { BudgetConfig } from '../../packages/shared/src/types.js';

describe('BudgetGuardian', () => {
  const config: BudgetConfig = {
    dailyLimitUsd: 20,
    sessionLimitUsd: 5,
    alertThreshold: 0.8,
  };

  it('returns no alerts when under threshold', () => {
    const guardian = new BudgetGuardian(config);
    const alerts = guardian.check({
      sessionSpend: 1,
      dailySpend: 5,
    });
    expect(alerts).toEqual([]);
  });

  it('returns warning when session spend hits alert threshold', () => {
    const guardian = new BudgetGuardian(config);
    // 80% of 5 = 4
    const alerts = guardian.check({
      sessionSpend: 4.1,
      dailySpend: 0,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warning');
    expect(alerts[0].scope).toBe('session');
  });

  it('returns exceeded alert when session spend hits limit', () => {
    const guardian = new BudgetGuardian(config);
    const alerts = guardian.check({
      sessionSpend: 5.5,
      dailySpend: 0,
    });
    const exceeded = alerts.find((a) => a.level === 'exceeded');
    expect(exceeded).toBeDefined();
    expect(exceeded!.scope).toBe('session');
  });

  it('returns warning when daily spend hits alert threshold', () => {
    const guardian = new BudgetGuardian(config);
    // 80% of 20 = 16
    const alerts = guardian.check({
      sessionSpend: 0,
      dailySpend: 16.5,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warning');
    expect(alerts[0].scope).toBe('daily');
  });

  it('returns exceeded alert when daily spend hits limit', () => {
    const guardian = new BudgetGuardian(config);
    const alerts = guardian.check({
      sessionSpend: 0,
      dailySpend: 21,
    });
    const exceeded = alerts.find((a) => a.level === 'exceeded');
    expect(exceeded).toBeDefined();
    expect(exceeded!.scope).toBe('daily');
  });

  it('returns multiple alerts when both scopes triggered', () => {
    const guardian = new BudgetGuardian(config);
    const alerts = guardian.check({
      sessionSpend: 6,
      dailySpend: 22,
    });
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });

  it('handles zero limits gracefully', () => {
    const guardian = new BudgetGuardian({
      dailyLimitUsd: 0,
      sessionLimitUsd: 0,
      alertThreshold: 0.8,
    });
    const alerts = guardian.check({
      sessionSpend: 1,
      dailySpend: 1,
    });
    // With 0 limits, any spend exceeds
    const exceeded = alerts.filter((a) => a.level === 'exceeded');
    expect(exceeded).toHaveLength(2);
  });
});
