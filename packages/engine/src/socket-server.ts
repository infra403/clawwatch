import { createServer, type Server, type Socket } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import type { PluginEvent, EngineCommand } from '@clawwatch/shared';
import { SOCKET_PATH } from '@clawwatch/shared';

export class SocketServer {
  private server: Server;
  private clients: Set<Socket> = new Set();
  private onEvent: (event: PluginEvent) => void;

  constructor(onEvent: (event: PluginEvent) => void) {
    this.onEvent = onEvent;
    this.server = createServer((socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: Socket): void {
    this.clients.add(socket);
    let buffer = '';

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      // Last element may be an incomplete line — keep it in the buffer
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as PluginEvent;
          this.onEvent(event);
        } catch {
          // Malformed JSON — skip silently
        }
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
    });
  }

  start(socketPath: string = SOCKET_PATH): Promise<void> {
    return new Promise((resolve, reject) => {
      if (existsSync(socketPath)) {
        try {
          unlinkSync(socketPath);
        } catch {
          // Ignore errors removing stale socket
        }
      }
      this.server.listen(socketPath, () => resolve());
      this.server.once('error', reject);
    });
  }

  sendCommand(command: EngineCommand): void {
    const line = JSON.stringify(command) + '\n';
    for (const client of this.clients) {
      try {
        client.write(line);
      } catch {
        // Skip clients that have disconnected
      }
    }
  }

  stop(): void {
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch {
        // Ignore
      }
    }
    this.clients.clear();
    this.server.close();
  }
}
