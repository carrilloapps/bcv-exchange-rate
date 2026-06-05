/**
 * Public type contracts of the library: request options, per-source parameters
 * and the unified response shapes shared by BCV (Venezuela), TRM (Colombia)
 * and PTAX (Brazil).
 *
 * This module is intentionally runtime-free: it only declares types.
 */

/**
 * Minimal duck-typed logger interface. Compatible with `console`, `winston`,
 * `pino`, `bunyan` and most logging libraries without forcing a hard dependency.
 */
export interface Logger {
    info: (message: string, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
}

/** Supported BCV currency codes. */
export type Currency = 'USD' | 'EUR' | 'CNY' | 'TRY' | 'RUB';

/** Status of a scraped section within a BCV response. */
export type SectionStatus = 'ok' | 'skipped' | 'failed';

/** One entry inside a cache store. */
export interface CacheEntry<T = unknown> {
    /** Cached value. */
    value: T;
    /** Absolute epoch (ms). Beyond this point the entry is no longer served as a fresh hit. */
    expiresAt: number;
    /** Absolute epoch (ms). Beyond this point the entry cannot be served even on upstream failure. */
    staleUntil: number;
}

/**
 * Pluggable cache backend. Implement this interface to replace the default in-memory LRU
 * with, for example, a Redis-backed adapter. All methods must be synchronous; wrap async
 * backends with an in-process local cache layer if needed.
 */
export interface CacheStore {
    readonly size: number;
    get(key: string): CacheEntry | undefined;
    set(key: string, entry: CacheEntry): void;
    delete(key: string): void;
    clear(): void;
}

/** Observability counters for cache activity. */
export interface CacheStats {
    hits: number;
    misses: number;
    staleServes: number;
    /** Size of the default in-memory cache. Custom stores are not reflected here. */
    size: number;
}

/** Shared request options accepted by every source function. */
export interface RequestOptions {
    /** Request timeout in milliseconds. Default: 25000 */
    timeout?: number;
    /**
     * Whether TLS certificates must be valid. Default: `true`.
     *
     * The BCV portal frequently serves expired or mismatched certificates. Disable
     * only when you accept the risk of a possible man-in-the-middle. A `warn` log
     * is emitted every time validation is bypassed.
     */
    strictSSL?: boolean;
    /** Custom `User-Agent` string. Some government portals block generic agents. */
    userAgent?: string;
    /** Duck-typed logger. Defaults to a silent logger in production, `console` otherwise. */
    logger?: Logger;
    /** Number of retry attempts on transient network failures. Default: 2. */
    retries?: number;
    /** Base delay (ms) for exponential backoff between retries. Default: 400. */
    retryDelayMs?: number;
    /**
     * Fresh-cache TTL (ms). Default: `60000` (1 minute).
     *
     * - Any positive value enables caching for this call.
     * - `0` disables caching entirely (both read and write).
     */
    cacheTtlMs?: number;
    /**
     * Extra window (ms) beyond `cacheTtlMs` during which a stale value is served
     * **only if the upstream fails**. Default: `0` (no stale serve).
     *
     * Enables a "stale-while-error" degraded mode: if the upstream is temporarily
     * down, the last successful value keeps flowing for this many additional ms
     * and a `warn` is emitted on each stale serve.
     */
    cacheStaleTtlMs?: number;
    /**
     * Custom cache backend. When omitted, an in-memory LRU cache shared across
     * calls is used. Use `createInMemoryCache` or `setDefaultCache` to customize.
     */
    cacheStore?: CacheStore;
}

/** Parameters for BCV (Venezuela) scraping. */
export interface BcvParams extends RequestOptions {
    /** Specific currency code(s) to include (e.g., `'USD'` or `['USD', 'EUR']`). */
    currencies?: Currency | Currency[];
    /** Include current rates from the BCV home page. Default: `true`. */
    includeCurrent?: boolean;
    /** Include historical bank rates. Default: `true`. */
    includeHistory?: boolean;
    /** Range of days for the historical window. Must be ≥ 1. Default: `7`. */
    days?: number;
    /** Page number for the historical listing. Must be ≥ 0. Default: `0`. */
    page?: number;
}

/** Parameters for the Colombia (TRM) API. */
export interface TrmParams extends RequestOptions {
    /** Maximum records to return. Must be between 1 and 1000. Default: `10`. */
    limit?: number;
    /** Offset for pagination. Must be ≥ 0. Default: `0`. */
    offset?: number;
    /**
     * Lookback window in days (`vigenciahasta >= today - days`). Must be ≥ 1.
     * Default: no date filter — the latest records are returned.
     */
    days?: number;
}

/** Parameters for the Brazil (PTAX) API. */
export interface BrlParams extends RequestOptions {
    /** Lookback window in days. Must be ≥ 1. Default: `7`. */
    days?: number;
    /**
     * Maximum records to return (OData `$top`). Must be between 1 and 1000.
     * Default: unlimited — the whole window is returned.
     */
    limit?: number;
    /** Records to skip for pagination (OData `$skip`). Must be ≥ 0. Default: `0`. */
    offset?: number;
}

/**
 * Unified pagination block shared by every source. Fields that do not apply to
 * a source's pagination paradigm are `null` instead of being absent, so the
 * shape is identical across BCV, TRM and BRL responses.
 */
export interface Pagination {
    /** Requested page size. `null` when not requested or not applicable (BCV). */
    limit: number | null;
    /** Requested offset. `null` when the source paginates by page (BCV). */
    offset: number | null;
    /** Requested page number. `null` when the source paginates by limit/offset (TRM/BRL). */
    page: number | null;
    /** Number of records returned by the source in this response. */
    count: number;
    /** Whether more records exist upstream. `null` when the source cannot tell. */
    hasMore: boolean | null;
}

/** Date window applied to a query, in ISO 8601 (`YYYY-MM-DD`). */
export interface DateRange {
    startDate: string;
    endDate: string;
}

/** A single bank exchange rate record from BCV. */
export interface BcvBankRate {
    /** Date of the record in ISO 8601 (`YYYY-MM-DD`). */
    date: string;
    /** Full name of the banking institution. */
    bank: string;
    /** Buy rate value. `null` when the source could not be parsed. */
    buy: number | null;
    /** Sell rate value. `null` when the source could not be parsed. */
    sell: number | null;
}

/** Structured response for Venezuela (BCV) indicators. */
export interface BcvResponse {
    /** Current official rates indexed by ISO currency code. */
    current: Partial<Record<Currency, number>>;
    /** Vigency date of `current` in ISO 8601 when available. */
    effectiveDate: string;
    /** Historical/informative bank rates. */
    history: BcvBankRate[];
    /** Unified pagination metadata for historical results. */
    pagination: Pagination;
    /** Date window of the historical query. `null` when the section was skipped or failed. */
    range: DateRange | null;
    /**
     * Echo of the effective TLS policy used for this call. `false` means the
     * data was fetched WITHOUT certificate validation (`strictSSL: false`).
     */
    strictSSL: boolean;
    /** Status breakdown so consumers can react to partial failures. */
    status: {
        current: SectionStatus;
        history: SectionStatus;
    };
}

/** Structured response for Colombia (TRM) indicators. */
export interface TrmResponse {
    current: {
        value: number;
        unit: string;
        validityDate: string;
    };
    history: Array<{ value: number; validityDate: string }>;
    /** Unified pagination metadata. */
    pagination: Pagination;
    /** Date window applied via `days`. `null` when `days` was not provided. */
    range: DateRange | null;
    /**
     * Echo of the effective TLS policy used for this call. `false` means the
     * data was fetched WITHOUT certificate validation (`strictSSL: false`).
     */
    strictSSL: boolean;
}

/** A single PTAX quotation (BRL per USD). */
export interface BrlRate {
    /** Buy rate (`cotacaoCompra`). */
    buy: number;
    /** Sell rate (`cotacaoVenda`). */
    sell: number;
    /** Quotation timestamp as provided by the API (`YYYY-MM-DD HH:mm:ss.SSS`). */
    dateTime: string;
}

/** Structured response for Brazil (PTAX) indicators. */
export interface BrlResponse {
    /** Most recent quotation within the requested window. */
    current: BrlRate;
    /** Remaining quotations of the window, most recent first. */
    history: BrlRate[];
    /** Unified pagination metadata. `limit` is `null` when the whole window was returned. */
    pagination: Pagination;
    /** Date window of the query. */
    range: DateRange | null;
    /**
     * Echo of the effective TLS policy used for this call. `false` means the
     * data was fetched WITHOUT certificate validation (`strictSSL: false`).
     */
    strictSSL: boolean;
}
