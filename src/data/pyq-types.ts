// ── PYQ Data Types ───────────────────────────────────────────────────────────

/** MCQ question (Prelims GS1, CSAT) */
export interface PYQQuestion {
  number: number;
  year: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  passage?: string;
}

/** Mains subjective question */
export interface MainsQuestion {
  number: string;
  year: string;
  question: string;
  marks: string;
}

/** Essay question */
export interface EssayQuestion {
  year: string;
  question: string;
  number: string;
}

export interface PYQSubtopic {
  name: string;
  questions: PYQQuestion[];
}

export interface PYQTopic {
  name: string;
  subtopics?: PYQSubtopic[];
  questions?: (MainsQuestion | PYQQuestion)[];
}

export type PYQSection =
  | 'gs1'
  | 'csat'
  | 'anthro_p1'
  | 'anthro_p2'
  | 'mains_gs1'
  | 'mains_gs2'
  | 'mains_gs3'
  | 'mains_gs4'
  | 'essay';

export const PYQ_SECTION_LABELS: Record<PYQSection, string> = {
  gs1: 'Prelims GS1',
  csat: 'Prelims CSAT',
  anthro_p1: 'Anthro Paper I',
  anthro_p2: 'Anthro Paper II',
  mains_gs1: 'Mains GS I',
  mains_gs2: 'Mains GS II',
  mains_gs3: 'Mains GS III',
  mains_gs4: 'Mains GS IV',
  essay: 'Mains Essay',
};
