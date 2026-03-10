import { EfficiencyBadge } from './EfficiencyBadge';

interface Session {
  id: string;
  status: 'active' | 'completed' | 'errored';
  start_time: string;
  total_cost: number;
  llm_calls: number;
  tool_calls: number;
  efficiency_score: number;
}

interface SessionCardProps {
  session: Session;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  active: 'var(--accent-green)',
  completed: 'var(--accent-blue)',
  errored: 'var(--accent-red)',
};

export function SessionCard({ session, onClick }: SessionCardProps) {
  return (
    <div
      className="rounded-lg border p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: statusColors[session.status] ?? 'var(--text-secondary)',
              boxShadow: session.status === 'active' ? 'var(--glow-green)' : 'none',
            }}
          />
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {session.id.slice(0, 8)}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded uppercase font-medium"
            style={{
              color: statusColors[session.status],
              backgroundColor: `${statusColors[session.status]}15`,
            }}
          >
            {session.status}
          </span>
        </div>
        <EfficiencyBadge score={session.efficiency_score} />
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <p style={{ color: 'var(--text-secondary)' }}>Cost</p>
          <p className="font-mono font-semibold" style={{ color: 'var(--accent-amber)' }}>
            ${session.total_cost.toFixed(4)}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-secondary)' }}>LLM Calls</p>
          <p className="font-mono font-semibold">{session.llm_calls}</p>
        </div>
        <div>
          <p style={{ color: 'var(--text-secondary)' }}>Tool Calls</p>
          <p className="font-mono font-semibold">{session.tool_calls}</p>
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
        Started {session.start_time}
      </p>
    </div>
  );
}

export type { Session };
