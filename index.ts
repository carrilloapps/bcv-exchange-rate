import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as winston from 'winston';

/**
 * Logger configuration for observability.
 * By default, it logs to console only if an environment variable or option is set.
 */
const logger = winston.createLogger({
    level: process.env.BCV_LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            silent: process.env.NODE_ENV === 'test' || !process.env.BCV_DEBUG
        })
    ]
});

/**
 * Interface for the library configuration options.
 * @interface RequestOptions
 */
export interface RequestOptions {
    /** Request timeout in milliseconds. Default: 25000 */
    timeout?: number;
    /** If false, bypasses SSL certificate validation. Recommended for unstable government sites. Default: false */
    strictSSL?: boolean;
    /** Custom User-Agent string for HTTP requests. */
    userAgent?: string;
    /** Custom winston logger instance for better integration with existing observability stacks. */
    logger?: winston.Logger;
}

/**
 * Parameters for BCV (Venezuela) scraping.
 * @interface BcvParams
 * @extends RequestOptions
 */
export interface BcvParams extends RequestOptions {
    /** 
     * Specific currency code(s) to return (e.g., 'USD' or ['USD', 'EUR']).
     * Defaults to all available if omitted.
     */
    currencies?: string | string[];
    /** Whether to include current rates from the main page. Default: true */
    includeCurrent?: boolean;
    /** Whether to include historical bank rates. Default: true */
    includeHistory?: boolean;
    /** Range of days for historical bank rates. Default: 7 */
    days?: number;
    /** Page number for results pagination. Default: 0 */
    page?: number;
}

/**
 * Parameters for Colombia (TRM) API consumption.
 * @interface TrmParams
 * @extends RequestOptions
 */
export interface TrmParams extends RequestOptions {
    /** Maximum number of historical records to return. Default: 10 */
    limit?: number;
    /** Offset for pagination. Default: 0 */
    offset?: number;
}

/**
 * Represents a single bank exchange rate record from BCV.
 * @interface BcvBankRate
 */
export interface BcvBankRate {
    /** Date of the record (DD-MM-YYYY) */
    date: string;
    /** Full name of the banking institution */
    bank: string;
    /** Buy rate value */
    buy: number | null;
    /** Sell rate value */
    sell: number | null;
}

/**
 * Structured response for Venezuela (BCV) indicators.
 * @interface BcvResponse
 */
export interface BcvResponse {
    /** Current official rates indexed by currency code (USD, EUR, CNY, TRY, RUB) */
    current: {
        [key: string]: number;
    };
    /** Reference date for the current rates (ISO String or formatted date) */
    effectiveDate: string;
    /** List of historical/informative bank rates */
    history: BcvBankRate[];
    /** Pagination metadata for historical results */
    pagination: {
        currentPage: number;
        hasNextPage: boolean;
    };
}

/**
 * Structured response for Colombia (TRM) indicators.
 * @interface TrmResponse
 */
export interface TrmResponse {
    /** Most recent official TRM data */
    current: {
        /** Exchange rate value in COP */
        value: number;
        /** Currency unit (usually 'COP') */
        unit: string;
        /** Validity date of the TRM */
        validityDate: string;
    };
    /** List of recent historical TRM records */
    history: {
        value: number;
        validityDate: string;
    }[];
    /** API pagination and result count metadata */
    pagination: {
        limit: number;
        offset: number;
        count: number;
    };
}

/**
 * Generates the Axios configuration for requests.
 * @private
 * @param {RequestOptions} options - Library options
 * @returns {AxiosRequestConfig}
 */
const getAxiosConfig = (options: RequestOptions = {}): AxiosRequestConfig => ({
    timeout: options.timeout || 25000,
    validateStatus: (status) => status < 500,
    httpsAgent: new https.Agent({ 
        rejectUnauthorized: options.strictSSL !== undefined ? options.strictSSL : false 
    }),
    headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    }
});

/**
 * Parses a Venezuelan formatted number string (e.g., "1.234,56") into a float.
 * @private
 * @param {string} text - Raw string from scraping
 * @returns {number | null}
 */
function parseVenezuelanNumber(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
}

/**
 * Fetches and scrapes exchange rate data directly from the Banco Central de Venezuela (BCV).
 * 
 * Includes official rates for USD, EUR, CNY, TRY, RUB and historical bank rates for the last N days.
 * 
 * @async
 * @function getBcvRates
 * @param {BcvParams} [params={}] - Query parameters and request options
 * @returns {Promise<BcvResponse>} Processed data from BCV
 * @throws {Error} If the main site is unreachable or parsing fails.
 */
export async function getBcvRates(params: BcvParams = {}): Promise<BcvResponse> {
    const activeLogger = params.logger || logger;
    const days = params.days || 7;
    const page = params.page || 0;
    const includeCurrent = params.includeCurrent !== undefined ? params.includeCurrent : true;
    const includeHistory = params.includeHistory !== undefined ? params.includeHistory : true;
    const currencies = params.currencies;
    const config = getAxiosConfig(params);

    activeLogger.info('Starting BCV exchange rate extraction', { days, page, includeCurrent, includeHistory });

    const response: BcvResponse = {
        current: {},
        effectiveDate: '',
        history: [],
        pagination: {
            currentPage: page,
            hasNextPage: false
        }
    };

    if (includeCurrent) {
        try {
            const urlMain = 'https://www.bcv.org.ve/';
            activeLogger.debug('Fetching BCV main page', { url: urlMain });
            const mainRes = await axios.get(urlMain, config);
            const $ = cheerio.load(mainRes.data);
            const currencyMap: { [key: string]: string } = { 'dolar': 'USD', 'euro': 'EUR', 'yuan': 'CNY', 'lira': 'TRY', 'rublo': 'RUB' };

            const requestedCurrencies = currencies 
                ? (Array.isArray(currencies) ? currencies : [currencies]) 
                : null;

            for (const [id, label] of Object.entries(currencyMap)) {
                if (requestedCurrencies && !requestedCurrencies.includes(label)) continue;

                const container = $(`#${id}`);
                if (container.length) {
                    const rateText = container.find('strong').text().trim();
                    const rate = parseVenezuelanNumber(rateText);
                    if (rate !== null) {
                        response.current[label] = rate;
                        activeLogger.debug(`Parsed rate: ${label}`, { rate });
                    }
                }
            }
            response.effectiveDate = $('.date-display-single').first().attr('content') || $('.date-display-single').first().text().trim();
        } catch (error: any) {
            activeLogger.error('Failure in BCV main page extraction', { error: error.message });
            if (!includeHistory) throw new Error(`Error obteniendo tasas BCV: ${error.message}`);
        }
    }

    if (includeHistory) {
        try {
            const historyData = await getBcvHistory({ ...params, logger: activeLogger });
            response.history = historyData.history;
            response.pagination = historyData.pagination;
        } catch (e: any) {
            activeLogger.error('Failed to retrieve BCV historical bank rates in getBcvRates', { error: e.message });
        }
    }

    return response;
}

/**
 * Fetches only the historical/informative bank rates from BCV.
 * 
 * @async
 * @function getBcvHistory
 * @param {BcvParams} [params={}] - Query parameters and request options
 * @returns {Promise<Pick<BcvResponse, 'history' | 'pagination'>>} Historical bank rates data
 */
export async function getBcvHistory(params: BcvParams = {}): Promise<Pick<BcvResponse, 'history' | 'pagination'>> {
    const activeLogger = params.logger || logger;
    const days = params.days || 7;
    const page = params.page || 0;
    const config = getAxiosConfig(params);

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    const formatDateBcv = (date: Date): string => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    let urlHistory = `https://www.bcv.org.ve/tasas-informativas-sistema-bancario?field_fecha_del_indicador_value%5Bmin%5D%5Bdate%5D=${encodeURIComponent(formatDateBcv(startDate))}&field_fecha_del_indicador_value%5Bmax%5D%5Bdate%5D=${encodeURIComponent(formatDateBcv(today))}`;
    
    if (page > 0) {
        urlHistory += `&page=${page}`;
    }

    let history: BcvBankRate[] = [];
    let hasNextPage = false;

    try {
        activeLogger.debug('Fetching BCV historical bank rates', { url: urlHistory });
        const histRes = await axios.get(urlHistory, config);
        const $h = cheerio.load(histRes.data);
        
        $h('table.views-table tbody tr').each((_, row) => {
            const cells = $h(row).find('td');
            if (cells.length >= 4) {
                history.push({
                    date: $h(cells[0]).text().trim(),
                    bank: $h(cells[1]).text().trim(),
                    buy: parseVenezuelanNumber($h(cells[2]).text().trim()),
                    sell: parseVenezuelanNumber($h(cells[3]).text().trim())
                });
            }
        });

        hasNextPage = $h('.pager-next').length > 0;
        activeLogger.info(`Successfully retrieved ${history.length} bank rates`, { hasNextPage });
    } catch (e: any) {
        activeLogger.error('Failed to retrieve BCV historical bank rates', { error: e.message });
        throw new Error(`Error obteniendo historial BCV: ${e.message}`);
    }

    return {
        history,
        pagination: {
            currentPage: page,
            hasNextPage
        }
    };
}

/**
 * Fetches the official Representative Market Rate (TRM) from Colombia's Open Data API.
 * 
 * Powered by Superintendencia Financiera de Colombia (SFC).
 * 
 * @async
 * @function getTrmRates
 * @param {TrmParams} [params={}] - API query parameters and request options
 * @returns {Promise<TrmResponse | null>} Official TRM data or null if no results found.
 * @throws {Error} If the API endpoint is unreachable or returns invalid data.
 */
export async function getTrmRates(params: TrmParams = {}): Promise<TrmResponse | null> {
    const activeLogger = params.logger || logger;
    const limit = params.limit || 10;
    const offset = params.offset || 0;
    const config = getAxiosConfig(params);

    activeLogger.info('Requesting Colombia TRM data', { limit, offset });

    const url = `https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciahasta%20DESC&$limit=${limit}&$offset=${offset}`;
    
    try {
        const response = await axios.get(url, config);
        if (!Array.isArray(response.data) || response.data.length === 0) {
            activeLogger.warn('No TRM data found in API response');
            return null;
        }

        const latest = response.data[0];
        const result: TrmResponse = {
            current: {
                value: parseFloat(latest.valor),
                unit: latest.unidad,
                validityDate: latest.vigenciahasta
            },
            history: response.data.slice(1).map((item: any) => ({
                value: parseFloat(item.valor),
                validityDate: item.vigenciahasta
            })),
            pagination: {
                limit,
                offset,
                count: response.data.length
            }
        };

        activeLogger.info('Successfully retrieved TRM data', { currentTRM: result.current.value });
        return result;
    } catch (error: any) {
        activeLogger.error('Failed to retrieve TRM from API', { error: error.message });
        throw new Error(`Error obteniendo TRM: ${error.message}`);
    }
}
