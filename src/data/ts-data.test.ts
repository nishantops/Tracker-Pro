/**
 * Tests for src/data/ts-data.ts
 * Tests Test Series data structures
 */
import { describe, it, expect } from 'vitest';
import { TS_PRELIMS, TS_MAINS } from './ts-data';

describe('TS_PRELIMS data', () => {
  it('has exactly 2 papers: p1 and p2', () => {
    expect(TS_PRELIMS).toHaveLength(2);
    expect(TS_PRELIMS.map(p => p.key)).toEqual(['p1', 'p2']);
  });

  it('each paper has key, label, prefix, and items', () => {
    for (const paper of TS_PRELIMS) {
      expect(paper.key).toBeTruthy();
      expect(paper.label).toBeTruthy();
      expect(paper.prefix).toBeTruthy();
      expect(Array.isArray(paper.items)).toBe(true);
      expect(paper.items.length).toBeGreaterThan(0);
    }
  });

  it('p1 label is "GS Paper I"', () => {
    const p1 = TS_PRELIMS.find(p => p.key === 'p1')!;
    expect(p1.label).toBe('GS Paper I');
  });

  it('p2 label is "CSAT Paper II"', () => {
    const p2 = TS_PRELIMS.find(p => p.key === 'p2')!;
    expect(p2.label).toBe('CSAT Paper II');
  });

  it('p1 prefix is "tp1"', () => {
    const p1 = TS_PRELIMS.find(p => p.key === 'p1')!;
    expect(p1.prefix).toBe('tp1');
  });

  it('p1 has 2 test items', () => {
    const p1 = TS_PRELIMS.find(p => p.key === 'p1')!;
    expect(p1.items).toHaveLength(2);
  });

  it('p1 items include Mock Test 01 and 02', () => {
    const p1 = TS_PRELIMS.find(p => p.key === 'p1')!;
    expect(p1.items[0]).toContain('Mock Test 01');
    expect(p1.items[1]).toContain('Mock Test 02');
  });

  it('p2 has 2 test items', () => {
    const p2 = TS_PRELIMS.find(p => p.key === 'p2')!;
    expect(p2.items).toHaveLength(2);
  });

  it('all item strings are non-empty', () => {
    for (const paper of TS_PRELIMS) {
      for (const item of paper.items) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('prefixes are unique', () => {
    const prefixes = TS_PRELIMS.map(p => p.prefix);
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });
});

describe('TS_MAINS data', () => {
  it('has 7 papers: gs1, gs2, gs3, gs4, essay, a1, a2', () => {
    expect(TS_MAINS).toHaveLength(7);
    expect(TS_MAINS.map(p => p.key)).toEqual(['gs1', 'gs2', 'gs3', 'gs4', 'essay', 'a1', 'a2']);
  });

  it('each paper has key, label, prefix, and items', () => {
    for (const paper of TS_MAINS) {
      expect(paper.key).toBeTruthy();
      expect(paper.label).toBeTruthy();
      expect(paper.prefix).toBeTruthy();
      expect(Array.isArray(paper.items)).toBe(true);
      expect(paper.items.length).toBeGreaterThan(0);
    }
  });

  it('gs1 label is "GS-I"', () => {
    const gs1 = TS_MAINS.find(p => p.key === 'gs1')!;
    expect(gs1.label).toBe('GS-I');
  });

  it('essay label is "Essay"', () => {
    const essay = TS_MAINS.find(p => p.key === 'essay')!;
    expect(essay.label).toBe('Essay');
  });

  it('anthro papers have a1 and a2 keys', () => {
    expect(TS_MAINS.find(p => p.key === 'a1')).toBeDefined();
    expect(TS_MAINS.find(p => p.key === 'a2')).toBeDefined();
  });

  it('a1 label is "Anthro P1"', () => {
    const a1 = TS_MAINS.find(p => p.key === 'a1')!;
    expect(a1.label).toBe('Anthro P1');
  });

  it('prefixes are unique across all mains papers', () => {
    const prefixes = TS_MAINS.map(p => p.prefix);
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });

  it('all prefixes start with "t"', () => {
    for (const paper of TS_MAINS) {
      expect(paper.prefix.startsWith('t')).toBe(true);
    }
  });

  it('prefixes do not overlap with PRELIMS prefixes', () => {
    const mainsPrefixes = new Set(TS_MAINS.map(p => p.prefix));
    const prelimsPrefixes = TS_PRELIMS.map(p => p.prefix);
    for (const pre of prelimsPrefixes) {
      expect(mainsPrefixes.has(pre)).toBe(false);
    }
  });

  it('all test items are non-empty strings', () => {
    for (const paper of TS_MAINS) {
      for (const item of paper.items) {
        expect(typeof item).toBe('string');
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Total test series data', () => {
  it('combined prelims + mains have 9 papers total', () => {
    expect(TS_PRELIMS.length + TS_MAINS.length).toBe(9);
  });

  it('all paper keys are unique across prelims and mains', () => {
    const allKeys = [...TS_PRELIMS, ...TS_MAINS].map(p => p.key);
    const unique = new Set(allKeys);
    expect(unique.size).toBe(allKeys.length);
  });

  it('all prefixes are unique across prelims and mains', () => {
    const allPrefixes = [...TS_PRELIMS, ...TS_MAINS].map(p => p.prefix);
    const unique = new Set(allPrefixes);
    expect(unique.size).toBe(allPrefixes.length);
  });
});
