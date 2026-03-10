import { describe, it, expect } from 'vitest';
import {
  getModelPricing,
  calculateCost,
  BUILTIN_PRICES,
} from '../../packages/shared/src/pricing.js';

describe('getModelPricing', () => {
  it('returns exact match from builtin table', () => {
    const pricing = getModelPricing('claude-sonnet-4-6');
    expect(pricing).toEqual(BUILTIN_PRICES['claude-sonnet-4-6']);
  });

  it('returns override when provided', () => {
    const override = { inputPer1M: 1.0, outputPer1M: 2.0 };
    const pricing = getModelPricing('claude-sonnet-4-6', { 'claude-sonnet-4-6': override });
    expect(pricing).toEqual(override);
  });

  it('returns null for unknown model', () => {
    const pricing = getModelPricing('unknown-model-xyz');
    expect(pricing).toBeNull();
  });
});

describe('calculateCost', () => {
  it('correctly calculates cost for known token counts', () => {
    const pricing = { inputPer1M: 3.0, outputPer1M: 15.0 };
    // 1M input tokens + 500k output tokens
    const cost = calculateCost(1_000_000, 500_000, pricing);
    expect(cost).toBeCloseTo(3.0 + 7.5, 6);
  });

  it('returns 0 for zero tokens', () => {
    const pricing = { inputPer1M: 3.0, outputPer1M: 15.0 };
    expect(calculateCost(0, 0, pricing)).toBe(0);
  });

  it('correctly calculates cost for claude-opus-4-6 pricing', () => {
    const pricing = BUILTIN_PRICES['claude-opus-4-6'];
    // 100k input + 50k output
    const cost = calculateCost(100_000, 50_000, pricing);
    const expected = (100_000 / 1_000_000) * 15.0 + (50_000 / 1_000_000) * 75.0;
    expect(cost).toBeCloseTo(expected, 8);
  });
});
