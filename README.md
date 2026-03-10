# ClawWatch

AI Agent efficiency monitor -- your AI Agent's slacking detector.

## What it does

- Monitors LLM/tool call patterns in real-time
- Detects 6 types of wasteful behavior (loop spinning, token bloat, stalling, tool abuse, task drift, model mismatch)
- Tracks costs across sessions
- Enforces budgets (per-session, daily)
- Scores efficiency (0-100)
- Web dashboard for visualization

## Quick Start

```bash
# Install
pnpm install

# Development
pnpm dev:engine    # Start engine (port 18800)
pnpm dev:dashboard # Start dashboard dev server (port 18801)

# Production
pnpm build         # Build all packages
pnpm start         # Start engine (serves API + dashboard on port 18800)

# Tests
pnpm test          # Run all tests
```

## Architecture

Plugin-First Hybrid: OpenClaw plugin captures data -> Unix Socket -> Engine analyzes -> Dashboard displays.

```
packages/
  shared/     - types, config, pricing, constants
  engine/     - socket server, pipeline, detectors, API server, DB
  plugin/     - OpenClaw service plugin
  dashboard/  - React SPA (Vite + Tailwind + Recharts)
```

### Data Flow

1. **Plugin** hooks into OpenClaw lifecycle events (session start/end, LLM calls, tool calls)
2. **Socket Server** receives events over a Unix domain socket
3. **Pipeline** enriches events with cost data, runs through 6 detectors, persists to SQLite
4. **Budget Guardian** enforces spending limits and sends pause/warn commands back to the plugin
5. **API Server** exposes REST endpoints + SSE stream for the dashboard
6. **Dashboard** renders real-time session data, detections, and cost metrics

### Detectors

| Detector | What it catches |
|---|---|
| Loop Spinning | Repeated identical tool calls in a short window |
| Token Bloat | Disproportionate input/output token ratios |
| Stalling | Long gaps between events in an active session |
| Tool Abuse | Excessive tool call frequency |
| Task Drift | Agent straying from the original prompt |
| Model Mismatch | Using expensive models for simple tasks |

## Configuration

Create `~/.clawwatch/config.json` to override defaults:

```json
{
  "dashboardPort": 18800,
  "budget": {
    "dailyLimitUsd": 20,
    "sessionLimitUsd": 5,
    "alertThreshold": 0.8
  },
  "detectors": {
    "loop_spinning": { "enabled": true, "window_seconds": 60, "min_repeats": 3 },
    "token_bloat": { "enabled": true, "ratio_multiplier": 2 },
    "stalling": { "enabled": true, "timeout_seconds": 30 },
    "tool_abuse": { "enabled": true, "max_calls_per_minute": 5 },
    "task_drift": { "enabled": true, "similarity_threshold": 0.3 },
    "model_mismatch": { "enabled": true, "cost_complexity_ratio": 10 }
  }
}
```

Config changes are hot-reloaded -- detectors and budget settings update without restart.

## Data Retention

Old data is automatically cleaned up. Sessions and detections older than 30 days are deleted on engine startup and every 24 hours thereafter.

## Tech Stack

TypeScript, Node.js >= 22, pnpm, better-sqlite3, Fastify, React + Vite + Tailwind + Recharts
