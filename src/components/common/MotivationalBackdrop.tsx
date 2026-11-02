import { useEffect, useState } from 'react';

interface Quote { text: string; by?: string }

const QUOTES: Quote[] = [
  { text: 'Arise, awake, and stop not till the goal is reached.', by: 'Swami Vivekananda' },
  { text: 'Dream, dream, dream. Dreams transform into thoughts, and thoughts result in action.', by: 'A. P. J. Abdul Kalam' },
  { text: 'If you want to shine like a sun, first burn like a sun.', by: 'A. P. J. Abdul Kalam' },
  { text: 'The future depends on what you do today.', by: 'Mahatma Gandhi' },
  { text: 'Be the change that you wish to see in the world.', by: 'Mahatma Gandhi' },
  { text: 'Consistency beats intensity.' },
  { text: 'One more revision. One more answer. One step closer.' },
  { text: 'Discipline today, the uniform tomorrow.' },
  { text: 'You do not need to be perfect. You need to be present, every single day.' },
  { text: 'Small hours, daily, build the rank that big hours never will.' },
  { text: 'Read it. Write it. Revise it. Repeat.' },
  { text: 'The syllabus is finite. Your persistence is not.' },
  { text: 'Every topic you close is a mark you will not lose.' },
  { text: 'Tired is temporary. Rank is permanent.' },
  { text: 'Trust the process. Show up. Do the work.' },
  { text: 'Answer writing is a skill. Skills are built by practice, not by waiting.' },
];

const ROTATE_MS = 14_000;

function shuffled(): Quote[] {
  const a = [...QUOTES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MotivationalBackdrop() {
  const [order] = useState<Quote[]>(shuffled);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % order.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [order.length]);

  const q = order[idx];
  return (
    <div className="motivation-backdrop" aria-hidden="true">
      <div key={idx} className="motivation-quote">
        <p className="motivation-text">&ldquo;{q.text}&rdquo;</p>
        {q.by && <p className="motivation-by">&mdash; {q.by}</p>}
      </div>
    </div>
  );
}
