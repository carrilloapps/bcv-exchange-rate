/**
 * Venezuela (BCV) source. Scrapes the Banco Central de Venezuela portal:
 * current official rates from the home page and the informative bank-rate
 * history from the `tasas-informativas-sistema-bancario` view.
 */
import * as cheerio from 'cheerio';
import { withCache } from '../cache';
import { formatBcvDate, formatIsoDate, parseVenezuelanNumber, toIsoDate } from '../format';
import { buildAxiosConfig, requestWithRetry } from '../http';
import { resolveLogger } from '../logger';
import { BcvBankRate, BcvParams, BcvResponse, Currency } from '../types';
import { assertPositiveInt } from '../validation';

/** Element ids used by the BCV home page, mapped to ISO currency codes. */
const BCV_CURRENCY_MAP: Record<string, Currency> = {
    dolar: 'USD',
    euro: 'EUR',
    yuan: 'CNY',
    lira: 'TRY',
    rublo: 'RUB',
};

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
        pagination: { limit: null, offset: null, page, count: 0, hasMore: null },
        range: null,
        strictSSL: params.strictSSL !== false,
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
            response.range = historyData.range;
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
): Promise<Pick<BcvResponse, 'history' | 'pagination' | 'range'>> {
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
    // Prefer the main page view: the portal also renders a 3-column sidebar
    // block (`view-tasas-sistema-bancario`) whose table matches the generic
    // selector but carries no date column.
    let table = $('.view-tasas-sistema-bancario-full table.views-table');
    if (!table.length) table = $('table.views-table.cols-4');
    if (!table.length) table = $('table.views-table');
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

    // The portal currently paginates with Bootstrap (`ul.pagination li.next`);
    // `.pager-next` is kept for older Drupal pager markup.
    const hasMore = $('ul.pagination li.next').length > 0 || $('.pager-next').length > 0;
    logger.info('BCV history retrieved', { count: history.length, hasMore });

    return {
        history,
        pagination: { limit: null, offset: null, page, count: history.length, hasMore },
        range: { startDate: formatIsoDate(startDate), endDate: formatIsoDate(today) },
    };
}
