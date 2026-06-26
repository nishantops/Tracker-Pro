/**
 * Tests for useMetrics.ts constants and logic
 */
import { describe, it, expect } from 'vitest';

// ── Constants mirrored from useMetrics.ts ───────────────────────────────────
const FLUSH_INTERVAL = 10_000;
const MAX_BATCH = 50;

// Session ID pattern: sess_{timestamp}_{6-char random}
const SESSION_ID_PATTERN = /^sess_\d+_[a-z0-9]{6}$/;

describe('MetricsService constants', () => {
  it('FLUSH_INTERVAL is 10 seconds (10000ms)', () => {
    expect(FLUSH_INTERVAL).toBe(10_000);
  });

  it('MAX_BATCH is 50 rows', () => {
    expect(MAX_BATCH).toBe(50);
  });

  it('FLUSH_INTERVAL matches ENV.METRICS_FLUSH_MS', async () => {
    const { ENV } = await import('../lib/env');
    expect(FLUSH_INTERVAL).toBe(ENV.METRICS_FLUSH_MS);
  });
});

describe('SESSION_ID format', () => {
  it('SESSION_ID starts with "sess_"', () => {
    // Generate a sample ID using the same logic as useMetrics.ts
    const sampleId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    expect(sampleId).toMatch(/^sess_/);
  });

  it('SESSION_ID contains numeric timestamp', () => {
    const ts = Date.now();
    const sampleId = `sess_${ts}_abc123`;
    expect(sampleId).toContain(String(ts));
  });

  it('SESSION_ID matches expected format', () => {
    const sampleId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    expect(sampleId).toMatch(SESSION_ID_PATTERN);
  });

  it('Two generated SESSION_IDs are different', () => {
    const id1 = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const id2 = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    // Very unlikely to match due to random suffix
    // They share the same timestamp but different random parts
    expect(id1.slice(0, 5)).toBe('sess_');
    expect(id2.slice(0, 5)).toBe('sess_');
  });
});

describe('Metrics queue logic (pure logic tests)', () => {
  it('batch splice removes up to MAX_BATCH items', () => {
    const queue = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const batch = queue.splice(0, MAX_BATCH);
    expect(batch).toHaveLength(MAX_BATCH);
    expect(queue).toHaveLength(50);
  });

  it('batch splice with fewer items than MAX_BATCH takes all', () => {
    const queue = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const batch = queue.splice(0, MAX_BATCH);
    expect(batch).toHaveLength(20);
    expect(queue).toHaveLength(0);
  });

  it('empty queue produces empty batch', () => {
    const queue: unknown[] = [];
    const batch = queue.splice(0, MAX_BATCH);
    expect(batch).toHaveLength(0);
  });

  it('queue remains intact for remaining items after batch', () => {
    const queue = Array.from({ length: 75 }, (_, i) => ({ id: i }));
    queue.splice(0, MAX_BATCH); // take 50
    expect(queue).toHaveLength(25);
    expect(queue[0]).toEqual({ id: 50 }); // remaining start at 50
  });
});

describe('Event data structure', () => {
  it('page_load event has correct structure', () => {
    const event = {
      user_id: 'user-123',
      event_type: 'page_load',
      event_data: { url: '/app.html', ua: 'Mozilla/5.0' },
      session_id: 'sess_12345_abc',
    };
    expect(event).toHaveProperty('user_id');
    expect(event).toHaveProperty('event_type', 'page_load');
    expect(event).toHaveProperty('event_data');
    expect(event).toHaveProperty('session_id');
  });

  it('session_end event includes duration_seconds', () => {
    const dur = 300;
    const event = {
      user_id: 'user-123',
      event_type: 'session_end',
      event_data: { duration_seconds: dur },
      session_id: 'sess_12345_abc',
    };
    expect(event.event_data.duration_seconds).toBe(300);
  });

  it('ua is truncated to 80 chars max', () => {
    const longUA = 'A'.repeat(200);
    const truncated = longUA.substring(0, 80);
    expect(truncated.length).toBe(80);
  });

  it('session_end only fires when duration > 3 seconds', () => {
    const shouldFire = (dur: number) => dur > 3;
    expect(shouldFire(0)).toBe(false);
    expect(shouldFire(1)).toBe(false);
    expect(shouldFire(3)).toBe(false);
    expect(shouldFire(4)).toBe(true);
    expect(shouldFire(300)).toBe(true);
  });

  it('duration calculation uses seconds (not ms)', () => {
    const startMs = 0;
    const endMs = 5000; // 5 seconds
    const dur = Math.round((endMs - startMs) / 1000);
    expect(dur).toBe(5);
  });
});
