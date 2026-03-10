import { describe, it, expect } from 'vitest';
import { QuickRuleEngine } from '../../packages/plugin/src/rule-engine.js';

describe('QuickRuleEngine', () => {
  it('flags consecutive identical tool calls >= 3', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.recordToolCall('s1', 'file_search', 'abc');
    const result = engine.recordToolCall('s1', 'file_search', 'abc');
    expect(result).not.toBeNull();
    expect(result!.detector_type).toBe('loop_spinning');
  });

  it('does not flag when tool names differ', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.recordToolCall('s1', 'file_read', 'def');
    const result = engine.recordToolCall('s1', 'file_search', 'abc');
    expect(result).toBeNull();
  });

  it('does not flag when argument hashes differ', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.recordToolCall('s1', 'file_search', 'def');
    const result = engine.recordToolCall('s1', 'file_search', 'ghi');
    expect(result).toBeNull();
  });

  it('tracks sessions independently', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.recordToolCall('s1', 'file_search', 'abc');
    // Different session breaks the streak
    engine.recordToolCall('s2', 'file_search', 'abc');
    const result = engine.recordToolCall('s1', 'file_search', 'abc');
    expect(result).not.toBeNull();
    expect(result!.detector_type).toBe('loop_spinning');
  });

  it('clears session state', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.recordToolCall('s1', 'file_search', 'abc');
    engine.clearSession('s1');
    const result = engine.recordToolCall('s1', 'file_search', 'abc');
    // After clearing, only 1 call recorded — no detection
    expect(result).toBeNull();
  });

  it('returns detection with correct session_id and evidence', () => {
    const engine = new QuickRuleEngine();
    engine.recordToolCall('sess-42', 'grep', 'hash1');
    engine.recordToolCall('sess-42', 'grep', 'hash1');
    const result = engine.recordToolCall('sess-42', 'grep', 'hash1');
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('sess-42');
    expect(result!.evidence).toMatchObject({
      tool: 'grep',
      arguments_hash: 'hash1',
      consecutive_count: 3,
    });
  });
});
