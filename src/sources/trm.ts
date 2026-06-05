/**
 * Colombia (TRM) source. Consumes the official open-data API of the Colombian
 * government (Socrata/datos.gov.co) for the Tasa Representativa del Mercado.
 */
import { withCache } from '../cache';
import { TrmApiError } from '../errors';
import { formatIsoDate } from '../format';
import { buildAxiosConfig, requestWithRetry } from '../http';
import { resolveLogger } from '../logger';
import { DateRange, TrmParams, TrmResponse } from '../types';
import { assertLimit, assertPositiveInt } from '../validation';

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
    const days = params.days;

    assertLimit(limit, 1000);
    assertPositiveInt(offset, 'offset', 0);
    if (days !== undefined) assertPositiveInt(days, 'days', 1);

    const config = buildAxiosConfig(params, logger);

    const today = new Date();
    const startDate = new Date();
    let range: DateRange | null = null;
    let url = `https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciahasta%20DESC&$limit=${limit}&$offset=${offset}`;
    if (days !== undefined) {
        startDate.setDate(today.getDate() - days);
        range = { startDate: formatIsoDate(startDate), endDate: formatIsoDate(today) };
        url += `&$where=${encodeURIComponent(`vigenciahasta >= '${range.startDate}'`)}`;
    }

    logger.info('Requesting Colombia TRM', { limit, offset, days });

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
        pagination: { limit, offset, page: null, count: payload.length, hasMore: null },
        range,
    };
}
