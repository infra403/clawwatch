import {
  SOCKET_PATH,
  DB_PATH,
  CONFIG_PATH,
  loadConfig,
  watchConfig,
} from '@clawwatch/shared';
import type { EngineCommand } from '@clawwatch/shared';
import { ClawWatchDB } from './db.js';
import { Pipeline } from './pipeline.js';
import { SocketServer } from './socket-server.js';
import { createApiServer } from './api/server.js';

async function main(): Promise<void> {
  // 1. Load config
  const config = loadConfig(CONFIG_PATH);
  console.log('[engine] Config loaded from', CONFIG_PATH);

  // 2. Init DB
  const db = new ClawWatchDB(DB_PATH);
  console.log('[engine] Database initialized at', DB_PATH);

  // 3. Create API server (early, so we have broadcast fn)
  const api = createApiServer({
    db,
    config,
    onConfigChange: (newConfig) => {
      console.log('[engine] Config updated');
      // Pipeline will pick up config changes on next event
      Object.assign(config, newConfig);
    },
  });

  // 4. Create Pipeline with onCommand that broadcasts to SSE + socket clients
  const socketServer = new SocketServer((event) => {
    pipeline.process(event);
  });

  const pipeline = new Pipeline({
    config,
    db,
    onCommand: (command: EngineCommand) => {
      // Broadcast to SSE clients
      api.broadcast(command);
      // Send back to socket clients (plugins)
      socketServer.sendCommand(command);
    },
  });

  // 5. Start socket server
  await socketServer.start(SOCKET_PATH);
  console.log('[engine] Socket server listening on', SOCKET_PATH);

  // 6. Start API server
  const address = await api.start(config.dashboardPort);
  console.log('[engine] API server listening on', address);

  // 7. Watch config for changes (hot reload detectors)
  const stopWatching = watchConfig(CONFIG_PATH, (newConfig) => {
    console.log('[engine] Config file changed, reloading');
    Object.assign(config, newConfig);
    pipeline.recreateDetectors();
    console.log('[engine] Detectors re-created from new config');
  });

  // 8. Data retention cleanup
  const retentionDays = 30;
  const runRetention = () => {
    const result = db.deleteOlderThan(retentionDays);
    if (result.deletedSessions > 0 || result.deletedDetections > 0) {
      console.log(
        `[engine] Retention cleanup: deleted ${result.deletedSessions} sessions, ${result.deletedDetections} detections`,
      );
    }
  };
  runRetention();
  const retentionTimer = setInterval(runRetention, 86400000);

  // 9. Stall check timer — check for stalled sessions every 30 seconds
  const stallTimer = setInterval(() => {
    const activeSessions = db.getActiveSessions();
    const now = Date.now();
    for (const session of activeSessions) {
      const lastActivity = (session.ended_at ?? session.started_at) as number;
      if (now - lastActivity > 300_000) {
        // 5 minutes with no activity
        console.log(`[engine] Stalled session detected: ${session.id}`);
      }
    }
  }, 30_000);

  // 10. Graceful shutdown
  const shutdown = async () => {
    console.log('[engine] Shutting down...');
    clearInterval(stallTimer);
    clearInterval(retentionTimer);
    stopWatching();
    socketServer.stop();
    await api.stop();
    db.close();
    console.log('[engine] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[engine] Fatal error:', err);
  process.exit(1);
});
