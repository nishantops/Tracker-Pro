// ── Navigation state types ───────────────────────────────────────────────────
export type RootTab = 'marathon' | 'planner';
export type MarathonTab = 'syllabus' | 'ca' | 'pyq' | 'testseries';
export type PlannerTab = 'master' | 'plans' | 'sources';
export type StageTab = 'prelims' | 'mains' | 'anthro';

export interface NavState {
  root: RootTab;
  marathon: MarathonTab;
  planner: PlannerTab;
  stage: StageTab;
}

export const DEFAULT_NAV: NavState = {
  root: 'marathon',
  marathon: 'syllabus',
  planner: 'master',
  stage: 'prelims',
};
