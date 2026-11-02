import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const istDate = (offsetDays = 0) =>
  new Date(Date.now() + 5.5 * 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
}

const fmt = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function HomeGreeting({ name }: { name: string }) {
  const { user } = useAuth();
  const [today, setToday] = useState(0);
  const [streak, setStreak] = useState(0);

  // Read-only: does not touch the focus session state owned by FocusWidget.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('upsc_focus_daily')
        .select('focus_date, total_seconds')
        .eq('user_id', user.id)
        .gte('focus_date', istDate(60))
        .order('focus_date', { ascending: false });
      if (cancelled || !data) return;
      const secs = new Map(data.map((d) => [d.focus_date as string, d.total_seconds as number]));
      setToday(secs.get(istDate(0)) ?? 0);
      // Streak may still be alive if today has no focus yet
      let day = (secs.get(istDate(0)) ?? 0) > 0 ? 0 : 1;
      let count = 0;
      while ((secs.get(istDate(day)) ?? 0) > 0) { count++; day++; }
      setStreak(count);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="neo-card rounded-3xl px-6 py-5 flex flex-wrap items-center justify-between gap-4 animate-in">
      <div className="min-w-0">
        <div className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--t4)' }}>{greeting()}</div>
        <div className="text-xl md:text-2xl font-black heading-font gradient-text-animated truncate">{name}</div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="rounded-2xl px-4 py-2 text-center" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--t4)' }}>Focus today</div>
          <div className="text-lg font-black" style={{ color: 'var(--t1)' }}>{today > 0 ? fmt(today) : '—'}</div>
        </div>
        <div className="rounded-2xl px-4 py-2 text-center" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--t4)' }}>Study streak</div>
          <div className="text-lg font-black" style={{ color: 'var(--t1)' }}>{streak > 0 ? `🔥 ${streak} day${streak > 1 ? 's' : ''}` : '—'}</div>
        </div>
      </div>
    </div>
  );
}
