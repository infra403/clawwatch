interface EfficiencyBadgeProps {
  score: number; // 0-100
}

export function EfficiencyBadge({ score }: EfficiencyBadgeProps) {
  const color =
    score >= 80 ? 'var(--accent-green)' :
    score >= 50 ? 'var(--accent-amber)' :
    'var(--accent-red)';

  const glow =
    score >= 80 ? 'var(--glow-green)' :
    score >= 50 ? 'var(--glow-amber)' :
    'var(--glow-red)';

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{
        color,
        backgroundColor: `${color}15`,
        boxShadow: glow,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {score}%
    </span>
  );
}
