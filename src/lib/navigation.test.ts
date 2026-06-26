/**
 * Tests for src/lib/navigation.ts
 * Tests navigation state types and defaults
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_NAV } from './navigation';
import type { NavState, RootTab, MarathonTab, PlannerTab, StageTab } from './navigation';

describe('DEFAULT_NAV', () => {
  it('root tab defaults to "marathon"', () => {
    expect(DEFAULT_NAV.root).toBe('marathon');
  });

  it('marathon sub-tab defaults to "syllabus"', () => {
    expect(DEFAULT_NAV.marathon).toBe('syllabus');
  });

  it('planner sub-tab defaults to "plans"', () => {
    expect(DEFAULT_NAV.planner).toBe('plans');
  });

  it('stage defaults to "prelims"', () => {
    expect(DEFAULT_NAV.stage).toBe('prelims');
  });

  it('has exactly 4 properties', () => {
    expect(Object.keys(DEFAULT_NAV)).toHaveLength(4);
  });

  it('conforms to NavState interface', () => {
    const nav: NavState = DEFAULT_NAV;
    expect(nav.root).toBeTruthy();
    expect(nav.marathon).toBeTruthy();
    expect(nav.planner).toBeTruthy();
    expect(nav.stage).toBeTruthy();
  });
});

describe('RootTab type values', () => {
  const validRootTabs: RootTab[] = ['marathon', 'planner'];

  it('marathon is a valid RootTab', () => {
    expect(validRootTabs).toContain('marathon');
  });

  it('planner is a valid RootTab', () => {
    expect(validRootTabs).toContain('planner');
  });

  it('has exactly 2 root tabs', () => {
    expect(validRootTabs).toHaveLength(2);
  });
});

describe('MarathonTab type values', () => {
  const validMarathonTabs: MarathonTab[] = ['syllabus', 'ca', 'pyq', 'testseries'];

  it('syllabus is a valid MarathonTab', () => {
    expect(validMarathonTabs).toContain('syllabus');
  });

  it('ca is a valid MarathonTab', () => {
    expect(validMarathonTabs).toContain('ca');
  });

  it('pyq is a valid MarathonTab', () => {
    expect(validMarathonTabs).toContain('pyq');
  });

  it('testseries is a valid MarathonTab', () => {
    expect(validMarathonTabs).toContain('testseries');
  });

  it('has exactly 4 marathon tabs', () => {
    expect(validMarathonTabs).toHaveLength(4);
  });
});

describe('PlannerTab type values', () => {
  const validPlannerTabs: PlannerTab[] = ['master', 'plans', 'sources'];

  it('master is a valid PlannerTab', () => {
    expect(validPlannerTabs).toContain('master');
  });

  it('plans is a valid PlannerTab', () => {
    expect(validPlannerTabs).toContain('plans');
  });

  it('sources is a valid PlannerTab', () => {
    expect(validPlannerTabs).toContain('sources');
  });

  it('has exactly 3 planner tabs', () => {
    expect(validPlannerTabs).toHaveLength(3);
  });
});

describe('StageTab type values', () => {
  const validStageTabs: StageTab[] = ['prelims', 'mains', 'anthro'];

  it('prelims is a valid StageTab', () => {
    expect(validStageTabs).toContain('prelims');
  });

  it('mains is a valid StageTab', () => {
    expect(validStageTabs).toContain('mains');
  });

  it('anthro is a valid StageTab', () => {
    expect(validStageTabs).toContain('anthro');
  });

  it('has exactly 3 stage tabs', () => {
    expect(validStageTabs).toHaveLength(3);
  });
});

describe('NavState partial update pattern', () => {
  it('can spread update root tab', () => {
    const nav: NavState = { ...DEFAULT_NAV, root: 'planner' };
    expect(nav.root).toBe('planner');
    expect(nav.marathon).toBe(DEFAULT_NAV.marathon); // unchanged
  });

  it('can spread update marathon tab', () => {
    const nav: NavState = { ...DEFAULT_NAV, marathon: 'pyq' };
    expect(nav.marathon).toBe('pyq');
    expect(nav.root).toBe(DEFAULT_NAV.root); // unchanged
  });

  it('can spread update stage', () => {
    const nav: NavState = { ...DEFAULT_NAV, stage: 'anthro' };
    expect(nav.stage).toBe('anthro');
  });

  it('DEFAULT_NAV is immutable after spread', () => {
    const nav = { ...DEFAULT_NAV, root: 'planner' as RootTab };
    expect(nav.root).toBe('planner');
    expect(DEFAULT_NAV.root).toBe('marathon'); // original unchanged
  });
});
