import { useEffect, useState } from 'react';

interface Quote { text: string; by?: string }

const QUOTES: Quote[] = [
  { text: 'Arise, awake, and stop not till the goal is reached.', by: 'Swami Vivekananda' },
  { text: 'Take up one idea. Make that one idea your life; dream of it, think of it, live on that idea.', by: 'Swami Vivekananda' },
  { text: 'You cannot believe in God until you believe in yourself.', by: 'Swami Vivekananda' },
  { text: 'Dream, dream, dream. Dreams transform into thoughts, and thoughts result in action.', by: 'A. P. J. Abdul Kalam' },
  { text: 'If you want to shine like a sun, first burn like a sun.', by: 'A. P. J. Abdul Kalam' },
  { text: 'Excellence is a continuous process and not an accident.', by: 'A. P. J. Abdul Kalam' },
  { text: 'Dream is not that which you see while sleeping; it is something that does not let you sleep.', by: 'A. P. J. Abdul Kalam' },
  { text: 'The future depends on what you do today.', by: 'Mahatma Gandhi' },
  { text: 'Be the change that you wish to see in the world.', by: 'Mahatma Gandhi' },
  { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', by: 'Mahatma Gandhi' },
  { text: 'Strength does not come from physical capacity. It comes from an indomitable will.', by: 'Mahatma Gandhi' },
  { text: 'Educate, agitate, organise.', by: 'Dr. B. R. Ambedkar' },
  { text: 'Cultivation of mind should be the ultimate aim of human existence.', by: 'Dr. B. R. Ambedkar' },
  { text: 'Manpower without unity is not a strength unless it is harmonised and united properly.', by: 'Sardar Vallabhbhai Patel' },
  { text: 'You have a right to perform your actions, but you are not entitled to the fruits of the actions.', by: 'Bhagavad Gita' },
  { text: 'It always seems impossible until it is done.', by: 'Nelson Mandela' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', by: 'Confucius' },
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
  { text: 'Your competition is the version of you that gave up yesterday.' },
  { text: 'Do not count the days. Make the days count.' },
  { text: 'A rank is just a lot of ordinary days done well.' },
  { text: 'Motivation gets you started. Habit keeps you going.' },
  { text: 'Hard days are the ones that build the officer in you.' },
  { text: 'Revise before you rest. Rest before you doubt.' },
  { text: 'Every PYQ you solve today is a surprise you will not face in the exam hall.' },
  { text: 'Focus on the next topic, not the whole mountain.' },
  { text: 'Progress, not perfection.' },
  { text: 'Make your notes short, your revisions many, and your faith strong.' },
  { text: 'Today\u2019s discomfort is tomorrow\u2019s confidence.' },
  { text: 'The exam rewards those who stay calm and keep showing up.' },
  { text: 'Study like the seat is waiting for you, because it is.' },
  { text: 'Failure is feedback. Read it, learn from it, and go again.' },
  { text: 'Be so consistent that doubt gets bored and leaves.' },
  { text: 'Sleep, eat, move, study. Repeat. The basics win.' },
  { text: 'Your future service is built in your present study hours.' },
];

const ROTATE_MS = 12_000;

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
    const id = setInterval(() => setIdx((i) => (i + 1) % order.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [order.length]);

  const q = order[idx];
  return (
    <div className="motivation-banner" role="note" aria-live="off">
      <span className="motivation-banner-icon" aria-hidden="true">💡</span>
      <div key={idx} className="motivation-quote">
        <p className="motivation-text">&ldquo;{q.text}&rdquo;</p>
        {q.by && <p className="motivation-by">&mdash; {q.by}</p>}
      </div>
    </div>
  );
}
