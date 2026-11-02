import { useEffect, useState } from 'react';
import { QUOTES, type Quote } from '../../data/quotes';

export const QUOTE_ROTATE_MS = 60_000;

const DEVANAGARI = /[\u0900-\u097F]/;

function shuffled(): Quote[] {
  const a = [...QUOTES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MotivationalQuote() {
  const [order] = useState<Quote[]>(shuffled);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % order.length), QUOTE_ROTATE_MS);
    return () => clearInterval(id);
  }, [order.length]);

  const q = order[idx];
  const sacred = DEVANAGARI.test(q.text);
  return (
    <div className="motivation-banner" role="note" aria-live="off">
      <span className="motivation-banner-icon" aria-hidden="true">{sacred ? '🕉️' : '💡'}</span>
      <div key={idx} className="motivation-quote">
        <p className={`motivation-text${sacred ? ' motivation-sacred' : ''}`}>{sacred ? q.text : <>&ldquo;{q.text}&rdquo;</>}</p>
        {q.meaning && <p className="motivation-meaning">{q.meaning}</p>}
        {q.by && <p className="motivation-by">&mdash; {q.by}</p>}
      </div>
    </div>
  );
}
