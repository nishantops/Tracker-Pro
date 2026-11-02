import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertsToPush, pushAlerts, pushPermission, requestPushPermission } from './browserPush';

const alert = (id: string) => ({ id, type: 'info', message: `msg ${id}`, subtext: 'sub' });

function stubNotification(permission: NotificationPermission, request?: () => Promise<NotificationPermission>) {
  const ctor = vi.fn();
  Object.assign(ctor, { permission, requestPermission: request ?? vi.fn().mockResolvedValue(permission) });
  vi.stubGlobal('Notification', ctor);
  return ctor;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('alertsToPush', () => {
  it('pushes unseen alerts, then waits for the repeat interval', () => {
    const now = 1_000_000_000;
    localStorage.setItem('upsc_push_sent', JSON.stringify({ a: now - 5 * 60_000, b: now - 40 * 60_000 }));
    const ids = alertsToPush([alert('a'), alert('b'), alert('c')], 30, now).map((x) => x.id);
    expect(ids).toEqual(['b', 'c']);
  });

  it('with repeat off, pushes at most once a day', () => {
    const now = 1_000_000_000;
    localStorage.setItem('upsc_push_sent', JSON.stringify({ a: now - 3 * 3_600_000, b: now - 25 * 3_600_000 }));
    expect(alertsToPush([alert('a'), alert('b')], 0, now).map((x) => x.id)).toEqual(['b']);
  });
});

describe('pushAlerts', () => {
  it('does nothing without permission', async () => {
    const ctor = stubNotification('denied');
    await pushAlerts([alert('a')]);
    expect(ctor).not.toHaveBeenCalled();
    expect(localStorage.getItem('upsc_push_sent')).toBeNull();
  });

  it('shows at most three notifications and records them as sent', async () => {
    const ctor = stubNotification('granted');
    await pushAlerts(['a', 'b', 'c', 'd'].map(alert));
    expect(ctor).toHaveBeenCalledTimes(3);
    expect(ctor).toHaveBeenCalledWith('msg a', { body: 'sub', tag: 'a' });
    expect(Object.keys(JSON.parse(localStorage.getItem('upsc_push_sent')!))).toEqual(['a', 'b', 'c']);
  });
});

describe('permission helpers', () => {
  it('requests permission only when undecided', async () => {
    const req = vi.fn().mockResolvedValue('granted');
    stubNotification('default', req);
    expect(await requestPushPermission()).toBe('granted');
    expect(req).toHaveBeenCalledTimes(1);

    const req2 = vi.fn();
    stubNotification('denied', req2);
    expect(await requestPushPermission()).toBe('denied');
    expect(req2).not.toHaveBeenCalled();
  });

  it('reports unsupported browsers', async () => {
    vi.stubGlobal('Notification', undefined);
    delete (window as unknown as Record<string, unknown>).Notification;
    expect(pushPermission()).toBe('unsupported');
    expect(await requestPushPermission()).toBe('unsupported');
  });
});
