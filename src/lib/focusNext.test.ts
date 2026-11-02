import { describe, it, expect } from 'vitest';
import { keywordsOf, suggestTopics } from './focusNext';
import type { SyllabusStage } from '../data/syllabus';

const stages: SyllabusStage[] = [
  { id: 's1', label: 'Stage', sections: [
    { key: 'gs2', label: 'GS Paper II', topics: ['Indian Polity: Parliament and federalism', 'Judiciary and constitutional bodies', 'International relations: India and neighbours'] },
    { key: 'gs3', label: 'GS Paper III', topics: ['Indian economy: growth and inflation', 'Science and technology developments'] },
  ] },
];
const none = { get: () => undefined };
const done = (ids: string[]) => ({ get: (id: string) => (ids.includes(id) ? { is_checked: true } : undefined) });

describe('keywordsOf', () => {
  it('keeps meaningful words of 4+ letters, lower-cased and unique', () => {
    expect(keywordsOf('Polity, polity and the Economy!')).toEqual(['polity', 'economy']);
  });
  it('drops filler words', () => {
    expect(keywordsOf('too much mobile overuse')).toEqual(['mobile', 'overuse']);
  });
});

describe('suggestTopics', () => {
  it('matches subject-style weaknesses to unchecked topics', () => {
    const p = suggestTopics(['Economy'], none, stages);
    expect(p.reason).toBe('weakness');
    expect(p.suggestions[0]).toMatchObject({ id: 'uid-gs3-0', section: 'GS Paper III', match: 'Economy' });
  });

  it('skips topics that are already ticked', () => {
    const p = suggestTopics(['Polity'], done(['uid-gs2-0']), stages);
    expect(p.suggestions.map((s) => s.id)).not.toContain('uid-gs2-0');
  });

  it('ranks topics matching more keywords first', () => {
    const p = suggestTopics(['federalism parliament'], none, stages);
    expect(p.suggestions[0].id).toBe('uid-gs2-0');
  });

  it('respects the limit and never repeats a topic', () => {
    const p = suggestTopics(['Indian', 'India'], none, stages, 2);
    expect(p.suggestions).toHaveLength(2);
    expect(new Set(p.suggestions.map((s) => s.id)).size).toBe(2);
  });

  it('falls back to the least-covered section for habit-type weaknesses', () => {
    const p = suggestTopics(['Mobile overuse', 'Getting carried away'], done(['uid-gs2-0', 'uid-gs2-1']), stages);
    expect(p.reason).toBe('least-covered');
    expect(p.area).toBe('GS Paper III');
    expect(p.suggestions[0].id).toBe('uid-gs3-0');
  });

  it('with no weaknesses at all it also suggests the least-covered section', () => {
    expect(suggestTopics([], none, stages).reason).toBe('least-covered');
  });

  it('says done when every topic is ticked', () => {
    const all = done(['uid-gs2-0', 'uid-gs2-1', 'uid-gs2-2', 'uid-gs3-0', 'uid-gs3-1']);
    expect(suggestTopics(['Economy'], all, stages)).toEqual({ suggestions: [], reason: 'done' });
  });

  it('clips very long topic text', () => {
    const long: SyllabusStage[] = [{ id: 'x', label: 'x', sections: [{ key: 'a', label: 'A', topics: ['polity ' + 'x'.repeat(300)] }] }];
    const s = suggestTopics(['polity'], none, long).suggestions[0].text;
    expect(s.length).toBeLessThanOrEqual(110);
    expect(s.endsWith('…')).toBe(true);
  });
});
