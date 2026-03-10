import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../../packages/engine/src/cost-calculator.js';

describe('CostCalculator', () => {
  const calc = new CostCalculator({});

  it('calculates cost for known model', () => {
    const cost = calc.calculate('claude-opus-4-6', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    // 1K input * 15.0/1M + 0.5K output * 75.0/1M = 0.015 + 0.0375 = 0.0525
    expect(cost).toBeCloseTo(0.0525);
  });

  it('returns 0 for unknown model', () => {
    expect(calc.calculate('unknown', 1000, 500)).toBe(0);
  });

  it('uses pricing overrides when provided', () => {
    const custom = new CostCalculator({
      'my-model': { inputPer1M: 10, outputPer1M: 20 },
    });
    // 1000/1M * 10 + 500/1M * 20 = 0.01 + 0.01 = 0.02
    expect(custom.calculate('my-model', 1000, 500)).toBeCloseTo(0.02);
  });

  it('returns 0 for zero tokens', () => {
    expect(calc.calculate('claude-opus-4-6', 0, 0)).toBe(0);
  });
});
