import * as winston from 'winston';
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
export declare function getBcvRates(params?: BcvParams): Promise<BcvResponse>;
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
export declare function getTrmRates(params?: TrmParams): Promise<TrmResponse | null>;
