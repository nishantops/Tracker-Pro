import '@testing-library/jest-dom';

// Node 25+ ships its own experimental `localStorage` that is unusable without --localstorage-file and shadows jsdom's.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const mem = new Map<string, string>();
  const storage: Storage = {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    key: (i) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k) => { mem.delete(k); },
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
  for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
    if (target) Object.defineProperty(target, 'localStorage', { configurable: true, value: storage });
  }
}
