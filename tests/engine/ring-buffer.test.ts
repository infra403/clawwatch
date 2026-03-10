import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../packages/engine/src/ring-buffer.js';

describe('RingBuffer', () => {
  it('stores and retrieves items', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1); buf.push(2);
    expect(buf.toArray()).toEqual([1, 2]);
  });

  it('overwrites oldest when full', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1); buf.push(2); buf.push(3); buf.push(4);
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.size).toBe(3);
  });

  it('drains items and resets', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1); buf.push(2); buf.push(3);
    const drained = buf.drain();
    expect(drained).toEqual([1, 2, 3]);
    expect(buf.size).toBe(0);
  });

  it('handles wrap-around correctly', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1); buf.push(2); buf.push(3);
    buf.push(4); buf.push(5);
    expect(buf.toArray()).toEqual([3, 4, 5]);
  });

  it('reports correct size', () => {
    const buf = new RingBuffer<number>(10);
    expect(buf.size).toBe(0);
    buf.push(1);
    expect(buf.size).toBe(1);
  });
});
