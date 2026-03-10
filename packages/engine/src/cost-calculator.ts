import { getModelPricing, calculateCost } from '@clawwatch/shared';
import type { ModelPricingOverride } from '@clawwatch/shared';

export class CostCalculator {
  constructor(private overrides: Record<string, ModelPricingOverride>) {}

  calculate(modelId: string, inputTokens: number, outputTokens: number): number {
    const pricing = getModelPricing(modelId, this.overrides);
    if (!pricing) return 0;
    return calculateCost(inputTokens, outputTokens, pricing);
  }
}
