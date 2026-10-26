type Entry = { count: number; resetAt: number };

// globalThis agar tidak ter-reset oleh hot reload di mode pengembangan
const g = globalThis as unknown as { __loginAttempts?: Map<string, Entry> };
const store = (g.__loginAttempts ??= new Map<string, Entry>());

export function isBlocked(key: string, max: number) {
  const e = store.get(key);
  if (!e) return false;
  if (e.resetAt <= Date.now()) {
    store.delete(key);
    return false;
  }
  return e.count >= max;
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  const e = store.get(key);
  if (!e || e.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    e.count++;
  }
}