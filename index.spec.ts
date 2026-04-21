import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
    getBcvRates,
    getTrmRates,
    getBcvHistory,
    clearCache,
    createInMemoryCache,
    setDefaultCache,
    getDefaultCache,
    getCacheStats,
    resetCacheStats,
    ValidationError,
    NetworkError,
    TrmApiError,
    BcvExchangeError,
    CacheStore,
} from './index';

const mock = new MockAdapter(axios);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('bcv-exchange-rate', () => {
    const originalDefaultCache = getDefaultCache();

    afterEach(() => {
        mock.reset();
        setDefaultCache(originalDefaultCache);
        clearCache();
        resetCacheStats();
    });

    describe('getBcvRates', () => {
        it('fetches current rates and history', async () => {
            const htmlMain = `
                <div id="dolar"><strong>48,16</strong></div>
                <div id="euro"><strong>51,20</strong></div>
                <span class="date-display-single" content="2026-04-21T00:00:00">21 de abril</span>
            `;
            const htmlHistory = `
                <table class="views-table">
                    <tbody>
                        <tr><td>20-04-2026</td><td>Banco de Prueba</td><td>47,50</td><td>48,50</td></tr>
                    </tbody>
                </table>
                <div class="pager-next">Next</div>
            `;
            mock.onGet('https://www.bcv.org.ve/').reply(200, htmlMain);
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, htmlHistory);

            const result = await getBcvRates({ days: 1, page: 1 });

            expect(result.current.USD).toBe(48.16);
            expect(result.current.EUR).toBe(51.2);
            expect(result.effectiveDate).toBe('2026-04-21T00:00:00');
            expect(result.history).toHaveLength(1);
            expect(result.history[0].date).toBe('2026-04-20');
            expect(result.pagination.hasNextPage).toBe(true);
            expect(result.status).toEqual({ current: 'ok', history: 'ok' });
        });

        it('filters currencies when requested', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(
                200,
                '<div id="dolar"><strong>48,16</strong></div><div id="euro"><strong>51,20</strong></div>'
            );
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, '<table></table>');

            const only = await getBcvRates({ currencies: 'USD' });
            expect(only.current.USD).toBe(48.16);
            expect(only.current.EUR).toBeUndefined();

            const list = await getBcvRates({ currencies: ['EUR'] });
            expect(list.current.EUR).toBe(51.2);
            expect(list.current.USD).toBeUndefined();
        });

        it('marks skipped sections', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, '<table></table>');

            const onlyCurrent = await getBcvRates({ includeHistory: false });
            expect(onlyCurrent.status).toEqual({ current: 'ok', history: 'skipped' });

            const onlyHistory = await getBcvRates({ includeCurrent: false });
            expect(onlyHistory.status).toEqual({ current: 'skipped', history: 'ok' });
        });

        it('falls back to date text when no content attribute is present', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(
                200,
                '<div id="dolar"><strong>48</strong></div><span class="date-display-single">21 abril 2026</span>'
            );
            const result = await getBcvRates({ includeHistory: false });
            expect(result.effectiveDate).toBe('21 abril 2026');
        });

        it('marks current as failed but still returns history when available', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(500);
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>20-04-2026</td><td>Banco X</td><td>48,00</td><td>49,00</td></tr></tbody></table>'
            );

            const result = await getBcvRates({ retries: 0 });
            expect(result.status.current).toBe('failed');
            expect(result.status.history).toBe('ok');
            expect(result.history).toHaveLength(1);
        });

        it('throws NetworkError when current fails and history is skipped', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(500);
            await expect(getBcvRates({ includeHistory: false, retries: 0 })).rejects.toBeInstanceOf(
                NetworkError
            );
        });

        it('marks history as failed without throwing when getBcvRates wraps it', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(500);

            const result = await getBcvRates({ retries: 0 });
            expect(result.status.history).toBe('failed');
            expect(result.history).toHaveLength(0);
        });

        it('ignores unparseable rate text and logs a warning', async () => {
            const warn = jest.fn();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>.</strong></div>');
            const result = await getBcvRates({
                includeHistory: false,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(result.current.USD).toBeUndefined();
            expect(warn).toHaveBeenCalledWith(
                'Unparseable rate text',
                expect.objectContaining({ currency: 'USD' })
            );
        });

        it('ignores empty rate text without emitting a warning', async () => {
            const warn = jest.fn();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong></strong></div>');
            await getBcvRates({
                includeHistory: false,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(warn).not.toHaveBeenCalledWith('Unparseable rate text', expect.anything());
        });

        it('honors explicit strictSSL=true without warning', async () => {
            const warn = jest.fn();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({
                includeHistory: false,
                strictSSL: true,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(warn).not.toHaveBeenCalledWith(
                expect.stringContaining('TLS certificate validation is disabled'),
                expect.anything()
            );
        });

        it('warns when strictSSL is disabled', async () => {
            const warn = jest.fn();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({
                includeHistory: false,
                strictSSL: false,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('TLS certificate validation is disabled')
            );
        });

        it('validates days and page', async () => {
            await expect(getBcvRates({ days: 0 })).rejects.toBeInstanceOf(ValidationError);
            await expect(getBcvRates({ page: -1 })).rejects.toBeInstanceOf(ValidationError);
        });

        it('accepts explicit timeout and userAgent', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            const result = await getBcvRates({
                includeHistory: false,
                timeout: 10_000,
                userAgent: 'custom-agent/1.0',
            });
            expect(result.current.USD).toBe(48);
        });

        it('logs a warning when rate contains only letters', async () => {
            const warn = jest.fn();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>abc</strong></div>');
            await getBcvRates({
                includeHistory: false,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(warn).toHaveBeenCalledWith(
                'Unparseable rate text',
                expect.objectContaining({ currency: 'USD' })
            );
        });

        it('accepts invocation without arguments', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, '<table></table>');
            const result = await getBcvRates();
            expect(result.current.USD).toBe(48);
        });
    });

    describe('getBcvHistory', () => {
        it('parses a well-formed table', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>21-04-2026</td><td>Banco Hist</td><td>48,00</td><td>49,00</td></tr></tbody></table>'
            );
            const result = await getBcvHistory();
            expect(result.history).toHaveLength(1);
            expect(result.history[0].date).toBe('2026-04-21');
        });

        it('skips rows with fewer than 4 cells', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'
            );
            const result = await getBcvHistory();
            expect(result.history).toHaveLength(0);
        });

        it('warns when the table selector does not match', async () => {
            const warn = jest.fn();
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(200, '<div></div>');
            await getBcvHistory({ logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() } });
            expect(warn).toHaveBeenCalledWith('BCV history table selector did not match', expect.anything());
        });

        it('wraps transport failures in NetworkError', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(500);
            await expect(getBcvHistory({ retries: 0 })).rejects.toBeInstanceOf(NetworkError);
        });

        it('retries transient failures and eventually succeeds', async () => {
            const warn = jest.fn();
            mock.onGet(/tasas-informativas-sistema-bancario/)
                .replyOnce(500)
                .onGet(/tasas-informativas-sistema-bancario/)
                .reply(
                    200,
                    '<table class="views-table"><tbody><tr><td>20-04-2026</td><td>B</td><td>1,00</td><td>2,00</td></tr></tbody></table>'
                );

            const result = await getBcvHistory({
                retries: 1,
                retryDelayMs: 0,
                logger: { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() },
            });
            expect(result.history).toHaveLength(1);
            expect(warn).toHaveBeenCalledWith('Request failed, retrying', expect.anything());
        });

        it('normalizes dates with two-digit years to ISO', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>20-04-26</td><td>B</td><td>1,00</td><td>2,00</td></tr></tbody></table>'
            );
            const result = await getBcvHistory();
            expect(result.history[0].date).toBe('2026-04-20');
        });

        it('accepts invocation without arguments', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"></table>'
            );
            const result = await getBcvHistory();
            expect(result.history).toEqual([]);
        });

        it('falls back to raw date string when format is unrecognized', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>April 20, 2026</td><td>B</td><td>1,00</td><td>2,00</td></tr></tbody></table>'
            );
            const result = await getBcvHistory();
            expect(result.history[0].date).toBe('April 20, 2026');
        });
    });

    describe('caching', () => {
        it('reuses cached responses with the default 60s TTL', async () => {
            mock.onGet('https://www.bcv.org.ve/')
                .replyOnce(200, '<div id="dolar"><strong>48</strong></div>')
                .onGet('https://www.bcv.org.ve/')
                .reply(500);

            const first = await getBcvRates({ includeHistory: false });
            const second = await getBcvRates({ includeHistory: false });

            expect(first.current.USD).toBe(48);
            expect(second.current.USD).toBe(48);
        });

        it('bypasses the cache when cacheTtlMs is explicitly 0', async () => {
            mock.onGet('https://www.bcv.org.ve/')
                .replyOnce(200, '<div id="dolar"><strong>48</strong></div>')
                .onGet('https://www.bcv.org.ve/')
                .reply(500);

            const first = await getBcvRates({ includeHistory: false, retries: 0, cacheTtlMs: 0 });
            expect(first.current.USD).toBe(48);
            await expect(
                getBcvRates({ includeHistory: false, retries: 0, cacheTtlMs: 0 })
            ).rejects.toBeInstanceOf(NetworkError);
        });

        it('serves stale cache when upstream fails within the stale window', async () => {
            const warn = jest.fn();
            const logger = { info: jest.fn(), debug: jest.fn(), warn, error: jest.fn() };

            mock.onGet('https://www.bcv.org.ve/')
                .replyOnce(200, '<div id="dolar"><strong>48</strong></div>')
                .onGet('https://www.bcv.org.ve/')
                .reply(500);

            const fresh = await getBcvRates({
                includeHistory: false,
                cacheTtlMs: 10,
                cacheStaleTtlMs: 5_000,
                logger,
            });
            expect(fresh.current.USD).toBe(48);

            await sleep(20); // ttl expired, still within stale window

            const stale = await getBcvRates({
                includeHistory: false,
                cacheTtlMs: 10,
                cacheStaleTtlMs: 5_000,
                retries: 0,
                logger,
            });
            expect(stale.current.USD).toBe(48);
            expect(warn).toHaveBeenCalledWith(
                'Serving stale cache after upstream failure',
                expect.objectContaining({ key: 'bcv:current' })
            );
            expect(getCacheStats().staleServes).toBe(1);
        });

        it('propagates the error when both fresh and stale windows have expired', async () => {
            mock.onGet('https://www.bcv.org.ve/')
                .replyOnce(200, '<div id="dolar"><strong>48</strong></div>')
                .onGet('https://www.bcv.org.ve/')
                .reply(500);

            await getBcvRates({ includeHistory: false, cacheTtlMs: 5, cacheStaleTtlMs: 5 });
            await sleep(20);

            await expect(
                getBcvRates({ includeHistory: false, cacheTtlMs: 5, cacheStaleTtlMs: 5, retries: 0 })
            ).rejects.toBeInstanceOf(NetworkError);
        });

        it('tracks cache hits, misses and stats', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');

            await getBcvRates({ includeHistory: false });
            await getBcvRates({ includeHistory: false });
            await getBcvRates({ includeHistory: false });

            const stats = getCacheStats();
            expect(stats.misses).toBe(1);
            expect(stats.hits).toBe(2);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('resetCacheStats zeroes counters without touching entries', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({ includeHistory: false });
            await getBcvRates({ includeHistory: false });

            expect(getCacheStats().hits).toBe(1);
            resetCacheStats();
            expect(getCacheStats().hits).toBe(0);
            expect(getCacheStats().misses).toBe(0);
        });

        it('uses an injected cacheStore when provided, leaving the default alone', async () => {
            clearCache();
            resetCacheStats();

            const customStore = createInMemoryCache({ maxEntries: 5 });
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');

            await getBcvRates({ includeHistory: false, cacheStore: customStore });
            expect(customStore.size).toBe(1);
            expect(getCacheStats().size).toBe(0); // default untouched
        });

        it('evicts oldest entries once the LRU capacity is reached', async () => {
            const store = createInMemoryCache({ maxEntries: 2 });
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"></table>'
            );

            await getBcvHistory({ page: 0, cacheStore: store });
            await getBcvHistory({ page: 1, cacheStore: store });
            expect(store.size).toBe(2);

            await getBcvHistory({ page: 2, cacheStore: store });
            expect(store.size).toBe(2); // one entry evicted
        });

        it('promotes entries to most-recent on read (LRU touch)', async () => {
            const store = createInMemoryCache({ maxEntries: 2 });
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"></table>'
            );

            await getBcvHistory({ page: 0, cacheStore: store });
            await getBcvHistory({ page: 1, cacheStore: store });
            // Read page 0 again (hit) → promotes to most-recent; page 1 becomes oldest
            await getBcvHistory({ page: 0, cacheStore: store });
            // Adding page 2 should evict page 1, not page 0
            await getBcvHistory({ page: 2, cacheStore: store });

            expect(
                store.get(
                    `bcv:history:https://www.bcv.org.ve/tasas-informativas-sistema-bancario?field_fecha_del_indicador_value%5Bmin%5D%5Bdate%5D=${encodeURIComponent('x')}`
                )
            ).toBeUndefined();
            expect(store.size).toBe(2);
        });

        it('setDefaultCache installs a new default backend', async () => {
            const custom = createInMemoryCache({ maxEntries: 3 });
            setDefaultCache(custom);

            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({ includeHistory: false });

            expect(custom.size).toBe(1);
            expect(getDefaultCache()).toBe(custom);
        });

        it('store.delete removes a single entry', async () => {
            const store = createInMemoryCache();
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({ includeHistory: false, cacheStore: store });
            expect(store.size).toBe(1);
            store.delete('bcv:current');
            expect(store.size).toBe(0);
        });

        it('createInMemoryCache clamps maxEntries to at least 1', async () => {
            const store = createInMemoryCache({ maxEntries: 0 });
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"></table>'
            );
            await getBcvHistory({ page: 0, cacheStore: store });
            await getBcvHistory({ page: 1, cacheStore: store });
            expect(store.size).toBe(1);
        });

        it('accepts custom CacheStore implementations (e.g. a typed mock)', async () => {
            const calls: string[] = [];
            const fake: CacheStore = {
                get size() {
                    return 0;
                },
                get: (key) => {
                    calls.push(`get:${key}`);
                    return undefined;
                },
                set: (key) => {
                    calls.push(`set:${key}`);
                },
                delete: () => {},
                clear: () => {},
            };

            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({ includeHistory: false, cacheStore: fake });

            expect(calls).toEqual(['get:bcv:current', 'set:bcv:current']);
        });
    });

    describe('getTrmRates', () => {
        it('parses a successful response', async () => {
            mock.onGet(/datos.gov.co/).reply(200, [
                { valor: '3573.30', unidad: 'COP', vigenciahasta: '2026-04-21' },
                { valor: '3590.00', unidad: 'COP', vigenciahasta: '2026-04-20' },
            ]);
            const result = await getTrmRates();
            expect(result?.current.value).toBe(3573.3);
            expect(result?.history).toHaveLength(1);
            expect(result?.pagination.limit).toBe(10);
        });

        it('returns null when the API is empty', async () => {
            mock.onGet(/datos.gov.co/).reply(200, []);
            expect(await getTrmRates()).toBeNull();
        });

        it('returns null when the payload is not an array', async () => {
            mock.onGet(/datos.gov.co/).reply(200, { error: 'bad payload' });
            expect(await getTrmRates()).toBeNull();
        });

        it('throws TrmApiError on failure', async () => {
            mock.onGet(/datos.gov.co/).reply(500);
            await expect(getTrmRates({ retries: 0 })).rejects.toBeInstanceOf(TrmApiError);
        });

        it('accepts invocation without arguments', async () => {
            mock.onGet(/datos.gov.co/).reply(200, []);
            expect(await getTrmRates()).toBeNull();
        });

        it('validates limit and offset', async () => {
            await expect(getTrmRates({ limit: 0 })).rejects.toBeInstanceOf(ValidationError);
            await expect(getTrmRates({ limit: 1001 })).rejects.toBeInstanceOf(ValidationError);
            await expect(getTrmRates({ offset: -1 })).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe('error hierarchy', () => {
        it('exposes a shared base error class', () => {
            expect(new NetworkError('x')).toBeInstanceOf(BcvExchangeError);
            expect(new TrmApiError('x')).toBeInstanceOf(BcvExchangeError);
            expect(new ValidationError('x')).toBeInstanceOf(BcvExchangeError);
        });
    });

    describe('environment-based logger', () => {
        const originalEnv = process.env;
        afterEach(() => {
            process.env = originalEnv;
        });

        it('uses console when BCV_DEBUG is set and no logger is provided', async () => {
            process.env = { ...originalEnv, BCV_DEBUG: '1' };
            const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>48</strong></div>');
            await getBcvRates({ includeHistory: false });
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
