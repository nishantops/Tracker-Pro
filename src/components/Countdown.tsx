import { useState, useEffect } from 'react';
import { ENV } from '../lib/env';
import { useTracker } from '../hooks/useTracker';

interface Props {
  onClearProgress?: () => void;
}

export function Countdown({ onClearProgress }: Props) {
  const [prelims, setPrelims] = useState('--- Days');
  const [mains, setMains] = useState('--- Days');
  const { getGlobalMetrics } = useTracker();

  // Calculate from progress map (includes custom topics)
  const metrics = getGlobalMetrics();
  const totalTopics = metrics.total;
  const totalChecked = metrics.checked;
  const globalPerc = totalTopics > 0 ? ((totalChecked / totalTopics) * 100) : 0;
  const percText = globalPerc.toFixed(1) + '%';

  // SVG ring math
  const circumference = 2 * Math.PI * 66; // ~414.69
  const dashoffset = circumference - (circumference * globalPerc) / 100;

  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const pd = new Date(ENV.PRELIMS_DATE).getTime() - now;
      const md = new Date(ENV.MAINS_DATE).getTime() - now;

      const format = (ms: number) => {
        if (ms <= 0) return 'DONE';
        const d = Math.floor(ms / 86_400_000);
        return `${d} Days`;
      };

      setPrelims(format(pd));
      setMains(format(md));
    };

    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Global Syllabus Absorption */}
      <div className="neo-card rounded-3xl p-6 border-l-4 border-violet-500 flex flex-col justify-between relative overflow-hidden glow-violet animate-in" style={{ animationDelay: '0.1s' }}>
        {/* SVG progress ring */}
        <svg className="absorption-ring" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="80" cy="80" r="66" fill="none" stroke="rgba(139,92,246,0.14)" strokeWidth="9" />
          <circle
            id="global-ring-progress"
            cx="80" cy="80" r="66"
            fill="none"
            stroke="url(#ringGradMain)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 80 80)"
          />
          <defs>
            <linearGradient id="ringGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <span className="abs-orb abs-orb1" />
        <span className="abs-orb abs-orb2" />
        <div>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--t3)' }}>Global Syllabus Absorption</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md font-mono" style={{ background: 'var(--surf)', color: 'var(--t3)', border: '1px solid var(--bdr)' }}>
                {percText} MATRIX
              </span>
              <button
                id="clear-progress-btn"
                onClick={onClearProgress}
                title="Reset all syllabus progress"
                style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
              >
                ↻
              </button>
            </div>
          </div>
          <div className="heading-font text-5xl font-black gradient-text-animated tracking-tight my-1">
            {percText}
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full rounded-full h-3 overflow-hidden mb-2" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${globalPerc}%`,
                background: 'linear-gradient(90deg,#6366f1,#a855f7,#ec4899)',
              }}
            />
          </div>
          <div className="text-[11px] flex justify-between items-center font-mono" style={{ color: 'var(--t4)' }}>
            <span>
              CHECKED UNITS: <strong style={{ color: 'var(--t3)', fontWeight: 700 }}>{totalChecked}</strong> / {totalTopics}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Prelims Countdown */}
      <div className="neo-card rounded-3xl p-6 flex flex-col justify-between border-l-4 border-amber-400 relative overflow-hidden glow-amber animate-in" style={{ animationDelay: '0.2s' }}>
        <span className="countdown-orb countdown-orb-amber" />
        <div>
          <span className="text-[10px] uppercase font-bold text-amber-300/80 tracking-widest font-mono block mb-1">Live Target Delta</span>
          <div className="heading-font text-xl font-black" style={{ color: 'var(--t1)' }}>UPSC CSE Prelims 2027</div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t4)' }}>Target Horizon: May 23, 2027</p>
        </div>
        <div className="mt-6 pt-3 border-t border-amber-500/20 flex items-baseline justify-between">
          <div id="prelims-countdown-live" className="text-4xl font-mono font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent tracking-tight">
            {prelims}
          </div>
        </div>
      </div>

      {/* Card 3: Mains Countdown */}
      <div className="neo-card rounded-3xl p-6 flex flex-col justify-between border-l-4 border-rose-400 relative overflow-hidden glow-rose animate-in" style={{ animationDelay: '0.3s' }}>
        <span className="countdown-orb countdown-orb-rose" />
        <div>
          <span className="text-[10px] uppercase font-bold text-rose-300/80 tracking-widest font-mono block mb-1">Live Target Delta</span>
          <div className="heading-font text-xl font-black" style={{ color: 'var(--t1)' }}>UPSC CSE Mains Phase 2027</div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t4)' }}>Estimated Inception: August 20, 2027</p>
        </div>
        <div className="mt-6 pt-3 border-t border-rose-500/20 flex items-baseline justify-between">
          <div id="mains-countdown-live" className="text-4xl font-mono font-black bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
            {mains}
          </div>
        </div>
      </div>
    </div>
  );
}
