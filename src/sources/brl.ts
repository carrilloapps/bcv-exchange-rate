/**
 * Brazil (PTAX) source. Consumes the Banco Central do Brasil open-data API
 * (Olinda/OData) for the official USD/BRL PTAX quotation.
 */
import { withCache } from '../cache';
import { BrlApiError } from '../errors';
import { formatIsoDate, formatPtaxDate } from '../format';
import { buildAxiosConfig, requestWithRetry } from '../http';
import { resolveLogger } from '../logger';
import { BrlParams, BrlRate, BrlResponse } from '../types';
import { assertLimit, assertPositiveInt } from '../validation';

/** Raw quotation record as returned by the PTAX OData API. */
interface PtaxQuotation {
    cotacaoCompra: number;
    cotacaoVenda: number;
    dataHoraCotacao: string;
}

/**
 * Fetches the official USD/BRL PTAX rate from the Banco Central do Brasil
 * open-data API (Olinda/OData).
 *
 * @throws {ValidationError} On invalid input.
 * @throws {BrlApiError} When the upstream API cannot be reached.
 * @returns `null` when the window contains no quotations (e.g. it only spans
 * weekends or holidays, days on which no PTAX is published).
 */
export async function getBrlRates(params: BrlParams = {}): Promise<BrlResponse | null> {
    const logger = resolveLogger(params);
    const days = params.days ?? 7;
    const limit = params.limit;
    const offset = params.offset ?? 0;

    assertPositiveInt(days, 'days', 1);
    assertLimit(limit, 1000);
    assertPositiveInt(offset, 'offset', 0);

    const config = buildAxiosConfig(params, logger);

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    // `$top`/`$skip` are only appended when requested so that the default
    // behaviour (return the whole window) stays unchanged.
    let url =
        'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/' +
        'CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)' +
        `?@dataInicial='${formatPtaxDate(startDate)}'&@dataFinalCotacao='${formatPtaxDate(today)}'` +
        '&$orderby=dataHoraCotacao%20desc&$format=json';
    if (limit !== undefined) url += `&$top=${limit}`;
    if (offset > 0) url += `&$skip=${offset}`;

    logger.info('Requesting Brazil PTAX', { days, limit, offset });

    let payload: { value?: PtaxQuotation[] };
    try {
        payload = await withCache(`brl:${url}`, params, logger, () =>
            requestWithRetry<{ value?: PtaxQuotation[] }>(url, config, params, logger)
        );
    } catch (error) {
        throw new BrlApiError(`Failed to fetch PTAX: ${(error as Error).message}`, error);
    }

    const records = Array.isArray(payload?.value) ? payload.value : [];
    if (records.length === 0) {
        logger.warn('PTAX API returned no quotations');
        return null;
    }

    const toRate = (item: PtaxQuotation): BrlRate => ({
        buy: item.cotacaoCompra,
        sell: item.cotacaoVenda,
        dateTime: item.dataHoraCotacao,
    });

    const [latest, ...rest] = records;
    return {
        current: toRate(latest),
        history: rest.map(toRate),
        pagination: { limit: limit ?? null, offset, page: null, count: records.length, hasMore: null },
        range: { startDate: formatIsoDate(startDate), endDate: formatIsoDate(today) },
    };
}
