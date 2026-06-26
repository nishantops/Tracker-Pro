import { useTheme } from '../../context/ThemeContext';
import type { TrendData } from '../../data/trends';

interface Props {
  data: TrendData;
  title: string;
}

export function TrendTable({ data, title }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const years = Object.keys(data.years).sort();
  const { subjects, categories } = data;
  const hasCats = !!categories?.length;

  // Find hottest topic in latest year
  const lastYear = years[years.length - 1];
  const lastYearData = data.years[lastYear] ?? [];
  const topIdx = lastYearData.indexOf(Math.max(...lastYearData));

  // Theme-aware sticky cell style — escapes dark bg classes in light mode
  const stickyBg: React.CSSProperties = { background: 'var(--surf)' };
  const stickyBgHdr: React.CSSProperties = { background: 'var(--surf)', borderBottom: '2px solid var(--bdr)' };

  let prevCategory = '';

  return (
    <div>
      <h2 className="heading-font text-xl font-black border-b border-violet-500/20 pb-3 mb-4">
        📊 {title}: Topic-wise Trend ({years[0]}-{lastYear})
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono border-collapse">
          <thead>
            <tr>
              {hasCats && (
                <th
                  className="px-2 py-2 text-left font-bold text-violet-300 sticky left-0 z-10"
                  style={stickyBgHdr}
                >
                  Category
                </th>
              )}
              <th
                className={`px-2 py-2 text-left font-bold text-violet-300 sticky ${hasCats ? 'left-[70px]' : 'left-0'} z-10`}
                style={stickyBgHdr}
              >
                Topic
              </th>
              {years.map((y) => (
                <th key={y} className="px-2 py-2 text-center font-bold text-amber-300 border-b border-violet-500/30 min-w-[45px]">
                  {y.slice(-2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj, idx) => {
              const cat = categories?.[idx] ?? '';
              const showCat = cat !== prevCategory;
              prevCategory = cat;

              return (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  {hasCats && (
                    <td
                      className="px-2 py-1.5 border-b border-[var(--bdr)] sticky left-0 z-10"
                      style={stickyBg}
                    >
                      {showCat && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">
                          {cat}
                        </span>
                      )}
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 border-b border-[var(--bdr)] font-semibold text-slate-200 sticky ${hasCats ? 'left-[70px]' : 'left-0'} z-10 max-w-[180px] truncate`}
                    style={stickyBg}
                    title={subj}
                  >
                    {subj}
                  </td>
                  {years.map((y) => {
                    const val = data.years[y]?.[idx] ?? 0;
                    const intensity = val > 0 ? Math.min(val / 60, 1) : 0;
                    const bgColor = val > 0
                      ? `rgba(99, 102, 241, ${isLight ? 0.07 + intensity * 0.25 : 0.1 + intensity * 0.5})`
                      : 'transparent';
                    const textColor = val > 0
                      ? (intensity > 0.4
                          ? (isLight ? '#1e1248' : '#fff')
                          : (isLight ? '#3730a3' : '#c7d2fe'))
                      : (isLight ? '#9e90c8' : '#64748b');

                    return (
                      <td
                        key={y}
                        className="px-1 py-1.5 text-center border-b border-[var(--bdr)] font-bold rounded"
                        style={{ background: bgColor, color: textColor }}
                      >
                        {val || '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-400 uppercase font-bold">Latest Year</div>
          <div className="text-sm font-black text-indigo-300">{lastYear}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-400 uppercase font-bold">Hottest Topic</div>
          <div className="text-[10px] font-bold text-emerald-300 truncate">{subjects[topIdx]}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-400 uppercase font-bold">Years Covered</div>
          <div className="text-sm font-black text-amber-300">{years.length}</div>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-400 uppercase font-bold">Topics Tracked</div>
          <div className="text-sm font-black text-rose-400">{subjects.length}</div>
        </div>
      </div>
    </div>
  );
}
