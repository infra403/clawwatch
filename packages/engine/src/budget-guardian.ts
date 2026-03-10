import type { BudgetConfig } from '@clawwatch/shared';

export interface BudgetAlert {
  level: 'warning' | 'exceeded';
  scope: 'session' | 'daily';
  limitUsd: number;
  currentUsd: number;
  percentUsed: number;
}

export interface SpendSnapshot {
  sessionSpend: number;
  dailySpend: number;
}

export class BudgetGuardian {
  constructor(private config: BudgetConfig) {}

  check(spend: SpendSnapshot): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    this.checkScope(
      'session',
      spend.sessionSpend,
      this.config.sessionLimitUsd,
      alerts,
    );
    this.checkScope(
      'daily',
      spend.dailySpend,
      this.config.dailyLimitUsd,
      alerts,
    );

    return alerts;
  }

  private checkScope(
    scope: 'session' | 'daily',
    current: number,
    limit: number,
    alerts: BudgetAlert[],
  ): void {
    if (limit <= 0) {
      // Zero or negative limit: any positive spend is exceeded
      if (current > 0) {
        alerts.push({
          level: 'exceeded',
          scope,
          limitUsd: limit,
          currentUsd: current,
          percentUsed: 100,
        });
      }
      return;
    }

    const percentUsed = (current / limit) * 100;

    if (current >= limit) {
      alerts.push({
        level: 'exceeded',
        scope,
        limitUsd: limit,
        currentUsd: current,
        percentUsed,
      });
    } else if (current >= limit * this.config.alertThreshold) {
      alerts.push({
        level: 'warning',
        scope,
        limitUsd: limit,
        currentUsd: current,
        percentUsed,
      });
    }
  }
}
