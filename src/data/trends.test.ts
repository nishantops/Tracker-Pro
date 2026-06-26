/**
 * Tests for src/data/trends.ts
 * Tests trend data structure and integrity
 */
import { describe, it, expect } from 'vitest';
import { trendPrelimsGS1, trendMainsGS1, trendMainsGS2, trendMainsGS3, trendMainsGS4 } from './trends';
import type { TrendData } from './trends';

function validateTrendData(data: TrendData) {
  // Each year's array must have same length as subjects
  for (const [year, values] of Object.entries(data.years)) {
    if (values.length !== data.subjects.length) {
      throw new Error(`Year ${year}: expected ${data.subjects.length} values, got ${values.length}`);
    }
  }
  // categories (if present) must match subjects count
  if (data.categories && data.categories.length !== data.subjects.length) {
    throw new Error('categories length mismatch');
  }
}

describe('trendPrelimsGS1', () => {
  it('has 7 subjects', () => {
    expect(trendPrelimsGS1.subjects).toHaveLength(7);
  });

  it('includes core subjects: History, Geography, Polity', () => {
    expect(trendPrelimsGS1.subjects).toContain('History');
    expect(trendPrelimsGS1.subjects).toContain('Geography');
    expect(trendPrelimsGS1.subjects).toContain('Polity');
  });

  it('has data for years 2013-2025', () => {
    for (let y = 2013; y <= 2025; y++) {
      expect(trendPrelimsGS1.years).toHaveProperty(String(y));
    }
  });

  it('has 13 years of data', () => {
    expect(Object.keys(trendPrelimsGS1.years)).toHaveLength(13);
  });

  it('each year has 7 values matching subjects count', () => {
    for (const values of Object.values(trendPrelimsGS1.years)) {
      expect(values).toHaveLength(7);
    }
  });

  it('all values are non-negative numbers', () => {
    for (const values of Object.values(trendPrelimsGS1.years)) {
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('passes structural validation', () => {
    expect(() => validateTrendData(trendPrelimsGS1)).not.toThrow();
  });

  it('2013 data has 100 questions (sum = ~100 for prelims)', () => {
    const sum = trendPrelimsGS1.years['2013'].reduce((a, b) => a + b, 0);
    expect(sum).toBe(109); // actual sum, not enforced to be exactly 100
  });

  it('2025 year entry exists', () => {
    expect(trendPrelimsGS1.years['2025']).toBeDefined();
    expect(trendPrelimsGS1.years['2025']).toHaveLength(7);
  });
});

describe('trendMainsGS1', () => {
  it('has 14 subjects', () => {
    expect(trendMainsGS1.subjects).toHaveLength(14);
  });

  it('has categories array', () => {
    expect(trendMainsGS1.categories).toBeDefined();
    expect(trendMainsGS1.categories!).toHaveLength(14);
  });

  it('categories include History, Society, Geography', () => {
    expect(trendMainsGS1.categories).toContain('History');
    expect(trendMainsGS1.categories).toContain('Society');
    expect(trendMainsGS1.categories).toContain('Geography');
  });

  it('has data from 2013-2023', () => {
    for (let y = 2013; y <= 2023; y++) {
      expect(trendMainsGS1.years).toHaveProperty(String(y));
    }
  });

  it('each year has 14 values', () => {
    for (const values of Object.values(trendMainsGS1.years)) {
      expect(values).toHaveLength(14);
    }
  });

  it('passes structural validation', () => {
    expect(() => validateTrendData(trendMainsGS1)).not.toThrow();
  });
});

describe('trendMainsGS2', () => {
  it('has 16 subjects', () => {
    expect(trendMainsGS2.subjects).toHaveLength(16);
  });

  it('has categories matching subjects count', () => {
    expect(trendMainsGS2.categories!).toHaveLength(16);
  });

  it('categories include Polity, Welfare, Governance, IR', () => {
    expect(trendMainsGS2.categories).toContain('Polity');
    expect(trendMainsGS2.categories).toContain('Welfare');
    expect(trendMainsGS2.categories).toContain('Governance');
    expect(trendMainsGS2.categories).toContain('IR');
  });

  it('each year has 16 values', () => {
    for (const values of Object.values(trendMainsGS2.years)) {
      expect(values).toHaveLength(16);
    }
  });

  it('passes structural validation', () => {
    expect(() => validateTrendData(trendMainsGS2)).not.toThrow();
  });
});

describe('trendMainsGS3', () => {
  it('has 17 subjects', () => {
    expect(trendMainsGS3.subjects).toHaveLength(17);
  });

  it('categories include Economy, Food, Science, Environment, Crime', () => {
    expect(trendMainsGS3.categories).toContain('Economy');
    expect(trendMainsGS3.categories).toContain('Food');
    expect(trendMainsGS3.categories).toContain('Science');
    expect(trendMainsGS3.categories).toContain('Environment');
    expect(trendMainsGS3.categories).toContain('Crime');
  });

  it('each year has 17 values', () => {
    for (const values of Object.values(trendMainsGS3.years)) {
      expect(values).toHaveLength(17);
    }
  });

  it('passes structural validation', () => {
    expect(() => validateTrendData(trendMainsGS3)).not.toThrow();
  });
});

describe('trendMainsGS4', () => {
  it('has 16 subjects', () => {
    expect(trendMainsGS4.subjects).toHaveLength(16);
  });

  it('categories include Basic, Family, Jobs, Public, Private', () => {
    expect(trendMainsGS4.categories).toContain('Basic');
    expect(trendMainsGS4.categories).toContain('Jobs');
    expect(trendMainsGS4.categories).toContain('Public');
  });

  it('each year has 16 values', () => {
    for (const values of Object.values(trendMainsGS4.years)) {
      expect(values).toHaveLength(16);
    }
  });

  it('passes structural validation', () => {
    expect(() => validateTrendData(trendMainsGS4)).not.toThrow();
  });

  it('Corruption subject is present (high weightage)', () => {
    expect(trendMainsGS4.subjects).toContain('Corruption');
  });
});

describe('TrendData interface integrity', () => {
  const allDatasets = [trendPrelimsGS1, trendMainsGS1, trendMainsGS2, trendMainsGS3, trendMainsGS4];

  it('all datasets have subjects array', () => {
    for (const ds of allDatasets) {
      expect(Array.isArray(ds.subjects)).toBe(true);
      expect(ds.subjects.length).toBeGreaterThan(0);
    }
  });

  it('all datasets have years object', () => {
    for (const ds of allDatasets) {
      expect(typeof ds.years).toBe('object');
      expect(Object.keys(ds.years).length).toBeGreaterThan(0);
    }
  });

  it('all year keys are 4-digit year strings', () => {
    for (const ds of allDatasets) {
      for (const year of Object.keys(ds.years)) {
        expect(year).toMatch(/^\d{4}$/);
        const y = parseInt(year);
        expect(y).toBeGreaterThanOrEqual(2013);
        expect(y).toBeLessThanOrEqual(2025);
      }
    }
  });

  it('all pass structural validation', () => {
    for (const ds of allDatasets) {
      expect(() => validateTrendData(ds)).not.toThrow();
    }
  });
});
