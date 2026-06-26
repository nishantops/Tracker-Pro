/**
 * Tests for src/data/pyq-types.ts
 * Tests PYQ type constants and labels
 */
import { describe, it, expect } from 'vitest';
import { PYQ_SECTION_LABELS } from './pyq-types';
import type { PYQSection } from './pyq-types';

describe('PYQ_SECTION_LABELS', () => {
  const allSections: PYQSection[] = [
    'gs1', 'csat', 'anthro_p1', 'anthro_p2',
    'mains_gs1', 'mains_gs2', 'mains_gs3', 'mains_gs4', 'essay'
  ];

  it('has entries for all 9 sections', () => {
    expect(Object.keys(PYQ_SECTION_LABELS)).toHaveLength(9);
  });

  it('has all required section keys', () => {
    for (const section of allSections) {
      expect(PYQ_SECTION_LABELS).toHaveProperty(section);
    }
  });

  it('gs1 label is "GS Paper I" (matching old app)', () => {
    expect(PYQ_SECTION_LABELS.gs1).toBe('GS Paper I');
  });

  it('csat label is "CSAT Paper II" (matching old app)', () => {
    expect(PYQ_SECTION_LABELS.csat).toBe('CSAT Paper II');
  });

  it('anthro_p1 label is "Anthro Paper I"', () => {
    expect(PYQ_SECTION_LABELS.anthro_p1).toBe('Anthro Paper I');
  });

  it('anthro_p2 label is "Anthro Paper II"', () => {
    expect(PYQ_SECTION_LABELS.anthro_p2).toBe('Anthro Paper II');
  });

  it('mains_gs1 label is "Mains GS I"', () => {
    expect(PYQ_SECTION_LABELS.mains_gs1).toBe('Mains GS I');
  });

  it('mains_gs2 label is "Mains GS II"', () => {
    expect(PYQ_SECTION_LABELS.mains_gs2).toBe('Mains GS II');
  });

  it('mains_gs3 label is "Mains GS III"', () => {
    expect(PYQ_SECTION_LABELS.mains_gs3).toBe('Mains GS III');
  });

  it('mains_gs4 label is "Mains GS IV"', () => {
    expect(PYQ_SECTION_LABELS.mains_gs4).toBe('Mains GS IV');
  });

  it('essay label is "Mains Essay"', () => {
    expect(PYQ_SECTION_LABELS.essay).toBe('Mains Essay');
  });

  it('all labels are non-empty strings', () => {
    for (const section of allSections) {
      const label = PYQ_SECTION_LABELS[section];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('no two sections have the same label', () => {
    const labels = Object.values(PYQ_SECTION_LABELS);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('prelims sections use "Paper" in the label', () => {
    expect(PYQ_SECTION_LABELS.gs1).toContain('Paper');
    expect(PYQ_SECTION_LABELS.csat).toContain('Paper');
  });

  it('mains sections use "Mains" prefix', () => {
    expect(PYQ_SECTION_LABELS.mains_gs1).toContain('Mains');
    expect(PYQ_SECTION_LABELS.mains_gs2).toContain('Mains');
    expect(PYQ_SECTION_LABELS.mains_gs3).toContain('Mains');
    expect(PYQ_SECTION_LABELS.mains_gs4).toContain('Mains');
    expect(PYQ_SECTION_LABELS.essay).toContain('Mains');
  });
});
