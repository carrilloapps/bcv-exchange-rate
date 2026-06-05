/**
 * Caching subsystem: an in-memory LRU store with TTL awareness, a pluggable
 * `CacheStore` contract, global observability counters and the
 * stale-while-error wrapper used by every source function.
 */
import { CacheEntry, CacheStats, CacheStore, Logger, RequestOptions } from './types';

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_CACHE_MAX_ENTRIES = 200;

const cacheCounters = { hits: 0, misses: 0, staleServes: 0 };

/**
 * Creates a new in-memory LRU cache with TTL awareness. The returned store is the same
 * shape consumed by `cacheStore` in `RequestOptions`, so you can either inject it per
 * call or install it globally via `setDefaultCache`.
 */
export function createInMemoryCache(options: { maxEntries?: number } = {}): CacheStore {
    const max = Math.max(1, options.maxEntries ?? DEFAULT_CACHE_MAX_ENTRIES);
    const map = new Map<string, CacheEntry>();
    return {
        get size() {
            return map.size;
        },
        get(key: string): CacheEntry | undefined {
            const entry = map.get(key);
            if (!entry) return undefined;
            map.delete(key);
            map.set(key, entry);
            return entry;
        },
        set(key: string, entry: CacheEntry): void {
            map.delete(key);
            map.set(key, entry);
            while (map.size > max) {
                map.delete(map.keys().next().value as string);
            }
        },
        delete(key: string): void {
            map.delete(key);
        },
        clear(): void {
            map.clear();
        },
    };
}

let defaultCache: CacheStore = createInMemoryCache();

/** Replaces the default in-memory cache. Use to tune LRU size or plug a custom backend. */
export function setDefaultCache(store: CacheStore): void {
    defaultCache = store;
}

/** Returns the current default cache instance. Primarily useful in tests. */
export function getDefaultCache(): CacheStore {
    return defaultCache;
}

/** Returns a snapshot of global cache counters plus the size of the default cache. */
export function getCacheStats(): CacheStats {
    return {
        hits: cacheCounters.hits,
        misses: cacheCounters.misses,
        staleServes: cacheCounters.staleServes,
        size: defaultCache.size,
    };
}

/** Resets the global cache counters. Does not touch stored entries. */
export function resetCacheStats(): void {
    cacheCounters.hits = 0;
    cacheCounters.misses = 0;
    cacheCounters.staleServes = 0;
}

/** Clears the default in-memory cache. Custom stores are not touched. */
export function clearCache(): void {
    defaultCache.clear();
}

/**
 * Wraps a factory with the configured caching policy: fresh hits are served
 * from the store, misses execute the factory and persist the value, and when
 * the factory fails a stale entry (within `cacheStaleTtlMs`) is served as a
 * degraded fallback with a `warn` log.
 */
export async function withCache<T>(
    key: string,
    options: RequestOptions,
    logger: Logger,
    factory: () => Promise<T>
): Promise<T> {
    const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    if (ttlMs === 0) return factory();

    const staleTtlMs = options.cacheStaleTtlMs ?? 0;
    const store = options.cacheStore ?? defaultCache;

    const now = Date.now();
    const entry = store.get(key);

    if (entry && entry.expiresAt > now) {
        cacheCounters.hits++;
        logger.debug('Cache hit', { key });
        return entry.value as T;
    }

    cacheCounters.misses++;

    try {
        const value = await factory();
        store.set(key, {
            value,
            expiresAt: now + ttlMs,
            staleUntil: now + ttlMs + staleTtlMs,
        });
        return value;
    } catch (error) {
        if (entry && entry.staleUntil > now) {
            cacheCounters.staleServes++;
            logger.warn('Serving stale cache after upstream failure', {
                key,
                error: (error as Error).message,
            });
            return entry.value as T;
        }
        throw error;
    }
}
