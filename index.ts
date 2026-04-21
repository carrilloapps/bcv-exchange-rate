import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';

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

/** Base class for all library errors. */
export class BcvExchangeError extends Error {
    public override readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = this.constructor.name;
        this.cause = cause;
    }
}

/** Network-level failures (timeouts, DNS, TLS, 5xx after retries). */
export class NetworkError extends BcvExchangeError {}

/** HTML parsing failures (unexpected document shape). */
export class ParseError extends BcvExchangeError {}

/** Input validation failures. */
export class ValidationError extends BcvExchangeError {}

/** Raised exclusively by `getTrmRates` when the Colombia API responds with an error. */
export class TrmApiError extends BcvExchangeError {}

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

/** Shared request options. */
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
     * calls is used. Use [`createInMemoryCache`](./index.ts) or
     * [`setDefaultCache`](./index.ts) to customize.
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
    /** Pagination metadata for historical results. */
    pagination: {
        currentPage: number;
        hasNextPage: boolean;
    };
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
    pagination: { limit: number; offset: number; count: number };
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const BCV_CURRENCY_MAP: Record<string, Currency> = {
    dolar: 'USD',
    euro: 'EUR',
    yuan: 'CNY',
    lira: 'TRY',
    rublo: 'RUB',
};
const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

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

const noopLogger: Logger = { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };

function resolveLogger(options: RequestOptions): Logger {
    if (options.logger) return options.logger;
    if (process.env.BCV_DEBUG) return console;
    return noopLogger;
}

function buildAxiosConfig(options: RequestOptions, logger: Logger): AxiosRequestConfig {
    const strictSSL = options.strictSSL !== false;
    if (!strictSSL) {
        logger.warn('TLS certificate validation is disabled (strictSSL: false).');
    }
    return {
        timeout: options.timeout ?? 25000,
        validateStatus: (status) => status < 500,
        httpsAgent: new https.Agent({ rejectUnauthorized: strictSSL }),
        headers: {
            'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
    };
}

function assertPositiveInt(value: unknown, name: string, min: number): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
        throw new ValidationError(`Invalid "${name}": expected integer >= ${min}, got ${String(value)}.`);
    }
}

function formatBcvDate(date: Date): string {
    return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

function toIsoDate(input: string): string {
    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(input.trim());
    if (!match) return input.trim();
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseVenezuelanNumber(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(
    url: string,
    config: AxiosRequestConfig,
    options: RequestOptions,
    logger: Logger
): Promise<T> {
    const retries = Math.max(0, options.retries ?? 2);
    const baseDelay = Math.max(0, options.retryDelayMs ?? 400);
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
        try {
            logger.debug('HTTP request', { url, attempt });
            const response = await axios.get<T>(url, config);
            return response.data;
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
            const delay = baseDelay * 2 ** attempt;
            logger.warn('Request failed, retrying', { url, attempt, delay });
            await sleep(delay);
            attempt += 1;
        }
    }

    throw new NetworkError(
        `Request failed after ${retries + 1} attempts: ${(lastError as Error).message}`,
        lastError
    );
}

async function withCache<T>(
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

/** Clears the default in-memory cache. Custom stores are not touched. */
export function clearCache(): void {
    defaultCache.clear();
}

/**
 * Fetches current and/or historical exchange rate data from the Banco Central de Venezuela.
 *
 * @throws {ValidationError} On invalid input.
 * @throws {NetworkError} When all requested sections fail and none can be recovered.
 */
export async function getBcvRates(params: BcvParams = {}): Promise<BcvResponse> {
    const logger = resolveLogger(params);
    const days = params.days ?? 7;
    const page = params.page ?? 0;
    const includeCurrent = params.includeCurrent !== false;
    const includeHistory = params.includeHistory !== false;

    assertPositiveInt(days, 'days', 1);
    assertPositiveInt(page, 'page', 0);

    const config = buildAxiosConfig(params, logger);
    logger.info('Starting BCV extraction', { days, page, includeCurrent, includeHistory });

    const response: BcvResponse = {
        current: {},
        effectiveDate: '',
        history: [],
        pagination: { currentPage: page, hasNextPage: false },
        status: {
            current: includeCurrent ? 'ok' : 'skipped',
            history: includeHistory ? 'ok' : 'skipped',
        },
    };

    if (includeCurrent) {
        try {
            const requested = params.currencies
                ? new Set(Array.isArray(params.currencies) ? params.currencies : [params.currencies])
                : null;
            const html = await withCache('bcv:current', params, logger, () =>
                requestWithRetry<string>('https://www.bcv.org.ve/', config, params, logger)
            );
            const $ = cheerio.load(html);

            for (const [id, code] of Object.entries(BCV_CURRENCY_MAP)) {
                if (requested && !requested.has(code)) continue;
                const raw = $(`#${id} strong`).text().trim();
                const rate = parseVenezuelanNumber(raw);
                if (rate !== null) {
                    response.current[code] = rate;
                } else if (raw) {
                    logger.warn('Unparseable rate text', { currency: code, raw });
                }
            }

            const dateAttr = $('.date-display-single').first().attr('content');
            const dateText = $('.date-display-single').first().text().trim();
            response.effectiveDate = dateAttr ?? dateText;
        } catch (error) {
            response.status.current = 'failed';
            logger.error('BCV current section failed', { error: (error as Error).message });
            if (!includeHistory) throw error;
        }
    }

    if (includeHistory) {
        try {
            const historyData = await getBcvHistory({ ...params, logger });
            response.history = historyData.history;
            response.pagination = historyData.pagination;
        } catch (error) {
            response.status.history = 'failed';
            logger.error('BCV history section failed', { error: (error as Error).message });
        }
    }

    return response;
}

/**
 * Fetches only the historical/informative bank rates from BCV.
 *
 * @throws {ValidationError} On invalid input.
 * @throws {NetworkError} When the request cannot be recovered through retries.
 * @throws {ParseError} When the document does not contain the expected structure.
 */
export async function getBcvHistory(
    params: BcvParams = {}
): Promise<Pick<BcvResponse, 'history' | 'pagination'>> {
    const logger = resolveLogger(params);
    const days = params.days ?? 7;
    const page = params.page ?? 0;

    assertPositiveInt(days, 'days', 1);
    assertPositiveInt(page, 'page', 0);

    const config = buildAxiosConfig(params, logger);

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    const base = 'https://www.bcv.org.ve/tasas-informativas-sistema-bancario';
    const qs =
        `?field_fecha_del_indicador_value%5Bmin%5D%5Bdate%5D=${encodeURIComponent(formatBcvDate(startDate))}` +
        `&field_fecha_del_indicador_value%5Bmax%5D%5Bdate%5D=${encodeURIComponent(formatBcvDate(today))}`;
    const url = page > 0 ? `${base}${qs}&page=${page}` : `${base}${qs}`;

    const html = await withCache(`bcv:history:${url}`, params, logger, () =>
        requestWithRetry<string>(url, config, params, logger)
    );

    const $ = cheerio.load(html);
    const table = $('table.views-table');
    if (!table.length) {
        logger.warn('BCV history table selector did not match', { url });
    }

    const history: BcvBankRate[] = [];
    table.find('tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) {
            logger.warn('Skipping history row with fewer than 4 cells');
            return;
        }
        history.push({
            date: toIsoDate($(cells[0]).text()),
            bank: $(cells[1]).text().trim(),
            buy: parseVenezuelanNumber($(cells[2]).text().trim()),
            sell: parseVenezuelanNumber($(cells[3]).text().trim()),
        });
    });

    const hasNextPage = $('.pager-next').length > 0;
    logger.info('BCV history retrieved', { count: history.length, hasNextPage });

    return { history, pagination: { currentPage: page, hasNextPage } };
}

/**
 * Fetches the official TRM from Colombia's Open Data API.
 *
 * @throws {ValidationError} On invalid input.
 * @throws {TrmApiError} When the upstream API returns an error.
 * @returns `null` when the API responds successfully with zero records.
 */
export async function getTrmRates(params: TrmParams = {}): Promise<TrmResponse | null> {
    const logger = resolveLogger(params);
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;

    assertPositiveInt(limit, 'limit', 1);
    if (limit > 1000) throw new ValidationError('Invalid "limit": must be <= 1000.');
    assertPositiveInt(offset, 'offset', 0);

    const config = buildAxiosConfig(params, logger);
    const url = `https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciahasta%20DESC&$limit=${limit}&$offset=${offset}`;

    logger.info('Requesting Colombia TRM', { limit, offset });

    let payload: Array<Record<string, string>>;
    try {
        payload = await withCache(`trm:${url}`, params, logger, () =>
            requestWithRetry<Array<Record<string, string>>>(url, config, params, logger)
        );
    } catch (error) {
        throw new TrmApiError(`Failed to fetch TRM: ${(error as Error).message}`, error);
    }

    if (!Array.isArray(payload) || payload.length === 0) {
        logger.warn('TRM API returned no records');
        return null;
    }

    const [latest, ...rest] = payload;
    return {
        current: {
            value: parseFloat(latest.valor),
            unit: latest.unidad,
            validityDate: latest.vigenciahasta,
        },
        history: rest.map((item) => ({
            value: parseFloat(item.valor),
            validityDate: item.vigenciahasta,
        })),
        pagination: { limit, offset, count: payload.length },
    };
}
