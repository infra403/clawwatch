interface Detection {
  id: string;
  detector: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  waste_cost: number;
  timestamp: string;
}

interface DetectionItemProps {
  detection: Detection;
}

const severityStyles: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'rgba(59,130,246,0.1)', text: 'var(--accent-blue)', border: 'rgba(59,130,246,0.3)' },
  medium: { bg: 'rgba(245,158,11,0.1)', text: 'var(--accent-amber)', border: 'rgba(245,158,11,0.3)' },
  high: { bg: 'rgba(239,68,68,0.1)', text: 'var(--accent-red)', border: 'rgba(239,68,68,0.3)' },
  critical: { bg: 'rgba(239,68,68,0.2)', text: 'var(--accent-red)', border: 'rgba(239,68,68,0.5)' },
};

export function DetectionItem({ detection }: DetectionItemProps) {
  const style = severityStyles[detection.severity] ?? severityStyles.low;

  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3 border transition-colors duration-150"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Severity badge */}
      <span
        className="px-2 py-0.5 rounded text-xs font-semibold uppercase flex-shrink-0 mt-0.5"
        style={{
          backgroundColor: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {detection.severity}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono" style={{ color: 'var(--accent-amber)' }}>
            {detection.detector}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {detection.timestamp}
          </span>
        </div>
        <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
          {detection.message}
        </p>
      </div>

      <span
        className="text-xs font-mono flex-shrink-0"
        style={{ color: 'var(--accent-red)' }}
      >
        -${detection.waste_cost.toFixed(4)}
      </span>
    </div>
  );
}

export type { Detection };
