/**
 * Simple in-process TTL cache for API routes.
 *
 * Production note: this is a per-instance cache. For multi-instance
 * deployments (Vercel Edge, autoscaling, etc.) replace with a shared
 * KV / Redis layer. Keys are namespaced by route name to avoid collisions.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();

function getStore(namespace: string): Map<string, CacheEntry<unknown>> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export async function cached<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const store = getStore(namespace);
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidate(namespace: string, keyPattern?: RegExp): number {
  const store = stores.get(namespace);
  if (!store) return 0;
  let removed = 0;
  if (!keyPattern) {
    removed = store.size;
    store.clear();
  } else {
    for (const key of [...store.keys()]) {
      if (keyPattern.test(key)) {
        store.delete(key);
        removed++;
      }
    }
  }
  return removed;
}

/** Test/diagnostic helper — number of entries currently in a namespace. */
export function size(namespace: string): number {
  return stores.get(namespace)?.size ?? 0;
}