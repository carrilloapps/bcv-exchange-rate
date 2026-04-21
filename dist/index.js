"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBcvRates = getBcvRates;
exports.getBcvHistory = getBcvHistory;
exports.getTrmRates = getTrmRates;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const https = __importStar(require("https"));
const winston = __importStar(require("winston"));
/**
 * Logger configuration for observability.
 * By default, it logs to console only if an environment variable or option is set.
 */
const logger = winston.createLogger({
    level: process.env.BCV_LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console({
            silent: process.env.NODE_ENV === 'test' || !process.env.BCV_DEBUG
        })
    ]
});
/**
 * Generates the Axios configuration for requests.
 * @private
 * @param {RequestOptions} options - Library options
 * @returns {AxiosRequestConfig}
 */
const getAxiosConfig = (options = {}) => ({
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
function parseVenezuelanNumber(text) {
    if (!text)
        return null;
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned)
        return null;
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
function getBcvRates() {
    return __awaiter(this, arguments, void 0, function* (params = {}) {
        const activeLogger = params.logger || logger;
        const days = params.days || 7;
        const page = params.page || 0;
        const includeCurrent = params.includeCurrent !== undefined ? params.includeCurrent : true;
        const includeHistory = params.includeHistory !== undefined ? params.includeHistory : true;
        const currencies = params.currencies;
        const config = getAxiosConfig(params);
        activeLogger.info('Starting BCV exchange rate extraction', { days, page, includeCurrent, includeHistory });
        const response = {
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
                const mainRes = yield axios_1.default.get(urlMain, config);
                const $ = cheerio.load(mainRes.data);
                const currencyMap = { 'dolar': 'USD', 'euro': 'EUR', 'yuan': 'CNY', 'lira': 'TRY', 'rublo': 'RUB' };
                const requestedCurrencies = currencies
                    ? (Array.isArray(currencies) ? currencies : [currencies])
                    : null;
                for (const [id, label] of Object.entries(currencyMap)) {
                    if (requestedCurrencies && !requestedCurrencies.includes(label))
                        continue;
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
            }
            catch (error) {
                activeLogger.error('Failure in BCV main page extraction', { error: error.message });
                if (!includeHistory)
                    throw new Error(`Error obteniendo tasas BCV: ${error.message}`);
            }
        }
        if (includeHistory) {
            try {
                const historyData = yield getBcvHistory(Object.assign(Object.assign({}, params), { logger: activeLogger }));
                response.history = historyData.history;
                response.pagination = historyData.pagination;
            }
            catch (e) {
                activeLogger.error('Failed to retrieve BCV historical bank rates in getBcvRates', { error: e.message });
            }
        }
        return response;
    });
}
/**
 * Fetches only the historical/informative bank rates from BCV.
 *
 * @async
 * @function getBcvHistory
 * @param {BcvParams} [params={}] - Query parameters and request options
 * @returns {Promise<Pick<BcvResponse, 'history' | 'pagination'>>} Historical bank rates data
 */
function getBcvHistory() {
    return __awaiter(this, arguments, void 0, function* (params = {}) {
        const activeLogger = params.logger || logger;
        const days = params.days || 7;
        const page = params.page || 0;
        const config = getAxiosConfig(params);
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);
        const formatDateBcv = (date) => {
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
        };
        let urlHistory = `https://www.bcv.org.ve/tasas-informativas-sistema-bancario?field_fecha_del_indicador_value%5Bmin%5D%5Bdate%5D=${encodeURIComponent(formatDateBcv(startDate))}&field_fecha_del_indicador_value%5Bmax%5D%5Bdate%5D=${encodeURIComponent(formatDateBcv(today))}`;
        if (page > 0) {
            urlHistory += `&page=${page}`;
        }
        let history = [];
        let hasNextPage = false;
        try {
            activeLogger.debug('Fetching BCV historical bank rates', { url: urlHistory });
            const histRes = yield axios_1.default.get(urlHistory, config);
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
        }
        catch (e) {
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
    });
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
function getTrmRates() {
    return __awaiter(this, arguments, void 0, function* (params = {}) {
        const activeLogger = params.logger || logger;
        const limit = params.limit || 10;
        const offset = params.offset || 0;
        const config = getAxiosConfig(params);
        activeLogger.info('Requesting Colombia TRM data', { limit, offset });
        const url = `https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciahasta%20DESC&$limit=${limit}&$offset=${offset}`;
        try {
            const response = yield axios_1.default.get(url, config);
            if (!Array.isArray(response.data) || response.data.length === 0) {
                activeLogger.warn('No TRM data found in API response');
                return null;
            }
            const latest = response.data[0];
            const result = {
                current: {
                    value: parseFloat(latest.valor),
                    unit: latest.unidad,
                    validityDate: latest.vigenciahasta
                },
                history: response.data.slice(1).map((item) => ({
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
        }
        catch (error) {
            activeLogger.error('Failed to retrieve TRM from API', { error: error.message });
            throw new Error(`Error obteniendo TRM: ${error.message}`);
        }
    });
}
