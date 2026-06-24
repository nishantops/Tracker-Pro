import { useState, useEffect } from 'react';
import { ENV } from '../lib/env';

export function Countdown() {
  const [prelims, setPrelims] = useState('');
  const [mains, setMains] = useState('');

  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const pd = new Date(ENV.PRELIMS_DATE).getTime() - now;
      const md = new Date(ENV.MAINS_DATE).getTime() - now;

      const format = (ms: number) => {
        if (ms <= 0) return 'DONE';
        const d = Math.floor(ms / 86_400_000);
        const h = Math.floor((ms % 86_400_000) / 3_600_000);
        return `${d}d ${h}h`;
      };

      setPrelims(format(pd));
      setMains(format(md));
    };

    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="countdown-row">
      <span className="countdown-chip countdown-prelims">
        <span className="countdown-label">Prelims</span>
        <span className="countdown-value">{prelims}</span>
      </span>
      <span className="countdown-chip countdown-mains">
        <span className="countdown-label">Mains</span>
        <span className="countdown-value">{mains}</span>
      </span>
    </div>
  );
}
