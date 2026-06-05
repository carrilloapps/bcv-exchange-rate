/**
 * bcv-exchange-rate — official exchange-rate indicators for Venezuela (BCV),
 * Colombia (TRM) and Brazil (PTAX).
 *
 * This barrel re-exports the whole public API. Internal layout:
 *
 * - `types`      — public type contracts (params, responses, pagination)
 * - `errors`     — typed error hierarchy
 * - `cache`      — in-memory LRU, pluggable stores, stale-while-error
 * - `sources/*`  — one module per upstream source (bcv, trm, brl)
 */

export {
    Logger,
    Currency,
    SectionStatus,
    CacheEntry,
    CacheStore,
    CacheStats,
    RequestOptions,
    BcvParams,
    TrmParams,
    BrlParams,
    Pagination,
    DateRange,
    BcvBankRate,
    BcvResponse,
    TrmResponse,
    BrlRate,
    BrlResponse,
} from './types';

export {
    BcvExchangeError,
    NetworkError,
    ParseError,
    ValidationError,
    TrmApiError,
    BrlApiError,
} from './errors';

export {
    createInMemoryCache,
    setDefaultCache,
    getDefaultCache,
    getCacheStats,
    resetCacheStats,
    clearCache,
} from './cache';

export { getBcvRates, getBcvHistory } from './sources/bcv';
export { getTrmRates } from './sources/trm';
export { getBrlRates } from './sources/brl';
