interface BudgetBarProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

export function BudgetBar({ label, current, limit, unit = '$' }: BudgetBarProps) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'var(--accent-red)' :
    pct >= 70 ? 'var(--accent-amber)' :
    'var(--accent-green)';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--text-secondary)' }}
        >
          {unit}{current.toFixed(2)} / {unit}{limit.toFixed(2)}
        </span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--border-subtle)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <p className="text-xs mt-1 text-right font-mono" style={{ color }}>
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}
