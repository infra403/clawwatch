import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ClawWatchDB } from '../../packages/engine/src/db.js';
import { Pipeline } from '../../packages/engine/src/pipeline.js';
import { SocketServer } from '../../packages/engine/src/socket-server.js';
import { SocketClient } from '../../packages/plugin/src/socket-client.js';
import { DEFAULT_CONFIG } from '../../packages/shared/src/config.js';
import type { EngineCommand } from '../../packages/shared/src/types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(check, intervalMs);
    };
    check();
  });
}

describe('Plugin → Engine end-to-end', () => {
  let tmpDir: string;
  let dbPath: string;
  let socketPath: string;
  let db: ClawWatchDB;
  let pipeline: Pipeline;
  let server: SocketServer;
  let client: SocketClient;
  let commands: EngineCommand[];

  beforeEach(async () => {
    const id = randomUUID();
    tmpDir = join(tmpdir(), `clawwatch-e2e-${id}`);
    dbPath = join(tmpDir, 'test.db');
    socketPath = join(tmpDir, 'test.sock');

    commands = [];

    db = new ClawWatchDB(dbPath);
    pipeline = new Pipeline({
      config: { ...DEFAULT_CONFIG },
      db,
      onCommand: (cmd) => commands.push(cmd),
    });

    server = new SocketServer((event) => pipeline.process(event));
    await server.start(socketPath);

    client = new SocketClient(socketPath);
    client.connect();
    await waitFor(() => client.isConnected);
  });

  afterEach(() => {
    client.disconnect();
    server.stop();
    db.close();
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('full lifecycle: session_start → llm_call → tool_call → session_end', async () => {
    const sessionId = randomUUID();
    const now = Date.now();

    // session_start
    client.send({
      type: 'session_start',
      session_id: sessionId,
      timestamp: now,
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
      initial_prompt: 'Write a function',
    });

    await sleep(100);

    // llm_call
    client.send({
      type: 'llm_call',
      session_id: sessionId,
      timestamp: now + 1000,
      model_id: 'claude-sonnet-4-6',
      input_tokens: 500,
      output_tokens: 200,
      cost_usd: 0.0045,
      latency_ms: 350,
    });

    await sleep(100);

    // tool_call
    client.send({
      type: 'tool_call',
      session_id: sessionId,
      timestamp: now + 2000,
      tool_name: 'write_file',
      arguments_hash: 'hash123',
      result_summary: 'File written',
      duration_ms: 50,
    });

    await sleep(100);

    // session_end
    client.send({
      type: 'session_end',
      session_id: sessionId,
      timestamp: now + 3000,
    });

    await sleep(150);

    // Verify session was created and ended
    const session = db.getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe('ended');
    expect(session!.model_id).toBe('claude-sonnet-4-6');

    // Verify LLM call recorded
    const llmCalls = db.getLlmCallsBySession(sessionId);
    expect(llmCalls).toHaveLength(1);
    expect(llmCalls[0].input_tokens).toBe(500);
    expect(llmCalls[0].output_tokens).toBe(200);

    // Verify tool call recorded
    const toolCalls = db.getToolCallsBySession(sessionId);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].tool_name).toBe('write_file');
    expect(toolCalls[0].arguments_hash).toBe('hash123');
  });

  it('pipeline calculates cost from pricing for known model', async () => {
    const sessionId = randomUUID();
    const now = Date.now();

    client.send({
      type: 'session_start',
      session_id: sessionId,
      timestamp: now,
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
    });

    await sleep(100);

    // Send llm_call — pipeline should compute cost via CostCalculator
    client.send({
      type: 'llm_call',
      session_id: sessionId,
      timestamp: now + 1000,
      model_id: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: 0.0,
      latency_ms: 400,
    });

    await sleep(150);

    const llmCalls = db.getLlmCallsBySession(sessionId);
    expect(llmCalls).toHaveLength(1);
    // claude-sonnet-4-6: $3/1M input, $15/1M output
    // Expected: (1000/1M)*3 + (500/1M)*15 = 0.003 + 0.0075 = 0.0105
    const cost = llmCalls[0].cost_usd as number;
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it('loop detection fires for repeated identical tool calls', async () => {
    const sessionId = randomUUID();
    const now = Date.now();

    client.send({
      type: 'session_start',
      session_id: sessionId,
      timestamp: now,
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
    });

    await sleep(100);

    // Need an LLM call first so tool calls have a session context
    client.send({
      type: 'llm_call',
      session_id: sessionId,
      timestamp: now + 100,
      model_id: 'claude-sonnet-4-6',
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.0,
      latency_ms: 100,
    });

    await sleep(100);

    // Send 3+ identical tool calls within the 60s window (min_repeats=3)
    const toolCallBase = {
      type: 'tool_call',
      session_id: sessionId,
      tool_name: 'read_file',
      arguments_hash: 'same_hash_abc',
      result_summary: 'File contents',
      duration_ms: 30,
    };

    for (let i = 0; i < 4; i++) {
      client.send({
        ...toolCallBase,
        timestamp: now + 1000 + i * 500,
      });
      await sleep(80);
    }

    await sleep(150);

    // Verify loop_spinning detection was created
    const detections = db.getDetectionsBySession(sessionId);
    const loopDetections = detections.filter(
      (d) => d.detector_type === 'loop_spinning',
    );
    expect(loopDetections.length).toBeGreaterThanOrEqual(1);
    expect(loopDetections[0].severity).toBeDefined();

    // Verify the detection alert command was sent
    const alertCommands = commands.filter((c) => c.type === 'detection_alert');
    expect(alertCommands.length).toBeGreaterThanOrEqual(1);
  });

  it('engine sends command back to plugin via socket', async () => {
    const sessionId = randomUUID();
    const now = Date.now();
    const receivedCommands: EngineCommand[] = [];

    client.onCommand((cmd) => receivedCommands.push(cmd));

    client.send({
      type: 'session_start',
      session_id: sessionId,
      timestamp: now,
      model_id: 'claude-sonnet-4-6',
      provider: 'anthropic',
    });

    await sleep(100);

    // Send LLM call first
    client.send({
      type: 'llm_call',
      session_id: sessionId,
      timestamp: now + 100,
      model_id: 'claude-sonnet-4-6',
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.0,
      latency_ms: 100,
    });

    await sleep(100);

    // Send enough identical tool calls to trigger loop_spinning detection,
    // which should cause a detection_alert command to be broadcast back
    for (let i = 0; i < 4; i++) {
      client.send({
        type: 'tool_call',
        session_id: sessionId,
        timestamp: now + 1000 + i * 200,
        tool_name: 'bash',
        arguments_hash: 'identical_hash',
        result_summary: 'error output',
        duration_ms: 20,
      });
      await sleep(80);
    }

    // The pipeline calls onCommand which pushes to `commands` array.
    // Now manually broadcast one of those commands to verify socket delivery.
    await sleep(100);

    // Verify commands were generated in pipeline
    expect(commands.length).toBeGreaterThan(0);

    // Send a command through the server to the client
    const testCommand: EngineCommand = {
      type: 'detection_alert',
      sessionId,
      detection: {
        id: randomUUID(),
        session_id: sessionId,
        timestamp: Date.now(),
        detector_type: 'loop_spinning',
        severity: 'warning',
        description: 'Test detection',
        evidence: {},
      },
    };
    server.sendCommand(testCommand);

    await sleep(100);

    expect(receivedCommands.length).toBeGreaterThanOrEqual(1);
    expect(receivedCommands[0].type).toBe('detection_alert');
  });
});
