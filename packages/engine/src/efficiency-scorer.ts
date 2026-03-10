const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 10,
  warning: 5,
  info: 2,
};

export function calculateEfficiency(
  totalTokens: number,
  effectiveTokens: number,
  detections: { severity: string; count: number }[],
): number {
  if (totalTokens === 0) return 100;
  const baseScore = (effectiveTokens / totalTokens) * 100;
  const penalty = detections.reduce(
    (sum, d) => sum + (SEVERITY_WEIGHTS[d.severity] ?? 0) * d.count,
    0,
  );
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
}
