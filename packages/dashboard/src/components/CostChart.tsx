import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CostDataPoint {
  time: string;
  cost: number;
  waste: number;
}

interface CostChartProps {
  data: CostDataPoint[];
}

// Mock data for development
const mockData: CostDataPoint[] = [
  { time: '00:00', cost: 0.02, waste: 0.001 },
  { time: '01:00', cost: 0.05, waste: 0.003 },
  { time: '02:00', cost: 0.04, waste: 0.002 },
  { time: '03:00', cost: 0.08, waste: 0.01 },
  { time: '04:00', cost: 0.12, waste: 0.015 },
  { time: '05:00', cost: 0.10, waste: 0.008 },
  { time: '06:00', cost: 0.15, waste: 0.02 },
  { time: '07:00', cost: 0.22, waste: 0.035 },
  { time: '08:00', cost: 0.18, waste: 0.025 },
  { time: '09:00', cost: 0.25, waste: 0.04 },
  { time: '10:00', cost: 0.30, waste: 0.05 },
  { time: '11:00', cost: 0.28, waste: 0.03 },
];

export function CostChart({ data }: CostChartProps) {
  const chartData = data.length > 0 ? data : mockData;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        Cost Timeline
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={{ stroke: '#1f2937' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={{ stroke: '#1f2937' }}
            tickLine={false}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: '#f9fafb',
            }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#costGrad)"
            strokeWidth={2}
            name="Cost"
          />
          <Area
            type="monotone"
            dataKey="waste"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#wasteGrad)"
            strokeWidth={2}
            name="Waste"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
