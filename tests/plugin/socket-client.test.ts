import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SocketClient } from '../../packages/plugin/src/socket-client.js';

function tmpSocketPath(): string {
  return join(tmpdir(), `clawwatch-test-${randomUUID()}.sock`);
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SocketClient', () => {
  let server: Server | null = null;
  let client: SocketClient | null = null;

  afterEach(async () => {
    client?.disconnect();
    client = null;
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it('connects to a Unix socket and sends NDJSON', async () => {
    const sockPath = tmpSocketPath();
    const received: string[] = [];

    await new Promise<void>((resolve) => {
      server = createServer((conn) => {
        conn.on('data', (data) => {
          received.push(data.toString('utf-8'));
        });
      });
      server.listen(sockPath, () => resolve());
    });

    client = new SocketClient(sockPath);
    client.connect();

    await waitFor(100);
    expect(client.isConnected).toBe(true);

    client.send({ type: 'test', value: 42 });
    await waitFor(50);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(received.join('').trim());
    expect(parsed.type).toBe('test');
    expect(parsed.value).toBe(42);
  });

  it('queues events when not connected', () => {
    const sockPath = tmpSocketPath(); // No server listening
    client = new SocketClient(sockPath);
    // Don't connect — just send
    client.send({ type: 'queued', n: 1 });
    client.send({ type: 'queued', n: 2 });
    expect(client.queueLength).toBe(2);
  });

  it('flushes queue on connect', async () => {
    const sockPath = tmpSocketPath();
    const received: string[] = [];

    client = new SocketClient(sockPath);
    // Queue events before server exists
    client.send({ type: 'pre', n: 1 });
    client.send({ type: 'pre', n: 2 });
    expect(client.queueLength).toBe(2);

    // Now start server
    await new Promise<void>((resolve) => {
      server = createServer((conn) => {
        conn.on('data', (data) => {
          received.push(data.toString('utf-8'));
        });
      });
      server.listen(sockPath, () => resolve());
    });

    client.connect();
    await waitFor(150);

    expect(client.isConnected).toBe(true);
    expect(client.queueLength).toBe(0);
    const lines = received.join('').trim().split('\n');
    expect(lines.length).toBe(2);
  });

  it('respects max queue size of 1000', () => {
    const sockPath = tmpSocketPath();
    client = new SocketClient(sockPath);
    for (let i = 0; i < 1100; i++) {
      client.send({ i });
    }
    expect(client.queueLength).toBe(1000);
  });

  it('receives commands from Engine via NDJSON', async () => {
    const sockPath = tmpSocketPath();
    const commands: unknown[] = [];

    await new Promise<void>((resolve) => {
      server = createServer((conn) => {
        // Send a command to the client
        setTimeout(() => {
          conn.write(JSON.stringify({ type: 'budget_exceeded', sessionId: 's1', budget: 10, spent: 12 }) + '\n');
        }, 50);
      });
      server.listen(sockPath, () => resolve());
    });

    client = new SocketClient(sockPath);
    client.onCommand((cmd) => commands.push(cmd));
    client.connect();

    await waitFor(200);

    expect(commands.length).toBe(1);
    expect((commands[0] as any).type).toBe('budget_exceeded');
    expect((commands[0] as any).sessionId).toBe('s1');
  });

  it('disconnect stops reconnection', async () => {
    const sockPath = tmpSocketPath();
    client = new SocketClient(sockPath);
    client.connect();
    await waitFor(50);
    client.disconnect();
    expect(client.isConnected).toBe(false);
  });
});
