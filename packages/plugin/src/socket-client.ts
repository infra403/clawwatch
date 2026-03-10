import { connect, type Socket } from 'node:net';
import { SOCKET_PATH } from '@clawwatch/shared';
import type { EngineCommand } from '@clawwatch/shared';

export type CommandHandler = (command: EngineCommand) => void;

/**
 * Non-blocking NDJSON socket client that connects to the ClawWatch Engine.
 *
 * - Writes events as newline-delimited JSON
 * - Queues events when disconnected (max 1000)
 * - Auto-reconnects with exponential backoff
 * - Receives commands from Engine on the same socket
 */
export class SocketClient {
  private socket: Socket | null = null;
  private connected = false;
  private queue: string[] = [];
  private readonly maxQueue = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 100;
  private readonly maxBackoffMs = 10_000;
  private destroyed = false;
  private commandHandler: CommandHandler | null = null;
  private incomingBuffer = '';

  constructor(private readonly socketPath: string = SOCKET_PATH) {}

  /**
   * Register a handler for commands received from the Engine.
   */
  onCommand(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /**
   * Initiate connection to the Engine socket.
   */
  connect(): void {
    if (this.destroyed) return;
    this.attemptConnect();
  }

  /**
   * Send an event object as NDJSON to the Engine.
   * Non-blocking: silently queues if disconnected.
   */
  send(event: Record<string, unknown>): void {
    const line = JSON.stringify(event) + '\n';
    if (this.connected && this.socket) {
      try {
        this.socket.write(line);
      } catch {
        this.enqueue(line);
      }
    } else {
      this.enqueue(line);
    }
  }

  /**
   * Gracefully disconnect and clean up.
   */
  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /** Visible for testing */
  get isConnected(): boolean {
    return this.connected;
  }

  /** Visible for testing */
  get queueLength(): number {
    return this.queue.length;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private attemptConnect(): void {
    if (this.destroyed) return;

    this.socket = connect(this.socketPath);

    this.socket.on('connect', () => {
      this.connected = true;
      this.backoffMs = 100;
      this.flushQueue();
    });

    this.socket.on('data', (data: Buffer) => {
      this.handleIncomingData(data.toString('utf-8'));
    });

    this.socket.on('error', () => {
      // Silently handle errors — never block the host process
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.socket = null;
      this.scheduleReconnect();
    });
  }

  private handleIncomingData(chunk: string): void {
    this.incomingBuffer += chunk;
    const lines = this.incomingBuffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.incomingBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const command = JSON.parse(trimmed) as EngineCommand;
        this.commandHandler?.(command);
      } catch {
        // Ignore malformed commands
      }
    }
  }

  private enqueue(line: string): void {
    if (this.queue.length >= this.maxQueue) {
      // Drop oldest to stay within limit
      this.queue.shift();
    }
    this.queue.push(line);
  }

  private flushQueue(): void {
    if (!this.connected || !this.socket) return;
    while (this.queue.length > 0) {
      const line = this.queue.shift()!;
      try {
        this.socket.write(line);
      } catch {
        // Re-enqueue at front on failure and stop flushing
        this.queue.unshift(line);
        break;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.attemptConnect();
    }, this.backoffMs);
  }
}
