/**
 * Tests for src/data/syllabus.ts
 * Tests all exported data structures and constants
 */
import { describe, it, expect } from 'vitest';
import { STAGES, CA_SECTION, SECTION_COLORS } from './syllabus';

describe('STAGES data', () => {
  it('exports 3 stages: prelims, mains, anthro', () => {
    expect(STAGES).toHaveLength(3);
    expect(STAGES.map(s => s.id)).toEqual(['prelims', 'mains', 'anthro']);
  });

  it('each stage has id, label, and sections array', () => {
    for (const stage of STAGES) {
      expect(stage.id).toBeTruthy();
      expect(stage.label).toBeTruthy();
      expect(Array.isArray(stage.sections)).toBe(true);
      expect(stage.sections.length).toBeGreaterThan(0);
    }
  });

  it('each section has key, label, and topics array', () => {
    for (const stage of STAGES) {
      for (const section of stage.sections) {
        expect(section.key).toBeTruthy();
        expect(section.label).toBeTruthy();
        expect(Array.isArray(section.topics)).toBe(true);
        expect(section.topics.length).toBeGreaterThan(0);
      }
    }
  });

  describe('Stage I: Prelims', () => {
    const prelims = STAGES.find(s => s.id === 'prelims')!;

    it('has exactly 2 sections: p1, p2', () => {
      expect(prelims.sections).toHaveLength(2);
      expect(prelims.sections.map(s => s.key)).toEqual(['p1', 'p2']);
    });

    it('p1 has 7 topics', () => {
      const p1 = prelims.sections.find(s => s.key === 'p1')!;
      expect(p1.topics).toHaveLength(7);
    });

    it('p2 has 7 topics', () => {
      const p2 = prelims.sections.find(s => s.key === 'p2')!;
      expect(p2.topics).toHaveLength(7);
    });

    it('p1 first topic contains "Current Events"', () => {
      const p1 = prelims.sections.find(s => s.key === 'p1')!;
      expect(p1.topics[0]).toContain('Current Events');
    });

    it('p1 label is "GS Paper I"', () => {
      const p1 = prelims.sections.find(s => s.key === 'p1')!;
      expect(p1.label).toBe('GS Paper I');
    });
  });

  describe('Stage II: Mains', () => {
    const mains = STAGES.find(s => s.id === 'mains')!;

    it('has 7 sections: la, lb, es, gs1, gs2, gs3, gs4', () => {
      expect(mains.sections.map(s => s.key)).toEqual(['la', 'lb', 'es', 'gs1', 'gs2', 'gs3', 'gs4']);
    });

    it('gs1 has 12 topics', () => {
      const gs1 = mains.sections.find(s => s.key === 'gs1')!;
      expect(gs1.topics).toHaveLength(12);
    });

    it('gs2 has 20 topics', () => {
      const gs2 = mains.sections.find(s => s.key === 'gs2')!;
      expect(gs2.topics).toHaveLength(20);
    });

    it('gs3 has 20 topics', () => {
      const gs3 = mains.sections.find(s => s.key === 'gs3')!;
      expect(gs3.topics).toHaveLength(20);
    });

    it('gs4 has 8 topics', () => {
      const gs4 = mains.sections.find(s => s.key === 'gs4')!;
      expect(gs4.topics).toHaveLength(8);
    });

    it('gs1 label is "GS Paper I"', () => {
      const gs1 = mains.sections.find(s => s.key === 'gs1')!;
      expect(gs1.label).toBe('GS Paper I');
    });

    it('gs4 label contains "Ethics"', () => {
      const gs4 = mains.sections.find(s => s.key === 'gs4')!;
      expect(gs4.label).toContain('Ethics');
    });
  });

  describe('Stage III: Optional (Anthro)', () => {
    const anthro = STAGES.find(s => s.id === 'anthro')!;

    it('has 2 sections: a1, a2', () => {
      expect(anthro.sections.map(s => s.key)).toEqual(['a1', 'a2']);
    });

    it('a1 has 30 topics', () => {
      const a1 = anthro.sections.find(s => s.key === 'a1')!;
      expect(a1.topics).toHaveLength(30);
    });

    it('a2 has 23 topics', () => {
      const a2 = anthro.sections.find(s => s.key === 'a2')!;
      expect(a2.topics).toHaveLength(23);
    });
  });

  it('total core topics across all stages is 130', () => {
    let total = 0;
    for (const stage of STAGES) {
      for (const section of stage.sections) {
        total += section.topics.length;
      }
    }
    expect(total).toBe(130);
  });

  it('all topics are non-empty strings', () => {
    for (const stage of STAGES) {
      for (const section of stage.sections) {
        for (const topic of section.topics) {
          expect(typeof topic).toBe('string');
          expect(topic.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('section keys are unique across all stages', () => {
    const keys = STAGES.flatMap(s => s.sections.map(sec => sec.key));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe('CA_SECTION data', () => {
  it('has key "ca"', () => {
    expect(CA_SECTION.key).toBe('ca');
  });

  it('has label "Current Affairs"', () => {
    expect(CA_SECTION.label).toBe('Current Affairs');
  });

  it('has 13 CA topics', () => {
    expect(CA_SECTION.topics).toHaveLength(13);
  });

  it('first topic is May 2026 Monthly Compilation', () => {
    expect(CA_SECTION.topics[0]).toBe('May 2026 Monthly Compilation');
  });

  it('last topic is May 2027 (Pre-Exam Update)', () => {
    expect(CA_SECTION.topics[12]).toBe('May 2027 (Pre-Exam Update)');
  });

  it('all CA topics are non-empty strings', () => {
    for (const topic of CA_SECTION.topics) {
      expect(typeof topic).toBe('string');
      expect(topic.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains monthly compilations for all 12 months May26 to Apr27', () => {
    const months = ['May 2026', 'June 2026', 'July 2026', 'August 2026',
      'September 2026', 'October 2026', 'November 2026', 'December 2026',
      'January 2027', 'February 2027', 'March 2027', 'April 2027'];
    for (const month of months) {
      expect(CA_SECTION.topics.some(t => t.includes(month))).toBe(true);
    }
  });
});

describe('SECTION_COLORS', () => {
  const expectedSections = ['p1', 'p2', 'gs1', 'gs2', 'gs3', 'gs4', 'a1', 'a2', 'ca'];

  it('has entries for all expected sections', () => {
    for (const key of expectedSections) {
      expect(SECTION_COLORS).toHaveProperty(key);
    }
  });

  it('each color entry has hex, bg, and text fields', () => {
    for (const key of expectedSections) {
      const color = SECTION_COLORS[key];
      expect(color).toHaveProperty('hex');
      expect(color).toHaveProperty('bg');
      expect(color).toHaveProperty('text');
    }
  });

  it('hex values start with #', () => {
    for (const key of expectedSections) {
      expect(SECTION_COLORS[key].hex).toMatch(/^#/);
    }
  });

  it('ca section has teal color scheme', () => {
    expect(SECTION_COLORS.ca.hex).toContain('#14b8');
  });

  it('p1 section has indigo/violet color scheme', () => {
    expect(SECTION_COLORS.p1.hex).toContain('#6366');
  });

  it('all hex colors are valid 7-char hex strings', () => {
    for (const key of expectedSections) {
      expect(SECTION_COLORS[key].hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
