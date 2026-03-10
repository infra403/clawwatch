interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'amber' | 'red' | 'green' | 'blue';
}

const colorMap = {
  amber: { text: 'var(--accent-amber)', glow: 'var(--glow-amber)' },
  red: { text: 'var(--accent-red)', glow: 'var(--glow-red)' },
  green: { text: 'var(--accent-green)', glow: 'var(--glow-green)' },
  blue: { text: 'var(--accent-blue)', glow: 'none' },
};

export function KpiCard({ title, value, subtitle, color = 'amber' }: KpiCardProps) {
  const c = colorMap[color];

  return (
    <div
      className="rounded-xl p-5 border transition-all duration-200 hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        boxShadow: c.glow,
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      <p
        className="text-3xl font-bold"
        style={{ color: c.text, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
