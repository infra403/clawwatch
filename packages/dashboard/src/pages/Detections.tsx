import { useApi } from '../hooks/useApi';
import { DetectionItem } from '../components/DetectionItem';
import type { Detection } from '../components/DetectionItem';

interface DetectorSummary {
  name: string;
  count: number;
  total_waste: number;
}

// Mock data
const mockDetections: Detection[] = [
  { id: 'd1', detector: 'rapid-fire', severity: 'high', message: 'Rapid sequential LLM calls detected (8 calls in 3s)', waste_cost: 0.0234, timestamp: '2 min ago' },
  { id: 'd2', detector: 'yoyo', severity: 'medium', message: 'Yoyo pattern: repeated read/write cycle on config.json', waste_cost: 0.0089, timestamp: '5 min ago' },
  { id: 'd3', detector: 'wall-stare', severity: 'low', message: 'Same error repeated 3 times without strategy change', waste_cost: 0.0045, timestamp: '12 min ago' },
  { id: 'd4', detector: 'context-bloat', severity: 'high', message: 'Context window usage exceeds 80% with repetitive content', waste_cost: 0.0312, timestamp: '18 min ago' },
  { id: 'd5', detector: 'premature-tool', severity: 'medium', message: 'Tool call made before fully reading prior output', waste_cost: 0.0067, timestamp: '25 min ago' },
  { id: 'd6', detector: 'spin-loop', severity: 'critical', message: 'Agent stuck in loop: same action attempted 5 times', waste_cost: 0.0456, timestamp: '30 min ago' },
  { id: 'd7', detector: 'rapid-fire', severity: 'medium', message: 'Burst of 5 LLM calls in rapid succession', waste_cost: 0.0123, timestamp: '45 min ago' },
  { id: 'd8', detector: 'yoyo', severity: 'high', message: 'File rewritten 4 times in 60 seconds', waste_cost: 0.0198, timestamp: '1 hour ago' },
];

const mockSummary: DetectorSummary[] = [
  { name: 'rapid-fire', count: 8, total_waste: 0.0357 },
  { name: 'yoyo', count: 5, total_waste: 0.0287 },
  { name: 'wall-stare', count: 3, total_waste: 0.0135 },
  { name: 'context-bloat', count: 4, total_waste: 0.0312 },
  { name: 'premature-tool', count: 2, total_waste: 0.0067 },
  { name: 'spin-loop', count: 1, total_waste: 0.0456 },
];

export function Detections() {
  const { data: detections } = useApi<Detection[]>('/api/detections?limit=50', 5000);
  const detList = detections ?? mockDetections;
  const totalWaste = mockSummary.reduce((s, d) => s + d.total_waste, 0);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Detections
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {mockSummary.map((d, i) => (
          <div
            key={d.name}
            className={`animate-fade-in stagger-${i + 1} rounded-lg border p-3 text-center`}
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-mono mb-1" style={{ color: 'var(--accent-amber)' }}>
              {d.name}
            </p>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
              {d.count}
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--accent-red)' }}>
              -${d.total_waste.toFixed(4)}
            </p>
          </div>
        ))}
      </div>

      {/* Waste breakdown bar */}
      <div
        className="rounded-xl border p-5 mb-6 animate-fade-in stagger-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Waste Breakdown
        </h3>
        <div className="flex rounded-lg overflow-hidden h-6">
          {mockSummary.map((d) => {
            const pct = totalWaste > 0 ? (d.total_waste / totalWaste) * 100 : 0;
            const colors: Record<string, string> = {
              'rapid-fire': '#ef4444',
              'yoyo': '#f59e0b',
              'wall-stare': '#3b82f6',
              'context-bloat': '#8b5cf6',
              'premature-tool': '#10b981',
              'spin-loop': '#ec4899',
            };
            return (
              <div
                key={d.name}
                className="h-full transition-all duration-500 relative group"
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors[d.name] ?? '#6b7280',
                }}
                title={`${d.name}: $${d.total_waste.toFixed(4)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {mockSummary.map((d) => {
            const colors: Record<string, string> = {
              'rapid-fire': '#ef4444',
              'yoyo': '#f59e0b',
              'wall-stare': '#3b82f6',
              'context-bloat': '#8b5cf6',
              'premature-tool': '#10b981',
              'spin-loop': '#ec4899',
            };
            return (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: colors[d.name] ?? '#6b7280' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detection log */}
      <div className="animate-fade-in stagger-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--text-secondary)' }}>
          Detection Log
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {detList.map((det) => (
            <DetectionItem key={det.id} detection={det} />
          ))}
        </div>
      </div>
    </div>
  );
}
