import type { Alert } from './notifEngine';

const SENT_KEY = 'upsc_push_sent';

export const pushSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const pushPermission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported');

// Registered in production builds only, so the dev server never serves stale assets.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* optional feature */ }); });
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function readSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}') as Record<string, number>; } catch { return {}; }
}

// Which alerts should be pushed now: not sent before, or the repeat interval (once a day if repeat is off) has passed.
export function alertsToPush(alerts: Alert[], repeatMinutes: number, now = Date.now()): Alert[] {
  const sent = readSent();
  const gap = (repeatMinutes > 0 ? repeatMinutes : 24 * 60) * 60_000;
  return alerts.filter((a) => !sent[a.id] || now - sent[a.id]! >= gap);
}

export async function pushAlerts(alerts: Alert[]): Promise<void> {
  if (alerts.length === 0 || pushPermission() !== 'granted') return;
  const sent = readSent();
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
  for (const a of alerts.slice(0, 3)) {
    const opts: NotificationOptions = { body: a.subtext, tag: a.id };
    try {
      if (reg) await reg.showNotification(a.message, opts);
      else new Notification(a.message, opts);
      sent[a.id] = Date.now();
    } catch { /* ignore */ }
  }
  try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch { /* ignore */ }
}
