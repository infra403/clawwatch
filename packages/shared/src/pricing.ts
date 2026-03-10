import type { ModelPricingOverride } from './types.js';

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  /** P90 ratio of input_tokens / output_tokens observed in normal usage */
  p90_input_output_ratio?: number;
}

export const BUILTIN_PRICES: Record<string, ModelPricing> = {
  'claude-opus-4-6': { inputPer1M: 15.0, outputPer1M: 75.0, p90_input_output_ratio: 8 },
  'claude-sonnet-4-6': { inputPer1M: 3.0, outputPer1M: 15.0, p90_input_output_ratio: 8 },
  'claude-haiku-4-5': { inputPer1M: 0.8, outputPer1M: 4.0, p90_input_output_ratio: 6 },
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0, p90_input_output_ratio: 8 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6, p90_input_output_ratio: 6 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4, p90_input_output_ratio: 6 },
};

export function getModelPricing(
  modelId: string,
  overrides: Record<string, ModelPricingOverride> = {},
): ModelPricing | null {
  if (overrides[modelId]) {
    return overrides[modelId];
  }
  return BUILTIN_PRICES[modelId] ?? null;
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): number {
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}
