import { SECTION_COLORS } from '../../data/syllabus';

interface Props {
  getMetrics: (prefix: string) => { total: number; checked: number; pct: number };
  getGlobalMetrics: () => { total: number; checked: number; pct: number };
}

const RING_CIRC = 414.69; // 2 * PI * 66

export function MetricsHUD({ getMetrics, getGlobalMetrics }: Props) {
  const global = getGlobalMetrics();
  const offset = (RING_CIRC * (1 - global.pct / 100)).toFixed(2);

  const sections = ['p1', 'p2', 'gs1', 'gs2', 'gs3', 'gs4', 'a1', 'a2', 'ca'] as const;

  return (
    <div className="metrics-hud">
      {/* Global ring */}
      <div className="metrics-ring-wrap">
        <svg viewBox="0 0 144 144" className="metrics-ring-svg">
          <circle cx="72" cy="72" r="66" fill="none" stroke="var(--surf)" strokeWidth="7" />
          <circle
            cx="72"
            cy="72"
            r="66"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="7"
            strokeDasharray={RING_CIRC.toString()}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 72 72)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="metrics-ring-label">
          <span className="metrics-pct">{global.pct}%</span>
          <span className="metrics-sub">{global.checked}/{global.total}</span>
        </div>
      </div>

      {/* Section mini-pies */}
      <div className="metrics-pies">
        {sections.map((key) => {
          const m = getMetrics(key);
          const c = SECTION_COLORS[key];
          return (
            <div key={key} className="metrics-mini">
              <div
                className="mini-pie"
                style={{
                  background: m.pct > 0
                    ? `conic-gradient(${c.hex} ${m.pct}%, var(--surf) 0%)`
                    : 'var(--surf)',
                  border: m.pct > 0 ? 'none' : `2px solid ${c.hex}33`,
                }}
              />
              <span className="mini-label" style={{ color: c.hex }}>
                {key.toUpperCase()} {m.pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
