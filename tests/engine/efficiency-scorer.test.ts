import { describe, it, expect } from 'vitest';
import { calculateEfficiency } from '../../packages/engine/src/efficiency-scorer.js';

describe('calculateEfficiency', () => {
  it('returns 100 for zero waste', () => {
    expect(calculateEfficiency(1000, 1000, [])).toBe(100);
  });

  it('returns 100 for zero total tokens', () => {
    expect(calculateEfficiency(0, 0, [])).toBe(100);
  });

  it('deducts for wasted tokens and detections', () => {
    const score = calculateEfficiency(1000, 800, [
      { severity: 'warning', count: 1 },
    ]);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
    // base = 80, penalty = 5*1 = 5, result = 75
    expect(score).toBe(75);
  });

  it('clamps to 0 minimum', () => {
    const score = calculateEfficiency(1000, 100, [
      { severity: 'critical', count: 20 },
    ]);
    expect(score).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    // Even with perfect tokens, no detections
    const score = calculateEfficiency(500, 500, []);
    expect(score).toBe(100);
  });

  it('applies multiple detection penalties', () => {
    const score = calculateEfficiency(1000, 1000, [
      { severity: 'critical', count: 2 },
      { severity: 'warning', count: 3 },
      { severity: 'info', count: 1 },
    ]);
    // base = 100, penalty = 10*2 + 5*3 + 2*1 = 20 + 15 + 2 = 37, result = 63
    expect(score).toBe(63);
  });
});
