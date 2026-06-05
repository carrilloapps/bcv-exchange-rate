/**
 * Logger resolution. The library never forces a logging dependency: callers
 * inject any object compatible with the duck-typed `Logger` interface, the
 * `BCV_DEBUG` environment variable enables `console`, and everything else
 * stays silent.
 */
import { Logger, RequestOptions } from './types';

/** Logger that discards every message. Used when no logger is configured. */
export const noopLogger: Logger = { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };

/**
 * Resolves the effective logger for a call: the injected `options.logger`,
 * `console` when `BCV_DEBUG` is set, or a silent no-op logger.
 */
export function resolveLogger(options: RequestOptions): Logger {
    if (options.logger) return options.logger;
    if (process.env.BCV_DEBUG) return console;
    return noopLogger;
}
