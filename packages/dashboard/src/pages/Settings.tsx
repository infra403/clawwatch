import { useState, useEffect } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { BudgetBar } from '../components/BudgetBar';

interface DetectorConfig {
  name: string;
  enabled: boolean;
  description: string;
}

interface BudgetConfig {
  daily_limit: number;
  session_limit: number;
  alert_threshold: number;
}

interface Config {
  detectors: DetectorConfig[];
  budget: BudgetConfig;
  storage_mode: 'memory' | 'sqlite';
}

const defaultConfig: Config = {
  detectors: [
    { name: 'rapid-fire', enabled: true, description: 'Detects rapid sequential LLM calls without tool use' },
    { name: 'yoyo', enabled: true, description: 'Detects repeated read/write cycles on the same file' },
    { name: 'wall-stare', enabled: true, description: 'Detects repeated identical errors without strategy change' },
    { name: 'context-bloat', enabled: true, description: 'Detects excessive context window usage' },
    { name: 'premature-tool', enabled: false, description: 'Detects tool calls made without reading prior output' },
    { name: 'spin-loop', enabled: true, description: 'Detects agents stuck in repetitive action loops' },
  ],
  budget: {
    daily_limit: 5.0,
    session_limit: 1.0,
    alert_threshold: 0.8,
  },
  storage_mode: 'sqlite',
};

export function Settings() {
  const { data: remoteConfig } = useApi<Config>('/api/config');
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remoteConfig) setConfig(remoteConfig);
  }, [remoteConfig]);

  const toggleDetector = (name: string) => {
    setConfig((prev) => ({
      ...prev,
      detectors: prev.detectors.map((d) =>
        d.name === name ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  };

  const updateBudget = (field: keyof BudgetConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      budget: { ...prev.budget, [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // API might not be running — silently fail in dev
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Settings
      </h2>

      {/* Detectors */}
      <section className="mb-8 animate-fade-in stagger-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-secondary)' }}>
          Detectors
        </h3>
        <div className="space-y-2">
          {config.detectors.map((det) => (
            <div
              key={det.name}
              className="flex items-center justify-between rounded-lg border p-4"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <p className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-amber)' }}>
                  {det.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {det.description}
                </p>
              </div>
              <button
                onClick={() => toggleDetector(det.name)}
                className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                style={{
                  backgroundColor: det.enabled ? 'var(--accent-green)' : 'var(--border-subtle)',
                }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{
                    transform: det.enabled ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="mb-8 animate-fade-in stagger-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-secondary)' }}>
          Budget Configuration
        </h3>
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <BudgetBar label="Daily Budget" current={2.15} limit={config.budget.daily_limit} />
          <BudgetBar label="Session Budget" current={0.34} limit={config.budget.session_limit} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Daily Limit ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.budget.daily_limit}
                onChange={(e) => updateBudget('daily_limit', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Session Limit ($)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.budget.session_limit}
                onChange={(e) => updateBudget('session_limit', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Alert Threshold (%)
              </label>
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.budget.alert_threshold * 100}
                onChange={(e) => updateBudget('alert_threshold', (parseFloat(e.target.value) || 0) / 100)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Storage mode */}
      <section className="mb-8 animate-fade-in stagger-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-secondary)' }}>
          Storage Mode
        </h3>
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex gap-3">
            {(['memory', 'sqlite'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setConfig((prev) => ({ ...prev, storage_mode: mode }))}
                className="px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-all duration-150"
                style={{
                  backgroundColor: config.storage_mode === mode
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'transparent',
                  borderColor: config.storage_mode === mode
                    ? 'var(--accent-amber)'
                    : 'var(--border-subtle)',
                  color: config.storage_mode === mode
                    ? 'var(--accent-amber)'
                    : 'var(--text-secondary)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            {config.storage_mode === 'sqlite'
              ? 'Data persisted to SQLite database on disk'
              : 'Data stored in-memory only (lost on restart)'}
          </p>
        </div>
      </section>

      {/* Save button */}
      <div className="animate-fade-in stagger-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200"
          style={{
            backgroundColor: saved ? 'var(--accent-green)' : 'var(--accent-amber)',
            color: '#0a0e17',
            opacity: saving ? 0.6 : 1,
            boxShadow: saved ? 'var(--glow-green)' : 'var(--glow-amber)',
          }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
