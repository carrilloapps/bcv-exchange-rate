/**
 * HTTP layer: axios configuration (timeouts, TLS policy, headers) and the
 * retry wrapper with exponential backoff used by every source function.
 */
import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { NetworkError, TlsError } from './errors';
import { Logger, RequestOptions } from './types';

/** Node/OpenSSL error codes that identify a TLS certificate validation failure. */
const TLS_ERROR_CODES = new Set([
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'CERT_SIGNATURE_FAILURE',
    'CERT_UNTRUSTED',
    'HOSTNAME_MISMATCH',
]);

/** Detects whether an axios/Node error is a TLS certificate validation failure. */
export function isTlsCertificateError(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string }; message?: string };
    if (err?.code && TLS_ERROR_CODES.has(err.code)) return true;
    if (err?.cause?.code && TLS_ERROR_CODES.has(err.cause.code)) return true;
    return false;
}

const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Builds the axios request configuration from the shared options: timeout,
 * TLS strictness (with a `warn` whenever validation is bypassed) and headers
 * that government portals accept.
 */
export function buildAxiosConfig(options: RequestOptions, logger: Logger): AxiosRequestConfig {
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

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a GET request retrying transient failures with exponential backoff
 * (`retryDelayMs * 2^attempt`). After exhausting `retries + 1` attempts the
 * last failure is wrapped in a `NetworkError` with the original cause attached.
 *
 * TLS certificate failures are NOT retried: a bad certificate is deterministic,
 * so they raise a `TlsError` immediately with a hint about the `strictSSL`
 * escape hatch.
 */
export async function requestWithRetry<T>(
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
            if (isTlsCertificateError(error)) {
                logger.error('TLS certificate validation failed', {
                    url,
                    code: (error as { code?: string }).code,
                });
                throw new TlsError(
                    `TLS certificate validation failed for ${url}: ${(error as Error).message}. ` +
                        'If you accept the man-in-the-middle risk, retry with { strictSSL: false } ' +
                        '(library/MCP tools) or without --strict-ssl (CLI) to inspect the data anyway.',
                    error
                );
            }
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
