/**
 * Tests for useFocus.ts exported utilities
 */
import { describe, it, expect } from 'vitest';
import { formatDuration } from './useFocus';

describe('formatDuration()', () => {
  it('formats 0 seconds as 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats 1 second as 00:00:01', () => {
    expect(formatDuration(1)).toBe('00:00:01');
  });

  it('formats 59 seconds as 00:00:59', () => {
    expect(formatDuration(59)).toBe('00:00:59');
  });

  it('formats 60 seconds as 00:01:00', () => {
    expect(formatDuration(60)).toBe('00:01:00');
  });

  it('formats 61 seconds as 00:01:01', () => {
    expect(formatDuration(61)).toBe('00:01:01');
  });

  it('formats 3600 seconds (1 hour) as 01:00:00', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
  });

  it('formats 3661 seconds as 01:01:01', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formats 7200 seconds (2 hours) as 02:00:00', () => {
    expect(formatDuration(7200)).toBe('02:00:00');
  });

  it('formats 3599 seconds as 00:59:59', () => {
    expect(formatDuration(3599)).toBe('00:59:59');
  });

  it('formats 7263 seconds as 02:01:03', () => {
    expect(formatDuration(7263)).toBe('02:01:03');
  });

  it('formats 36000 seconds (10 hours) as 10:00:00', () => {
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  it('always returns HH:MM:SS format with colons', () => {
    const result = formatDuration(12345);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('pads hours with leading zero for single digit', () => {
    expect(formatDuration(3600)).toMatch(/^01:/);
  });

  it('pads minutes with leading zero for single digit', () => {
    expect(formatDuration(60)).toContain(':01:');
  });

  it('pads seconds with leading zero for single digit', () => {
    expect(formatDuration(1)).toMatch(/:01$/);
  });

  it('handles 30 minute sessions: 1800s → 00:30:00', () => {
    expect(formatDuration(1800)).toBe('00:30:00');
  });

  it('handles 45 minute sessions: 2700s → 00:45:00', () => {
    expect(formatDuration(2700)).toBe('00:45:00');
  });

  it('handles 90 minute sessions: 5400s → 01:30:00', () => {
    expect(formatDuration(5400)).toBe('01:30:00');
  });

  it('handles typical study session (25 min = 1500s)', () => {
    expect(formatDuration(1500)).toBe('00:25:00');
  });

  it('handles large values (24 hours = 86400s)', () => {
    expect(formatDuration(86400)).toBe('24:00:00');
  });
});
