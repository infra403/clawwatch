import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { SessionCard } from '../components/SessionCard';
import type { Session } from '../components/SessionCard';
import { EfficiencyBadge } from '../components/EfficiencyBadge';

interface LLMCall {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  timestamp: string;
}

interface ToolCall {
  tool: string;
  duration_ms: number;
  success: boolean;
  timestamp: string;
}

interface SessionDetail {
  session: Session;
  llm_calls: LLMCall[];
  tool_calls: ToolCall[];
}

// Mock data
const mockSessions: Session[] = [
  {
    id: 'sess-a1b2c3d4-e5f6-7890',
    status: 'active',
    start_time: '3 min ago',
    total_cost: 0.0567,
    llm_calls: 12,
    tool_calls: 8,
    efficiency_score: 85,
  },
  {
    id: 'sess-f7e8d9c0-b1a2-3456',
    status: 'active',
    start_time: '15 min ago',
    total_cost: 0.1234,
    llm_calls: 28,
    tool_calls: 19,
    efficiency_score: 62,
  },
  {
    id: 'sess-11223344-5566-7788',
    status: 'completed',
    start_time: '1 hour ago',
    total_cost: 0.3456,
    llm_calls: 45,
    tool_calls: 32,
    efficiency_score: 91,
  },
  {
    id: 'sess-aabbccdd-eeff-0011',
    status: 'errored',
    start_time: '2 hours ago',
    total_cost: 0.0891,
    llm_calls: 15,
    tool_calls: 6,
    efficiency_score: 38,
  },
];

const mockDetail: SessionDetail = {
  session: mockSessions[0],
  llm_calls: [
    { model: 'claude-sonnet-4-20250514', prompt_tokens: 1200, completion_tokens: 350, cost: 0.0045, timestamp: '10:01:23' },
    { model: 'claude-sonnet-4-20250514', prompt_tokens: 1800, completion_tokens: 520, cost: 0.0067, timestamp: '10:01:28' },
    { model: 'claude-sonnet-4-20250514', prompt_tokens: 2100, completion_tokens: 180, cost: 0.0051, timestamp: '10:01:35' },
  ],
  tool_calls: [
    { tool: 'read_file', duration_ms: 45, success: true, timestamp: '10:01:25' },
    { tool: 'write_file', duration_ms: 120, success: true, timestamp: '10:01:30' },
    { tool: 'run_command', duration_ms: 3200, success: false, timestamp: '10:01:33' },
  ],
};

export function Sessions() {
  const { data: sessions } = useApi<Session[]>('/api/sessions?limit=50', 5000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sessionList = sessions ?? mockSessions;

  // Build the ReAct timeline by interleaving LLM and tool calls
  const detail = selectedId ? mockDetail : null;
  type TimelineEntry =
    | { kind: 'llm'; data: LLMCall }
    | { kind: 'tool'; data: ToolCall };

  const timeline: TimelineEntry[] = [];
  if (detail) {
    for (const c of detail.llm_calls) {
      timeline.push({ kind: 'llm', data: c });
    }
    for (const c of detail.tool_calls) {
      timeline.push({ kind: 'tool', data: c });
    }
    timeline.sort((a, b) => {
      const tsA = a.kind === 'llm' ? a.data.timestamp : a.data.timestamp;
      const tsB = b.kind === 'llm' ? b.data.timestamp : b.data.timestamp;
      return tsA.localeCompare(tsB);
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Sessions
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session list */}
        <div className="space-y-3">
          {sessionList.map((s, i) => (
            <div key={s.id} className={`animate-fade-in stagger-${i + 1}`}>
              <SessionCard
                session={s}
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
              />
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div>
          {selectedId && detail ? (
            <div
              className="rounded-xl border p-5 animate-fade-in"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono" style={{ color: 'var(--accent-amber)' }}>
                  {selectedId.slice(0, 16)}...
                </h3>
                <EfficiencyBadge score={detail.session.efficiency_score} />
              </div>

              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-secondary)' }}>
                ReAct Timeline
              </h4>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {timeline.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2.5 rounded-lg border text-xs"
                    style={{
                      backgroundColor: entry.kind === 'llm'
                        ? 'rgba(59,130,246,0.05)'
                        : 'rgba(16,185,129,0.05)',
                      borderColor: entry.kind === 'llm'
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(16,185,129,0.15)',
                    }}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded font-mono font-semibold uppercase flex-shrink-0"
                      style={{
                        color: entry.kind === 'llm' ? 'var(--accent-blue)' : 'var(--accent-green)',
                        backgroundColor: entry.kind === 'llm'
                          ? 'rgba(59,130,246,0.1)'
                          : 'rgba(16,185,129,0.1)',
                      }}
                    >
                      {entry.kind === 'llm' ? 'LLM' : 'TOOL'}
                    </span>
                    <div className="flex-1">
                      {entry.kind === 'llm' ? (
                        <>
                          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                            {(entry.data as LLMCall).model.slice(0, 20)}
                          </span>
                          <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>
                            {(entry.data as LLMCall).prompt_tokens}+{(entry.data as LLMCall).completion_tokens} tok
                          </span>
                          <span className="ml-2 font-mono" style={{ color: 'var(--accent-amber)' }}>
                            ${(entry.data as LLMCall).cost.toFixed(4)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                            {(entry.data as ToolCall).tool}
                          </span>
                          <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>
                            {(entry.data as ToolCall).duration_ms}ms
                          </span>
                          <span
                            className="ml-2"
                            style={{
                              color: (entry.data as ToolCall).success
                                ? 'var(--accent-green)'
                                : 'var(--accent-red)',
                            }}
                          >
                            {(entry.data as ToolCall).success ? 'ok' : 'fail'}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {entry.kind === 'llm'
                        ? (entry.data as LLMCall).timestamp
                        : (entry.data as ToolCall).timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border p-10 flex items-center justify-center"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <p className="text-sm">Select a session to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
