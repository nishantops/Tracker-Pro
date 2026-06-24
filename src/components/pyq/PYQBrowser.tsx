import { useState, useMemo } from 'react';
import {
  pyqGS1Data,
  pyqCSATData,
  pyqAnthroP1Data,
  pyqAnthroP2Data,
  pyqMainsGS1Data,
  pyqMainsGS2Data,
  pyqMainsGS3Data,
  pyqMainsGS4Data,
  pyqEssayData,
} from '../../data/pyq-data';
import { PYQ_SECTION_LABELS, type PYQSection } from '../../data/pyq-types';

const DATA_MAP: Record<PYQSection, unknown[]> = {
  gs1: pyqGS1Data,
  csat: pyqCSATData,
  anthro_p1: pyqAnthroP1Data,
  anthro_p2: pyqAnthroP2Data,
  mains_gs1: pyqMainsGS1Data,
  mains_gs2: pyqMainsGS2Data,
  mains_gs3: pyqMainsGS3Data,
  mains_gs4: pyqMainsGS4Data,
  essay: pyqEssayData,
};

const SECTIONS: PYQSection[] = [
  'gs1', 'csat', 'mains_gs1', 'mains_gs2', 'mains_gs3', 'mains_gs4',
  'anthro_p1', 'anthro_p2', 'essay',
];

interface TopicLike {
  name: string;
  subtopics?: { name: string; questions: QuestionLike[] }[];
  questions?: QuestionLike[];
}

interface QuestionLike {
  question: string;
  year: string;
  number?: number | string;
  marks?: string;
  options?: Record<string, string>;
  answer?: string;
  passage?: string;
}

export function PYQBrowser() {
  const [section, setSection] = useState<PYQSection>('gs1');
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  const topics = DATA_MAP[section] as TopicLike[];

  // Collect all unique years for filter
  const years = useMemo(() => {
    const ys = new Set<string>();
    topics.forEach((t) => {
      const qs = t.questions ?? t.subtopics?.flatMap((s) => s.questions) ?? [];
      qs.forEach((q) => ys.add(q.year));
    });
    return Array.from(ys).sort().reverse();
  }, [topics]);

  const toggleAnswer = (key: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filterQs = (qs: QuestionLike[]) =>
    yearFilter ? qs.filter((q) => q.year === yearFilter) : qs;

  return (
    <div className="pyq-view">
      {/* Section picker */}
      <div className="pyq-sections">
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={`pyq-sec-btn ${s === section ? 'pyq-sec-active' : ''}`}
            onClick={() => { setSection(s); setExpandedTopic(null); setYearFilter(''); setRevealedAnswers(new Set()); }}
          >
            {PYQ_SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Year filter */}
      <div className="pyq-filters">
        <select
          className="auth-input"
          style={{ width: 'auto', minWidth: 120 }}
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="pyq-count">
          {topics.length} topics · {PYQ_SECTION_LABELS[section]}
        </span>
      </div>

      {/* Topics */}
      {topics.map((topic, ti) => {
        const allQs: { sub?: string; q: QuestionLike }[] = [];
        if (topic.subtopics) {
          topic.subtopics.forEach((st) => filterQs(st.questions).forEach((q) => allQs.push({ sub: st.name, q })));
        } else if (topic.questions) {
          filterQs(topic.questions).forEach((q) => allQs.push({ q }));
        }
        if (allQs.length === 0 && yearFilter) return null;

        return (
          <div key={ti} className="pyq-topic">
            <button className="pyq-topic-header" onClick={() => setExpandedTopic(expandedTopic === ti ? null : ti)}>
              <span className="section-chevron">{expandedTopic === ti ? '▾' : '▸'}</span>
              <span className="pyq-topic-name">{topic.name}</span>
              <span className="pyq-topic-count">{allQs.length} Q</span>
            </button>

            {expandedTopic === ti && (
              <div className="pyq-questions">
                {allQs.map(({ sub, q }, qi) => {
                  const key = `${section}-${ti}-${qi}`;
                  const hasOptions = q.options && Object.keys(q.options).length > 0;
                  const isRevealed = revealedAnswers.has(key);

                  return (
                    <div key={qi} className="pyq-q-card">
                      <div className="pyq-q-meta">
                        <span className="pyq-year">{q.year}</span>
                        {q.marks && <span className="pyq-marks">{q.marks}m</span>}
                        {sub && <span className="pyq-sub">{sub}</span>}
                      </div>

                      {q.passage && (
                        <div className="pyq-passage" dangerouslySetInnerHTML={{ __html: q.passage }} />
                      )}

                      <p className="pyq-q-text" dangerouslySetInnerHTML={{ __html: q.question }} />

                      {hasOptions && (
                        <div className="pyq-options">
                          {Object.entries(q.options!).map(([k, v]) => (
                            <div
                              key={k}
                              className={`pyq-option ${isRevealed && q.answer === k ? 'pyq-correct' : ''}`}
                            >
                              <span className="pyq-opt-key">{k})</span> {v}
                            </div>
                          ))}
                        </div>
                      )}

                      {q.answer && (
                        <button className="pyq-reveal" onClick={() => toggleAnswer(key)}>
                          {isRevealed ? `Answer: ${q.answer.toUpperCase()}` : 'Show Answer'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
