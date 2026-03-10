import { useApi } from '../hooks/useApi';
import { KpiCard } from '../components/KpiCard';
import { CostChart } from '../components/CostChart';
import { DetectionItem } from '../components/DetectionItem';
import type { Detection } from '../components/DetectionItem';
import { SessionCard } from '../components/SessionCard';
import type { Session } from '../components/SessionCard';

interface OverviewData {
  total_cost: number;
  total_waste: number;
  detection_count: number;
  session_count: number;
  active_sessions: number;
}

// Mock data for development
const mockOverview: OverviewData = {
  total_cost: 1.2345,
  total_waste: 0.0891,
  detection_count: 23,
  session_count: 7,
  active_sessions: 2,
};

const mockDetections: Detection[] = [
  {
    id: 'd1',
    detector: 'rapid-fire',
    severity: 'high',
    message: 'Rapid sequential LLM calls detected (8 calls in 3s)',
    waste_cost: 0.0234,
    timestamp: '2 min ago',
  },
  {
    id: 'd2',
    detector: 'yoyo',
    severity: 'medium',
    message: 'Yoyo pattern: repeated read/write cycle on config.json',
    waste_cost: 0.0089,
    timestamp: '5 min ago',
  },
  {
    id: 'd3',
    detector: 'wall-stare',
    severity: 'low',
    message: 'Same error repeated 3 times without strategy change',
    waste_cost: 0.0045,
    timestamp: '12 min ago',
  },
];

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
];

export function Overview() {
  const { data: overview } = useApi<OverviewData>('/api/overview', 5000);
  const d = overview ?? mockOverview;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Overview
      </h2>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="animate-fade-in stagger-1">
          <KpiCard
            title="Total Cost"
            value={`$${d.total_cost.toFixed(4)}`}
            subtitle="all sessions"
            color="blue"
          />
        </div>
        <div className="animate-fade-in stagger-2">
          <KpiCard
            title="Waste Detected"
            value={`$${d.total_waste.toFixed(4)}`}
            subtitle="potential savings"
            color="red"
          />
        </div>
        <div className="animate-fade-in stagger-3">
          <KpiCard
            title="Detections"
            value={d.detection_count}
            subtitle="across all detectors"
            color="amber"
          />
        </div>
        <div className="animate-fade-in stagger-4">
          <KpiCard
            title="Sessions"
            value={`${d.active_sessions} / ${d.session_count}`}
            subtitle="active / total"
            color="green"
          />
        </div>
      </div>

      {/* Cost chart */}
      <div className="animate-fade-in stagger-5 mb-6">
        <CostChart data={[]} />
      </div>

      {/* Bottom section: detections + sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in stagger-6">
        {/* Recent detections */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-secondary)' }}>
            Recent Detections
          </h3>
          <div className="space-y-2">
            {mockDetections.map((det) => (
              <DetectionItem key={det.id} detection={det} />
            ))}
          </div>
        </div>

        {/* Active sessions */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-secondary)' }}>
            Active Sessions
          </h3>
          <div className="space-y-2">
            {mockSessions.map((sess) => (
              <SessionCard key={sess.id} session={sess} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
