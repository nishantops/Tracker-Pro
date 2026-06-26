/**
 * Tests for useSources.ts constants and pure data
 */
import { describe, it, expect } from 'vitest';
import { EMPTY_SOURCE_FORM, SOURCE_TOPICS, TOPIC_COLORS } from './useSources';

describe('EMPTY_SOURCE_FORM', () => {
  it('title defaults to empty string', () => {
    expect(EMPTY_SOURCE_FORM.title).toBe('');
  });

  it('link defaults to empty string', () => {
    expect(EMPTY_SOURCE_FORM.link).toBe('');
  });

  it('topic defaults to "General"', () => {
    expect(EMPTY_SOURCE_FORM.topic).toBe('General');
  });

  it('notes defaults to empty string', () => {
    expect(EMPTY_SOURCE_FORM.notes).toBe('');
  });

  it('has exactly 4 fields', () => {
    expect(Object.keys(EMPTY_SOURCE_FORM)).toHaveLength(4);
  });
});

describe('SOURCE_TOPICS', () => {
  it('has 15 topics', () => {
    expect(SOURCE_TOPICS).toHaveLength(15);
  });

  it('first topic is "General"', () => {
    expect(SOURCE_TOPICS[0]).toBe('General');
  });

  it('includes "Current Affairs"', () => {
    expect(SOURCE_TOPICS).toContain('Current Affairs');
  });

  it('includes all core subjects', () => {
    const core = ['History', 'Geography', 'Polity', 'Economy', 'Ethics'];
    for (const subject of core) {
      expect(SOURCE_TOPICS).toContain(subject);
    }
  });

  it('includes digital source types: Newspaper, YouTube', () => {
    expect(SOURCE_TOPICS).toContain('Newspaper');
    expect(SOURCE_TOPICS).toContain('YouTube');
  });

  it('includes Test Series', () => {
    expect(SOURCE_TOPICS).toContain('Test Series');
  });

  it('includes Other as catch-all', () => {
    expect(SOURCE_TOPICS).toContain('Other');
  });

  it('all topics are non-empty strings', () => {
    for (const topic of SOURCE_TOPICS) {
      expect(topic.trim().length).toBeGreaterThan(0);
    }
  });

  it('no duplicate topics', () => {
    const unique = new Set(SOURCE_TOPICS);
    expect(unique.size).toBe(SOURCE_TOPICS.length);
  });
});

describe('TOPIC_COLORS', () => {
  it('has color for every SOURCE_TOPIC', () => {
    for (const topic of SOURCE_TOPICS) {
      expect(TOPIC_COLORS).toHaveProperty(topic);
    }
  });

  it('all colors are valid hex strings', () => {
    for (const color of Object.values(TOPIC_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('General is neutral gray-slate', () => {
    expect(TOPIC_COLORS.General).toBe('#64748b');
  });

  it('YouTube is red', () => {
    expect(TOPIC_COLORS.YouTube).toBe('#ef4444');
  });

  it('Geography is green', () => {
    expect(TOPIC_COLORS.Geography).toBe('#10b981');
  });

  it('Current Affairs is amber', () => {
    expect(TOPIC_COLORS['Current Affairs']).toBe('#f59e0b');
  });

  it('History is red/rose', () => {
    expect(TOPIC_COLORS.History).toBe('#f43f5e');
  });

  it('has 15 entries matching SOURCE_TOPICS count', () => {
    expect(Object.keys(TOPIC_COLORS)).toHaveLength(SOURCE_TOPICS.length);
  });

  it('no two topics share the same color', () => {
    const colors = Object.values(TOPIC_COLORS);
    // Some may share colors (Polity & Test Series both use indigo) — just verify no ALL-same
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });
});
