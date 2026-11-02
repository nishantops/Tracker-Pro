import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { sortAlerts, type Alert } from '../../lib/notifEngine';

interface Props {
  alerts: Alert[];
  repeatMinutes: number;
  onDone: (id: string) => void;
}

const LATER_KEY = 'upsc_notif_later';
const MAX_VISIBLE = 3;

function readLater(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LATER_KEY) || '{}') as Record<string, number>; } catch { return {}; }
}

// Push-style alerts at the bottom of the page. "Later" hides one only until the repeat interval; "Done" attends it.
export function NotificationToasts({ alerts, repeatMinutes, onDone }: Props) {
  const [later, setLater] = useState<Record<string, number>>(readLater);
  const [, setTick] = useState(0);

  // Re-check every 30s so a "Later" alert pops back up on schedule
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const hideLater = (id: string) => {
    const until = repeatMinutes > 0 ? Date.now() + repeatMinutes * 60_000 : Number.MAX_SAFE_INTEGER;
    const next = { ...later, [id]: until };
    setLater(next);
    if (repeatMinutes > 0) { try { localStorage.setItem(LATER_KEY, JSON.stringify(next)); } catch { /* ignore */ } }
  };

  const now = Date.now();
  const due = sortAlerts(alerts).filter((a) => !(later[a.id] > now));
  const shown = due.slice(0, MAX_VISIBLE);
  if (shown.length === 0) return null;
  const extra = due.length - shown.length;

  return createPortal(
    <div className="notif-toasts" role="status" aria-live="polite">
      {shown.map((a) => (
        <div key={a.id} className="notif-toast">
          <div className="notif-toast-body">
            <div className="notif-toast-msg">{a.message}</div>
            {a.subtext && <div className="notif-toast-sub">{a.subtext}</div>}
          </div>
          <div className="notif-toast-actions">
            <button type="button" className="notif-toast-done" onClick={() => onDone(a.id)}>✓ Done</button>
            <button type="button" className="notif-toast-later" onClick={() => hideLater(a.id)} title={repeatMinutes > 0 ? `Remind me again in ${repeatMinutes} min` : 'Hide for now'}>Later</button>
          </div>
        </div>
      ))}
      {extra > 0 && <div className="notif-toast-more">+{extra} more in the 🔔 alerts</div>}
    </div>,
    document.body,
  );
}
