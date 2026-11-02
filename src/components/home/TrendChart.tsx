import { fmtHM, type TrendPoint } from '../../lib/studyStats';

const W = 340, H = 128, PL = 36, PR = 18, PT = 10, PB = 22;

// Smallest round ceiling (in hours) that fits the data, so the axis reads 1h/2h/5h/10h… not odd numbers
function niceMaxHours(maxSecs: number) {
  const h = Math.max(1, maxSecs / 3600);
  const steps = [1, 2, 4, 5, 8, 10, 12, 16, 20, 24, 40, 60, 80, 100, 150, 200, 300, 400, 600];
  return steps.find((s) => s >= h) ?? Math.ceil(h);
}

const hLabel = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  // A goal far above anything studied would flatten the line, so it only sets the scale when it is within reach
  const maxData = Math.max(...points.map((p) => p.secs), 0);
  const maxGoal = Math.max(...points.map((p) => p.goalSecs), 0);
  const maxH = niceMaxHours(maxData === 0 || maxGoal <= 2.5 * maxData ? Math.max(maxData, maxGoal) : maxData);
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const x = (i: number) => PL + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (secs: number) => PT + innerH - Math.min(1, secs / 3600 / maxH) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.secs).toFixed(1)}`).join(' ');
  const area = points.length > 0 ? `${line} L${x(points.length - 1).toFixed(1)},${PT + innerH} L${x(0).toFixed(1)},${PT + innerH} Z` : '';
  const goalLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.goalSecs).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((f) => f * maxH);
  const every = points.length > 8 ? 2 : 1;

  return (
    <svg className="study-trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Study time per ${unit}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9933" stopOpacity="0.45" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff9933" /><stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={y(t * 3600)} y2={y(t * 3600)} className="study-trend-grid" />
          <text x={PL - 5} y={y(t * 3600) + 3} textAnchor="end" className="study-trend-axis">{hLabel(t)}</text>
        </g>
      ))}
      <path d={goalLine} fill="none" className="study-trend-goal" />
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="url(#trendStroke)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.title}>
          <circle cx={x(i)} cy={y(p.secs)} r={i === points.length - 1 ? 4.5 : 3} className={i === points.length - 1 ? 'study-trend-dot now' : 'study-trend-dot'}>
            <title>{`${p.title}: ${p.secs > 0 ? fmtHM(p.secs) : 'no study'} (goal ${fmtHM(p.goalSecs)})`}</title>
          </circle>
          {(points.length - 1 - i) % every === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" className="study-trend-axis">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
